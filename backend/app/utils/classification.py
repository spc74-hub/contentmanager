"""
Classification utilities for video categorization.

This module provides helper functions for the multi-signal classification system,
combining tags, transcript, description, and author history signals.
"""

from collections import defaultdict
from typing import Optional, Dict, List, Set

from .tag_mappings import TAG_AREA_MAPPINGS


# Signal weights for classification
SIGNAL_WEIGHTS: Dict[str, float] = {
    'transcript': 0.50,   # Rich signal: transcript + summary + key_points
    'tags': 0.30,         # Direct signal: hashtags from creator
    'description': 0.15,  # Contextual signal: title + description
    'author': 0.05,       # Pattern signal: author history
}


def calculate_tag_signal(
    tags: List[str],
    custom_mappings: Optional[Dict[str, int]] = None
) -> Dict[int, float]:
    """
    Calculate area scores based on video tags.

    Args:
        tags: List of tags from the video
        custom_mappings: Optional custom tag->area mappings (from DB)
                        Falls back to TAG_AREA_MAPPINGS if not provided

    Returns:
        Dictionary mapping area_id -> normalized score (0.0-1.0)
    """
    if not tags:
        return {}

    # Use custom mappings if provided, otherwise use default
    mappings = custom_mappings if custom_mappings else TAG_AREA_MAPPINGS

    # Count votes per area
    area_votes: Dict[int, int] = defaultdict(int)
    matched_tags = 0

    for tag in tags:
        tag_lower = tag.lower().strip()
        if tag_lower in mappings:
            area_id = mappings[tag_lower]
            area_votes[area_id] += 1
            matched_tags += 1

    if not area_votes:
        return {}

    # Normalize scores
    # Score is based on:
    # 1. Proportion of tags matching this area vs total matched tags (dominance)
    # 2. Proportion of tags that matched vs total tags (coverage)
    total_votes = sum(area_votes.values())
    coverage = matched_tags / len(tags) if tags else 0

    scores: Dict[int, float] = {}
    for area_id, votes in area_votes.items():
        dominance = votes / total_votes
        # Combined score: how dominant this area is * how well tags match overall
        scores[area_id] = dominance * (0.5 + 0.5 * coverage)

    return scores


def classify_by_tags_only(
    tags: List[str],
    custom_mappings: Optional[Dict[str, int]] = None
) -> Dict:
    """
    Classify a video using only its tags.

    Args:
        tags: List of tags from the video
        custom_mappings: Optional custom tag->area mappings

    Returns:
        {
            'area_id': int or None,
            'confidence': float (0.0-1.0),
            'matched_tags': int,
            'area_votes': dict
        }
    """
    if not tags:
        return {
            'area_id': None,
            'confidence': 0.0,
            'matched_tags': 0,
            'area_votes': {}
        }

    mappings = custom_mappings if custom_mappings else TAG_AREA_MAPPINGS

    # Count votes per area
    area_votes: Dict[int, int] = defaultdict(int)
    matched_tags = 0

    for tag in tags:
        tag_lower = tag.lower().strip()
        if tag_lower in mappings:
            area_id = mappings[tag_lower]
            area_votes[area_id] += 1
            matched_tags += 1

    if not area_votes:
        return {
            'area_id': None,
            'confidence': 0.0,
            'matched_tags': 0,
            'area_votes': {}
        }

    # Find winning area
    best_area = max(area_votes, key=area_votes.get)
    best_votes = area_votes[best_area]
    total_matched = sum(area_votes.values())

    # Calculate confidence based on:
    # 1. How dominant the winning area is (proportion of matched tags)
    # 2. How many tags matched overall (coverage)
    dominance = best_votes / total_matched
    coverage = matched_tags / len(tags)

    # Confidence formula:
    # - Minimum 2 matching tags for reasonable confidence
    # - Higher dominance = higher confidence
    # - Better coverage = higher confidence
    if matched_tags < 2:
        confidence = 0.3 * dominance * coverage
    else:
        confidence = min(0.85, 0.4 + 0.3 * dominance + 0.3 * coverage)

    return {
        'area_id': best_area,
        'confidence': round(confidence, 3),
        'matched_tags': matched_tags,
        'area_votes': dict(area_votes)
    }


def get_dominant_area_from_history(author_history: List[Dict]) -> Optional[int]:
    """
    Get the dominant area from author's video history.

    Args:
        author_history: List of dicts with 'area_id' and optionally 'area_name'

    Returns:
        The most common area_id, or None if no history
    """
    if not author_history:
        return None

    area_counts: Dict[int, int] = defaultdict(int)
    for entry in author_history:
        area_id = entry.get('area_id')
        if area_id:
            area_counts[area_id] += 1

    if not area_counts:
        return None

    return max(area_counts, key=area_counts.get)


def combine_classification_signals(
    signals: Dict[str, Dict],
    weights: Optional[Dict[str, float]] = None
) -> Dict:
    """
    Combine multiple classification signals into a final decision.

    Args:
        signals: Dictionary of signal_name -> {area_id, confidence, ...}
        weights: Optional custom weights per signal type

    Returns:
        {
            'area_id': int or None,
            'confidence': float,
            'needs_review': bool,
            'signal_breakdown': dict
        }
    """
    if not signals:
        return {
            'area_id': None,
            'confidence': 0.0,
            'needs_review': True,
            'signal_breakdown': {}
        }

    w = weights if weights else SIGNAL_WEIGHTS

    # Accumulate weighted scores per area
    area_scores: Dict[int, float] = defaultdict(float)
    total_weight_used = 0.0

    for signal_name, result in signals.items():
        if not result:
            continue

        signal_weight = w.get(signal_name, 0.1)

        # Handle different signal formats
        if signal_name == 'tags' and isinstance(result, dict):
            # Tags signal returns {area_id: score, ...}
            if 'area_id' in result:
                # classify_by_tags_only format
                area_id = result.get('area_id')
                confidence = result.get('confidence', 0.5)
                if area_id:
                    area_scores[area_id] += signal_weight * confidence
                    total_weight_used += signal_weight
            else:
                # calculate_tag_signal format {area_id: score}
                for area_id, score in result.items():
                    if isinstance(area_id, int):
                        area_scores[area_id] += signal_weight * score
                total_weight_used += signal_weight
        else:
            # Standard format: {area_id, confidence, ...}
            area_id = result.get('area_id')
            confidence = result.get('confidence', 0.5)
            if area_id:
                area_scores[area_id] += signal_weight * confidence
                total_weight_used += signal_weight

    if not area_scores:
        return {
            'area_id': None,
            'confidence': 0.0,
            'needs_review': True,
            'signal_breakdown': signals
        }

    # Find best area
    best_area = max(area_scores, key=area_scores.get)
    best_score = area_scores[best_area]

    # Normalize confidence to 0-1 range
    # If all signals agree, we get close to 1.0
    # If only some signals present, we scale by weight coverage
    confidence = best_score / total_weight_used if total_weight_used > 0 else 0.0
    confidence = min(1.0, confidence)

    return {
        'area_id': best_area,
        'confidence': round(confidence, 3),
        'needs_review': confidence < 0.4,
        'signal_breakdown': signals
    }


def adjust_weights_for_available_signals(available_signals: Set[str]) -> Dict[str, float]:
    """
    Adjust signal weights based on which signals are available.

    When some signals are missing (e.g., no transcript), redistribute
    their weight to other available signals.

    Args:
        available_signals: Set of signal names that are available

    Returns:
        Adjusted weights dictionary
    """
    if not available_signals:
        return {}

    base_weights = SIGNAL_WEIGHTS.copy()

    # Calculate total weight of available signals
    available_weight = sum(
        base_weights.get(s, 0) for s in available_signals
    )

    if available_weight == 0:
        return {}

    # Redistribute to normalize to ~1.0
    adjusted: Dict[str, float] = {}
    for signal in available_signals:
        original = base_weights.get(signal, 0.1)
        adjusted[signal] = original / available_weight

    return adjusted
