"""
AI Processing router for mass transcription and analysis.
Uses YouTube subtitles or Whisper for transcription + Ollama for summarization.

YouTube videos: Downloads existing subtitles (fast, ~1-2 seconds)
TikTok videos: Downloads audio and transcribes with Whisper (~15-30 seconds)
"""
import asyncio
import json
import os
import re
import time
import tempfile
import subprocess
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

# Import classification utilities
from app.utils.tag_mappings import TAG_AREA_MAPPINGS
from app.utils.classification import (
    classify_by_tags_only,
    combine_classification_signals,
    adjust_weights_for_available_signals,
    get_dominant_area_from_history,
)

router = APIRouter()

# Directory for storing results
RESULTS_DIR = Path("/tmp/content_manager_ai_process")
RESULTS_DIR.mkdir(exist_ok=True)

# Processing jobs in memory
processing_jobs: dict = {}


class AIProcessJob(BaseModel):
    id: str
    status: str  # pending, running, completed, failed, paused
    total_videos: int
    processed: int
    transcribed: int
    summarized: int
    categorized: int
    failed: int
    skipped: int
    # Enrichment tracking - new fields added
    area_assigned: int = 0
    key_points_added: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    eta_minutes: Optional[float] = None
    current_video: Optional[str] = None
    error: Optional[str] = None
    errors_list: list = []


class AIProcessRequest(BaseModel):
    """Request to start AI processing of TikTok videos."""
    source: str = "tiktok"  # Source filter (tiktok, youtube, all, subscription, liked_videos, playlist, curated_channel)
    include_transcription: bool = True  # Use Whisper for audio transcription
    include_summary: bool = True  # Generate summary with Ollama
    include_key_points: bool = True  # Generate key points
    include_categorization: bool = True  # Re-categorize based on transcript
    include_subcategories: bool = True  # Generate subcategories
    whisper_model: str = "base"  # Whisper model size (tiny, base, small, medium)
    limit: Optional[int] = None  # Limit number of videos (for testing)
    skip_processed: bool = True  # Skip videos with existing transcript
    only_without_area: bool = False  # Only process videos without area_id (for taxonomy migration)
    only_without_key_points: bool = False  # Only process videos without key_points
    only_without_summary: bool = False  # Only process videos without summary
    curated_channel_id: Optional[int] = None  # Filter by specific curated channel
    batch_size: int = 10  # Videos per batch for progress saving
    concurrency: int = 1  # Parallel processing (1 for safety)
    classify_without_transcript: bool = True  # Classify using tags/description even without transcript


def fetch_video_metadata(video_url: str) -> Optional[str]:
    """Fetch just the upload_date from a video URL using yt-dlp.

    Returns: upload_date in YYYY-MM-DD format, or None
    """
    try:
        result = subprocess.run([
            "python3", "-m", "yt_dlp",
            "--dump-json",
            "--no-download",
            "--quiet",
            "--no-warnings",
            video_url
        ], capture_output=True, text=True, timeout=30)

        if result.returncode == 0 and result.stdout:
            metadata = json.loads(result.stdout)
            raw_date = metadata.get('upload_date')
            if raw_date and len(raw_date) == 8:
                return f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
    except Exception as e:
        print(f"Metadata fetch error for {video_url}: {e}")

    return None


def download_youtube_subtitles(video_url: str, output_dir: str) -> tuple[Optional[str], Optional[str]]:
    """Download subtitles from YouTube video using yt-dlp.

    Tries to get subtitles in this order:
    1. Manual Spanish subtitles
    2. Auto-generated Spanish subtitles
    3. Manual English subtitles
    4. Auto-generated English subtitles

    Returns: (transcript_text, upload_date) where upload_date is in YYYY-MM-DD format
    """
    upload_date = None
    transcript = None

    try:
        # First get metadata including upload_date
        metadata_result = subprocess.run([
            "python3", "-m", "yt_dlp",
            "--dump-json",
            "--no-download",
            "--quiet",
            video_url
        ], capture_output=True, text=True, timeout=60)

        if metadata_result.returncode == 0 and metadata_result.stdout:
            try:
                metadata = json.loads(metadata_result.stdout)
                raw_date = metadata.get('upload_date')
                if raw_date and len(raw_date) == 8:
                    upload_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            except:
                pass

        # Try to download subtitles - prefer Spanish, fallback to English
        # Languages to try in order of preference
        lang_preferences = ["es", "en"]

        for lang in lang_preferences:
            # Try manual subtitles first, then auto-generated
            for auto_flag in [False, True]:
                sub_file = os.path.join(output_dir, f"subtitle.{lang}.vtt")

                cmd = [
                    "python3", "-m", "yt_dlp",
                    "--skip-download",
                    "--write-sub" if not auto_flag else "--write-auto-sub",
                    "--sub-lang", lang,
                    "--sub-format", "vtt",
                    "-o", os.path.join(output_dir, "subtitle"),
                    "--quiet",
                    "--no-warnings",
                    video_url
                ]

                # For auto subs, we need both flags
                if auto_flag:
                    cmd = [
                        "python3", "-m", "yt_dlp",
                        "--skip-download",
                        "--write-auto-sub",
                        "--sub-lang", lang,
                        "--sub-format", "vtt",
                        "-o", os.path.join(output_dir, "subtitle"),
                        "--quiet",
                        "--no-warnings",
                        video_url
                    ]

                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

                # Check if subtitle file was created
                possible_files = [
                    os.path.join(output_dir, f"subtitle.{lang}.vtt"),
                    os.path.join(output_dir, f"subtitle.{lang}.vtt"),
                ]

                # Also check for variations in filename
                for f in os.listdir(output_dir):
                    if f.endswith('.vtt'):
                        possible_files.append(os.path.join(output_dir, f))

                for sub_path in possible_files:
                    if os.path.exists(sub_path):
                        transcript = parse_vtt_subtitles(sub_path)
                        if transcript and len(transcript) > 50:
                            print(f"[YouTube Subtitles] Found {'auto-generated' if auto_flag else 'manual'} {lang} subtitles")
                            return transcript, upload_date

        return None, upload_date

    except subprocess.TimeoutExpired:
        print(f"[YouTube Subtitles] Timeout downloading subtitles for {video_url}")
        return None, upload_date
    except Exception as e:
        print(f"[YouTube Subtitles] Error: {e}")
        return None, upload_date


def parse_vtt_subtitles(vtt_path: str) -> Optional[str]:
    """Parse VTT subtitle file and extract clean text."""
    try:
        with open(vtt_path, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        text_lines = []
        seen_lines = set()  # To avoid duplicates from auto-generated subs

        for line in lines:
            line = line.strip()

            # Skip VTT headers and timestamps
            if not line:
                continue
            if line.startswith('WEBVTT'):
                continue
            if line.startswith('Kind:') or line.startswith('Language:'):
                continue
            if '-->' in line:  # Timestamp line
                continue
            if line.isdigit():  # Cue number
                continue

            # Remove HTML tags like <c> </c> and timing tags
            line = re.sub(r'<[^>]+>', '', line)
            line = re.sub(r'\[.*?\]', '', line)  # Remove [Music] etc
            line = line.strip()

            if line and line not in seen_lines:
                seen_lines.add(line)
                text_lines.append(line)

        # Join all text
        transcript = ' '.join(text_lines)

        # Clean up extra spaces
        transcript = re.sub(r'\s+', ' ', transcript).strip()

        return transcript if len(transcript) > 20 else None

    except Exception as e:
        print(f"[VTT Parse] Error parsing {vtt_path}: {e}")
        return None


def is_youtube_video(video: dict) -> bool:
    """Check if a video is from YouTube based on URL or source."""
    url = video.get("url", "")
    source = video.get("source", "")

    youtube_indicators = ["youtube.com", "youtu.be"]
    youtube_sources = ["liked", "playlist", "watch_later", "single"]

    if any(ind in url for ind in youtube_indicators):
        return True
    if source in youtube_sources and "tiktok" not in url.lower():
        return True

    return False


def download_youtube_audio(video_url: str, output_dir: str) -> Optional[str]:
    """Download audio from YouTube video using yt-dlp (fallback when no subtitles).

    Returns: audio_path or None
    """
    output_path = os.path.join(output_dir, "audio.mp3")

    try:
        result = subprocess.run([
            "python3", "-m", "yt_dlp",
            "-x",  # Extract audio
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_path,
            "--quiet",
            "--no-warnings",
            video_url
        ], capture_output=True, text=True, timeout=180)

        # Check for file
        if os.path.exists(output_path):
            return output_path

        # Try other extensions
        for ext in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
            test_path = output_path.replace(".mp3", ext)
            if os.path.exists(test_path):
                return test_path

        # Check any audio file in directory
        for f in os.listdir(output_dir):
            if any(f.endswith(ext) for ext in [".mp3", ".m4a", ".webm", ".opus", ".wav"]):
                return os.path.join(output_dir, f)

        return None

    except subprocess.TimeoutExpired:
        print(f"[YouTube Audio] Timeout downloading {video_url}")
        return None
    except Exception as e:
        print(f"[YouTube Audio] Error: {e}")
        return None


def download_tiktok_audio(video_url: str, video_id: str, output_dir: str) -> tuple[Optional[str], Optional[str]]:
    """Download audio from TikTok video using yt-dlp.

    Returns: (audio_path, upload_date) where upload_date is in YYYY-MM-DD format
    """
    # Build download URL - TikTok videos need special URL format
    download_url = f"https://www.tiktokv.com/share/video/{video_id}/"
    output_path = os.path.join(output_dir, f"{video_id}.mp3")
    upload_date = None

    try:
        # First try to get metadata including upload_date
        metadata_result = subprocess.run([
            "python3", "-m", "yt_dlp",
            "--dump-json",
            "--no-download",
            download_url
        ], capture_output=True, text=True, timeout=60)

        if metadata_result.returncode == 0 and metadata_result.stdout:
            import json
            try:
                metadata = json.loads(metadata_result.stdout)
                raw_date = metadata.get('upload_date')
                if raw_date and len(raw_date) == 8:
                    upload_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            except:
                pass

        # Now download audio
        result = subprocess.run([
            "python3", "-m", "yt_dlp",
            "-x",  # Extract audio
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_path,
            "--quiet",
            "--no-warnings",
            download_url
        ], capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            # Try with original URL
            result = subprocess.run([
                "python3", "-m", "yt_dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "-o", output_path,
                "--quiet",
                "--no-warnings",
                video_url
            ], capture_output=True, text=True, timeout=120)

        # Check for file (yt-dlp may add extension)
        if os.path.exists(output_path):
            return output_path, upload_date

        # Try other extensions
        for ext in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
            test_path = output_path.replace(".mp3", ext)
            if os.path.exists(test_path):
                return test_path, upload_date

        return None, upload_date

    except subprocess.TimeoutExpired:
        return None, None
    except Exception as e:
        print(f"Download error for {video_id}: {e}")
        return None, None


def transcribe_audio(audio_path: str, model_size: str = "base") -> tuple[str, float]:
    """Transcribe audio using faster-whisper."""
    try:
        from faster_whisper import WhisperModel

        start = time.time()

        # Load model (cached after first use)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")

        # Transcribe (auto-detect language)
        segments, info = model.transcribe(audio_path, beam_size=5)

        # Collect all text
        text = " ".join([segment.text.strip() for segment in segments])

        elapsed = time.time() - start

        return text, elapsed

    except Exception as e:
        print(f"Transcription error: {e}")
        return "", 0


async def generate_summary_with_ollama(
    title: str,
    transcript: str,
    extended: bool = True
) -> tuple[Optional[str], list[str]]:
    """Generate summary and key points using Ollama."""
    import httpx

    if not transcript:
        return None, []

    if extended:
        prompt = f"""Analiza este video y proporciona un resumen detallado con puntos clave.

Título: {title}
Transcripción:
{transcript[:8000]}

IMPORTANTE: Responde EXACTAMENTE en este formato:

RESUMEN: [Escribe aquí un resumen de 4-6 oraciones sobre el contenido del video]

PUNTOS CLAVE:
- [Primer punto clave]
- [Segundo punto clave]
- [Tercer punto clave]
- [Cuarto punto clave]"""
        num_predict = 600
    else:
        prompt = f"""Resume este video en 2-3 oraciones concisas.

Título: {title}
Transcripción:
{transcript[:4000]}

Resumen (2-3 oraciones):"""
        num_predict = 150

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": num_predict,
                    }
                }
            )

            if response.status_code != 200:
                return None, []

            result = response.json()
            raw_response = result.get("response", "").strip()

            if extended:
                summary = ""
                key_points = []
                lines = raw_response.split("\n")
                in_points = False
                in_summary = False

                for line in lines:
                    line = line.strip()
                    line_lower = line.lower()

                    if "resumen:" in line_lower:
                        in_summary = True
                        in_points = False
                        if ":" in line:
                            summary = line.split(":", 1)[1].strip()
                        continue

                    if "puntos clave" in line_lower or "key points" in line_lower:
                        in_points = True
                        in_summary = False
                        continue

                    if in_points:
                        # Check for bullet points: -, •, *, or numbered: 1., 2., etc.
                        import re
                        if line.startswith(("-", "•", "*")):
                            point = line.lstrip("-•*").strip()
                            if point and len(point) > 3:
                                key_points.append(point)
                        elif re.match(r'^\d+[\.\)]\s*', line):
                            point = re.sub(r'^\d+[\.\)]\s*', '', line).strip()
                            if point and len(point) > 3:
                                key_points.append(point)
                    elif in_summary and line:
                        summary = summary + " " + line if summary else line

                # Debug log to see what Ollama returned
                if not key_points:
                    print(f"[AI Process] No key_points parsed. Raw response:\n{raw_response[:500]}")

                if not summary:
                    summary = raw_response[:500]

                return summary, key_points[:6]
            else:
                return raw_response, []

    except Exception as e:
        print(f"Summary error: {e}")
        return None, []


async def classify_with_new_taxonomy(
    title: str,
    author: str,
    transcript: str,
    areas: list[dict],
    topics: list[dict],
    author_history: list[dict] = None,
    tags: list[str] = None,
    description: str = None
) -> dict:
    """Classify video using new taxonomy (areas + topics).

    Now supports multiple signals:
    - transcript (primary, rich signal)
    - tags (direct signal from creator hashtags)
    - description (contextual signal)
    - author_history (pattern signal)

    Returns: {
        "area_id": int,
        "topic_ids": list[int],
        "confidence": float (0.0-1.0),
        "needs_review": bool,
        "classification_method": str
    }
    """
    import httpx

    # ═══════════════════════════════════════════════════════════════════════
    # MULTI-SIGNAL CLASSIFICATION
    # ═══════════════════════════════════════════════════════════════════════

    classification_signals = {}

    # Signal 1: Tags (direct signal) - classify first, it's fast
    if tags:
        tag_result = classify_by_tags_only(tags)
        if tag_result.get('area_id'):
            classification_signals['tags'] = tag_result
            print(f"[Classify] Tags signal: area={tag_result['area_id']}, "
                  f"conf={tag_result['confidence']}, matched={tag_result['matched_tags']}")

    # Signal 2: Author history (pattern signal)
    author_area = None
    if author_history:
        author_area = get_dominant_area_from_history(author_history)
        if author_area:
            classification_signals['author'] = {
                'area_id': author_area,
                'confidence': 0.6
            }
            print(f"[Classify] Author signal: area={author_area}")

    # If no transcript, try to classify with available signals
    if not transcript:
        # Use description if available
        if description and len(description) > 50:
            # Will use LLM with description below
            pass
        elif classification_signals:
            # Combine available signals without transcript
            combined = combine_classification_signals(classification_signals)
            if combined.get('area_id'):
                print(f"[Classify] No transcript - using tags/author: area={combined['area_id']}")
                return {
                    "area_id": combined['area_id'],
                    "topic_ids": [],  # Can't determine topics without LLM
                    "confidence": combined['confidence'],
                    "needs_review": combined['needs_review'],
                    "classification_method": "tags_only"
                }

    # ═══════════════════════════════════════════════════════════════════════
    # LLM-BASED CLASSIFICATION (with transcript or description)
    # ═══════════════════════════════════════════════════════════════════════

    # Build areas list
    areas_text = "\n".join([f"{a['id']}. {a['name_es']}" for a in areas])

    # Build topics list with IDs, grouped by area
    topics_by_area = {}
    for t in topics:
        area_id = t['area_id']
        if area_id not in topics_by_area:
            topics_by_area[area_id] = []
        topics_by_area[area_id].append(t)

    topics_text = ""
    for area in areas:
        area_topics = topics_by_area.get(area['id'], [])
        if area_topics:
            # Include topic IDs in the list so model knows which IDs to use
            topic_items = [f"{t['name_es']}(id:{t['id']})" for t in area_topics]
            topics_text += f"\n  Área {area['id']} ({area['name_es']}): {', '.join(topic_items)}"

    # Author context (dynamic profile)
    author_context = ""
    if author_history:
        area_counts = {}
        for h in author_history:
            area_name = h.get('area_name', 'Desconocido')
            area_counts[area_name] = area_counts.get(area_name, 0) + 1
        if area_counts:
            sorted_areas = sorted(area_counts.items(), key=lambda x: -x[1])
            author_context = f"\nContexto del autor @{author}: publica sobre "
            author_context += ", ".join([f"{a} ({c} videos)" for a, c in sorted_areas[:3]])

    # Tags context - add to prompt if available
    tags_context = ""
    if tags:
        tags_context = f"\nTags/Hashtags: {', '.join(tags[:12])}"

    # Build context from transcript or description
    if transcript:
        context = f"\nTranscripción: {transcript[:600]}..."
        classification_method = "llm_transcript"
    elif description and len(description) > 50:
        context = f"\nDescripción: {description[:400]}..."
        classification_method = "llm_description"
    else:
        context = ""
        classification_method = "llm_minimal"

    prompt = f"""Clasifica este video en UNA área y 1-3 topics de ESA MISMA área.

ÁREAS:
{areas_text}

TOPICS (usa los IDs entre paréntesis):{topics_text}
{author_context}
VIDEO:
Título: {title}
Autor: {author}{tags_context}{context}

IMPORTANTE: Los topic_ids DEBEN ser de la misma área que elegiste.

Responde SOLO con JSON válido:
{{"area_id": NUMBER, "topic_ids": [NUMBERS], "confidence": "alta" o "media" o "baja"}}"""

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 80}
                }
            )

            if response.status_code == 200:
                result = response.json()
                raw = result.get("response", "").strip()
                print(f"[Classify] Raw response: {raw[:200]}")

                # Try to parse JSON from response
                import json
                try:
                    # Fix common JSON issues: unquoted confidence value
                    fixed_raw = re.sub(r'"confidence":\s*(alta|media|baja)', r'"confidence": "\1"', raw)

                    # Find JSON in response
                    json_match = re.search(r'\{[^}]+\}', fixed_raw)
                    if json_match:
                        parsed = json.loads(json_match.group())

                        area_id = parsed.get("area_id")
                        topic_ids = parsed.get("topic_ids", [])
                        confidence_str = str(parsed.get("confidence", "media")).lower()

                        # Validate area_id
                        valid_area_ids = [a['id'] for a in areas]
                        if area_id not in valid_area_ids:
                            print(f"[Classify] Invalid area_id {area_id}, valid: {valid_area_ids}")
                            area_id = None

                        # Validate topic_ids - must belong to the selected area
                        if area_id:
                            valid_topic_ids_for_area = [t['id'] for t in topics if t['area_id'] == area_id]
                            topic_ids = [tid for tid in topic_ids if tid in valid_topic_ids_for_area]

                        # Map confidence string to float
                        confidence_map = {"alta": 0.9, "media": 0.6, "baja": 0.3}
                        confidence = confidence_map.get(confidence_str, 0.5)

                        print(f"[Classify] Result: area={area_id}, topics={topic_ids}, conf={confidence}, method={classification_method}")
                        return {
                            "area_id": area_id,
                            "topic_ids": topic_ids[:3],
                            "confidence": confidence,
                            "needs_review": confidence < 0.5,
                            "classification_method": classification_method
                        }
                except json.JSONDecodeError as e:
                    print(f"[Classify] JSON parse error: {e}, raw: {raw[:100]}")

        # Fallback - if LLM failed but we have tag signals, use them
        if classification_signals:
            combined = combine_classification_signals(classification_signals)
            if combined.get('area_id'):
                print(f"[Classify] LLM failed - fallback to tags: area={combined['area_id']}")
                return {
                    "area_id": combined['area_id'],
                    "topic_ids": [],
                    "confidence": combined['confidence'] * 0.8,  # Reduce confidence for fallback
                    "needs_review": True,
                    "classification_method": "tags_fallback"
                }

        # Final fallback - return None to indicate classification failed
        return {
            "area_id": None,
            "topic_ids": [],
            "confidence": 0.0,
            "needs_review": True,
            "classification_method": "failed"
        }
    except Exception as e:
        print(f"Classification error: {e}")
        return {
            "area_id": None,
            "topic_ids": [],
            "confidence": 0.0,
            "needs_review": True,
            "classification_method": "error"
        }


async def categorize_with_transcript(
    title: str,
    author: str,
    transcript: str,
    categories: list[str]
) -> str:
    """DEPRECATED: Use classify_with_new_taxonomy instead.
    Kept for backwards compatibility during migration."""
    import httpx

    tags_str = "ninguno"
    context = f"\n- Transcripción (fragmento): {transcript[:500]}..." if transcript else ""

    prompt = f"""Eres un clasificador de videos. Analiza el siguiente video y asígnale la categoría MÁS APROPIADA.

Categorías disponibles: {", ".join(categories)}

Video:
- Título: {title}
- Canal: {author}{context}

Instrucciones:
- Si habla de inversiones, bolsa, dinero, economía → Finanzas
- Si habla de herramientas, apps, IA, software → Tecnología
- Si es un tutorial o curso para aprender algo → Educación
- Si habla de productividad, gestión del tiempo, hábitos → Productividad
- Si habla de ejercicio, dieta, bienestar → Salud
- Si habla de emprendimiento, startups, empresas → Negocios
- Si habla de publicidad, ventas, redes sociales → Marketing
- Si habla de motivación, mentalidad, superación → Desarrollo Personal
- Si es humor, música, vlogs → Entretenimiento

Responde ÚNICAMENTE con el nombre de la categoría:"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 20}
                }
            )

            if response.status_code == 200:
                result = response.json()
                category = result.get("response", "Otros").strip().rstrip(".")
                for cat in categories:
                    if cat.lower() in category.lower():
                        return cat
        return "Otros"
    except Exception as e:
        print(f"Categorization error: {e}")
        return "Otros"


async def get_subcategories(
    title: str,
    author: str,
    main_category: str,
    transcript: Optional[str]
) -> list[str]:
    """Get subcategories using Ollama."""
    import httpx

    context = f"\n- Transcripción (fragmento): {transcript[:300]}..." if transcript else ""

    prompt = f"""Analiza este video y sugiere 2-3 subcategorías específicas dentro de "{main_category}".

Video:
- Título: {title}
- Canal: {author}{context}

Ejemplos de subcategorías:
- Finanzas: Inversiones, Ahorro, Criptomonedas, Impuestos, Presupuesto
- Tecnología: IA, Programación, Apps, Hardware, Tutoriales
- Productividad: GTD, Notion, Hábitos, Gestión del tiempo
- Salud: Nutrición, Ejercicio, Mentalidad, Recetas
- Educación: Idiomas, Matemáticas, Ciencias, Historia

Responde SOLO con las subcategorías separadas por comas (máximo 3):"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 50}
                }
            )

            if response.status_code == 200:
                result = response.json()
                raw = result.get("response", "").strip()
                subcats = [s.strip() for s in raw.split(",") if s.strip()]
                return subcats[:3]
        return []
    except Exception as e:
        print(f"Subcategories error: {e}")
        return []


async def get_author_history(author: str, supabase) -> list[dict]:
    """Get author's video history with areas for context."""
    try:
        result = supabase.table("videos").select(
            "id, area_id, areas(name_es)"
        ).eq("author", author).not_.is_("area_id", "null").limit(20).execute()

        history = []
        for v in result.data:
            if v.get('areas'):
                history.append({
                    "video_id": v['id'],
                    "area_id": v['area_id'],
                    "area_name": v['areas']['name_es']
                })
        return history
    except Exception as e:
        print(f"Error getting author history: {e}")
        return []


async def get_video_tags(video_id: int, supabase) -> list[str]:
    """Get tags for a video from video_tags table.

    Args:
        video_id: The video ID
        supabase: Supabase client

    Returns:
        List of tag names
    """
    try:
        result = supabase.table("video_tags").select(
            "tags(name)"
        ).eq("video_id", video_id).execute()

        tags = []
        for item in result.data:
            if item.get('tags') and item['tags'].get('name'):
                tags.append(item['tags']['name'])
        return tags
    except Exception as e:
        print(f"Error getting video tags: {e}")
        return []


async def process_single_video(
    video: dict,
    request: AIProcessRequest,
    category_map: dict,
    supabase,
    areas: list[dict] = None,
    topics: list[dict] = None
) -> dict:
    """Process a single video with subtitles/Whisper + Ollama.

    For YouTube: Downloads existing subtitles (much faster)
    For TikTok: Downloads audio and transcribes with Whisper

    Now uses new taxonomy (areas + topics) if areas/topics are provided.
    """
    result = {
        "video_id": video["id"],
        "youtube_id": video.get("youtube_id"),
        "title": video.get("title", ""),
        "transcribed": False,
        "summarized": False,
        "categorized": False,
        "source_type": "unknown",
        "transcript_method": None,
        "error": None
    }

    update_data = {}
    transcript = None
    video_url = video.get("url", "")
    video_id = video.get("youtube_id")

    # Detect if YouTube or TikTok
    is_youtube = is_youtube_video(video)
    result["source_type"] = "youtube" if is_youtube else "tiktok"

    # Step 1: Get transcript (different methods for YouTube vs TikTok)
    # If video already has transcript, use it (skip downloading audio)
    if video.get("transcript") and video.get("has_transcript"):
        transcript = video["transcript"]
        result["transcript_method"] = "existing"
        result["transcribed"] = True
        print(f"[AI Process] Using existing transcript ({len(transcript)} chars)")
    elif request.include_transcription:
        with tempfile.TemporaryDirectory() as tmpdir:
            if is_youtube:
                # YouTube: Try to download existing subtitles first (FAST!)
                print(f"[AI Process] YouTube video detected - trying subtitles first")
                transcript, upload_date = download_youtube_subtitles(video_url, tmpdir)

                if transcript:
                    result["transcript_method"] = "youtube_subtitles"
                    update_data["transcript"] = transcript
                    update_data["has_transcript"] = True
                    result["transcribed"] = True
                    print(f"[AI Process] Got YouTube subtitles ({len(transcript)} chars)")
                else:
                    # Fallback to Whisper if no subtitles available
                    print(f"[AI Process] No subtitles found, falling back to Whisper")

                    # Download audio for Whisper
                    audio_path = download_youtube_audio(video_url, tmpdir)

                    if audio_path and os.path.exists(audio_path):
                        transcript, trans_time = transcribe_audio(audio_path, request.whisper_model)

                        if transcript:
                            result["transcript_method"] = "whisper_fallback"
                            update_data["transcript"] = transcript
                            update_data["has_transcript"] = True
                            result["transcribed"] = True
                            result["transcription_time"] = trans_time

                # Save upload_date if we got it
                if upload_date and not video.get("upload_date"):
                    update_data["upload_date"] = upload_date

            else:
                # TikTok: Download audio and transcribe with Whisper
                if video_id:
                    audio_path, upload_date = download_tiktok_audio(video_url, video_id, tmpdir)

                    # Save upload_date if we got it
                    if upload_date and not video.get("upload_date"):
                        update_data["upload_date"] = upload_date

                    if audio_path and os.path.exists(audio_path):
                        transcript, trans_time = transcribe_audio(audio_path, request.whisper_model)

                        if transcript:
                            result["transcript_method"] = "whisper"
                            update_data["transcript"] = transcript
                            update_data["has_transcript"] = True
                            result["transcribed"] = True
                            result["transcription_time"] = trans_time

    # Fetch upload_date if video doesn't have it and we didn't get it during transcription
    if not video.get("upload_date") and "upload_date" not in update_data:
        if video_url:
            fetched_date = fetch_video_metadata(video_url)
            if fetched_date:
                update_data["upload_date"] = fetched_date

    # Step 2: Categorize video
    # Now supports classification even without transcript using tags/description
    should_categorize = request.include_categorization and (
        transcript or request.classify_without_transcript
    )

    if should_categorize:
        # Use new taxonomy if areas/topics are provided
        if areas and topics:
            # Get author history for context
            author_history = await get_author_history(video.get("author", ""), supabase)

            # Get video tags for classification
            video_tags = await get_video_tags(video["id"], supabase)
            if video_tags:
                print(f"[AI Process] Found {len(video_tags)} tags for classification")

            classification = await classify_with_new_taxonomy(
                video.get("title", ""),
                video.get("author", ""),
                transcript,  # Can be None - function handles it
                areas,
                topics,
                author_history,
                tags=video_tags,
                description=video.get("description")
            )

            if classification.get("area_id"):
                update_data["area_id"] = classification["area_id"]
                result["area_id"] = classification["area_id"]
                result["categorized"] = True
                result["confidence"] = classification.get("confidence", 0.0)
                result["needs_review"] = classification.get("needs_review", False)
                result["classification_method"] = classification.get("classification_method", "unknown")

                # Store topic associations
                result["topic_ids"] = classification.get("topic_ids", [])
        else:
            # Fallback to old category system (deprecated)
            category_names = list(category_map.values())
            new_category = await categorize_with_transcript(
                video.get("title", ""),
                video.get("author", ""),
                transcript,
                category_names
            )

            # Find category ID
            for cat_id, cat_name in category_map.items():
                if cat_name == new_category:
                    update_data["category_id"] = cat_id
                    result["category"] = new_category
                    result["categorized"] = True
                    break

    # Step 3: Generate summary and key points
    if request.include_summary and transcript:
        summary, key_points = await generate_summary_with_ollama(
            video.get("title", ""),
            transcript,
            extended=request.include_key_points
        )

        if summary:
            update_data["summary"] = summary
            result["summarized"] = True

        if key_points:
            update_data["key_points"] = key_points
            result["key_points_count"] = len(key_points)

    # Step 4: Get subcategories/topics
    subcategories = []
    topic_ids_to_save = result.get("topic_ids", [])

    # If using new taxonomy, topics are already in result["topic_ids"]
    # If using old taxonomy, get subcategories
    if not topic_ids_to_save and request.include_subcategories and transcript:
        current_category = result.get("category") or category_map.get(video.get("category_id"), "Otros")
        subcategories = await get_subcategories(
            video.get("title", ""),
            video.get("author", ""),
            current_category,
            transcript
        )
        result["subcategories"] = subcategories

    # Step 5: Update database
    if update_data:
        update_data["ai_processed_at"] = datetime.now().isoformat()

        try:
            supabase.table("videos").update(update_data).eq("id", video["id"]).execute()
        except Exception as e:
            result["error"] = f"DB update error: {str(e)}"

    # Step 6: Handle topics (new taxonomy) or subcategories (old taxonomy)
    if topic_ids_to_save:
        # New taxonomy: save to video_topics
        confidence = result.get("confidence", 0.6)
        needs_review = result.get("needs_review", False)

        for topic_id in topic_ids_to_save:
            try:
                supabase.table("video_topics").upsert({
                    "video_id": video["id"],
                    "topic_id": topic_id,
                    "confidence": confidence,
                    "needs_review": needs_review
                }, on_conflict="video_id,topic_id").execute()
            except Exception as e:
                print(f"Video-topic link error: {e}")

    elif subcategories:
        # Old taxonomy: save to subcategories (deprecated, kept for compatibility)
        category_id = update_data.get("category_id") or video.get("category_id")

        for subcat_name in subcategories:
            try:
                # Check if exists
                existing = supabase.table("subcategories").select("id").eq(
                    "name", subcat_name
                ).eq("category_id", category_id).execute()

                if existing.data:
                    subcat_id = existing.data[0]["id"]
                else:
                    # Create new
                    new_subcat = supabase.table("subcategories").insert({
                        "name": subcat_name,
                        "category_id": category_id
                    }).execute()
                    subcat_id = new_subcat.data[0]["id"] if new_subcat.data else None

                # Link video to subcategory
                if subcat_id:
                    try:
                        supabase.table("video_subcategories").insert({
                            "video_id": video["id"],
                            "subcategory_id": subcat_id
                        }).execute()
                    except:
                        pass  # Already linked
            except Exception as e:
                print(f"Subcategory error: {e}")

    return result


async def process_ai_job(job_id: str, request: AIProcessRequest):
    """Background task to process videos with AI."""
    from app.config import get_settings

    job = processing_jobs.get(job_id)
    if not job:
        return

    job["status"] = "running"
    job["started_at"] = datetime.now().isoformat()

    settings = get_settings()

    try:
        from supabase import create_client
        supabase = create_client(settings.supabase_url, settings.supabase_key)

        # Get categories (old taxonomy - for backwards compatibility)
        categories_response = supabase.table("categories").select("id, name").execute()
        category_map = {c["id"]: c["name"] for c in categories_response.data}

        # Get areas and topics (new taxonomy)
        areas_response = supabase.table("areas").select("*").order("sort_order").execute()
        areas = areas_response.data if areas_response.data else []

        topics_response = supabase.table("topics").select("*").execute()
        topics = topics_response.data if topics_response.data else []

        print(f"[AI PROCESS {job_id}] Loaded {len(areas)} areas and {len(topics)} topics")

        # Fetch all videos with pagination (Supabase default limit is 1000)
        all_videos = []
        page_size = 1000
        offset = 0

        while True:
            # Clone the query for each page
            page_query = supabase.table("videos").select(
                "id, youtube_id, title, author, url, category_id, area_id, transcript, has_transcript, summary, key_points"
            )

            # Re-apply filters
            if request.source == "youtube":
                youtube_sources = ["liked_videos", "playlist", "subscription", "LIKED_VIDEOS", "PLAYLIST", "SUBSCRIPTION"]
                page_query = page_query.in_("source", youtube_sources)
            elif request.source == "tiktok":
                page_query = page_query.in_("source", ["tiktok", "TIKTOK"])
            elif request.source in ["subscription", "liked_videos", "playlist", "curated_channel"]:
                # Specific source filter
                page_query = page_query.eq("source", request.source)

            # Filter by curated channel if specified
            if request.curated_channel_id:
                page_query = page_query.eq("curated_channel_id", request.curated_channel_id)

            if request.only_without_area:
                page_query = page_query.is_("area_id", "null")
            elif request.only_without_key_points:
                # Will filter in Python after fetch (array empty check doesn't work well in Supabase)
                pass
            elif request.only_without_summary:
                page_query = page_query.or_("summary.is.null,summary.eq.")
            elif request.skip_processed:
                page_query = page_query.or_("transcript.is.null,transcript.eq.")

            # Apply pagination
            page_query = page_query.range(offset, offset + page_size - 1)

            page_response = page_query.execute()
            page_data = page_response.data or []

            if not page_data:
                break

            all_videos.extend(page_data)
            print(f"[AI PROCESS {job_id}] Fetched {len(page_data)} videos (offset {offset}, total so far: {len(all_videos)})")

            if len(page_data) < page_size:
                break  # No more pages

            offset += page_size

        videos = all_videos

        # Apply Python-side filters for array fields (Supabase can't filter empty arrays well)
        if request.only_without_key_points:
            videos = [v for v in videos if not v.get("key_points")]
            print(f"[AI PROCESS {job_id}] Filtered to {len(videos)} videos without key_points")

        # Apply user limit if specified (after fetching all)
        if request.limit and len(videos) > request.limit:
            videos = videos[:request.limit]

        job["total_videos"] = len(videos)
        print(f"[AI PROCESS {job_id}] Found {len(videos)} videos to process (fetched {len(all_videos)} total)")

        if not videos:
            job["status"] = "completed"
            job["completed_at"] = datetime.now().isoformat()
            return

        start_time = time.time()

        for i, video in enumerate(videos):
            # Check for pause or cancel
            if job.get("status") in ("paused", "cancelled"):
                break

            job["current_video"] = f"{i+1}/{len(videos)} - {video.get('title', '')[:30]}..."

            try:
                result = await process_single_video(
                    video, request, category_map, supabase,
                    areas=areas, topics=topics
                )

                if result.get("transcribed"):
                    job["transcribed"] += 1
                if result.get("summarized"):
                    job["summarized"] += 1
                if result.get("categorized"):
                    job["categorized"] += 1
                if result.get("area_id"):
                    job["area_assigned"] += 1
                if result.get("key_points_count", 0) > 0:
                    job["key_points_added"] += 1
                if result.get("error"):
                    job["failed"] += 1
                    job["errors_list"].append(f"{video['id']}: {result['error']}")

            except Exception as e:
                job["failed"] += 1
                job["errors_list"].append(f"{video['id']}: {str(e)}")

            job["processed"] += 1

            # Calculate ETA
            elapsed = time.time() - start_time
            if job["processed"] > 0:
                avg_time = elapsed / job["processed"]
                remaining = len(videos) - job["processed"]
                job["eta_minutes"] = round((remaining * avg_time) / 60, 1)

            # Save progress periodically
            if (i + 1) % request.batch_size == 0:
                progress_file = RESULTS_DIR / f"{job_id}_progress.json"
                with open(progress_file, 'w') as f:
                    json.dump(job, f, indent=2)
                print(f"[AI PROCESS {job_id}] Progress: {job['processed']}/{job['total_videos']}")

            # Small delay between videos
            await asyncio.sleep(0.5)

        # Set final status (keep paused/cancelled if set, otherwise completed)
        if job["status"] not in ("paused", "cancelled"):
            job["status"] = "completed"
        job["completed_at"] = datetime.now().isoformat()
        job["current_video"] = None

        # Save final results
        results_file = RESULTS_DIR / f"{job_id}_results.json"
        with open(results_file, 'w') as f:
            json.dump(job, f, indent=2)

        print(f"[AI PROCESS {job_id}] Completed! {job['processed']} processed")

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = datetime.now().isoformat()
        print(f"[AI PROCESS {job_id}] Failed: {e}")


@router.post("/start", response_model=AIProcessJob)
async def start_ai_processing(request: AIProcessRequest, background_tasks: BackgroundTasks):
    """
    Start mass AI processing for videos.

    This endpoint:
    1. Downloads audio from TikTok videos (or uses existing transcript if available)
    2. Transcribes with Whisper (faster-whisper)
    3. Generates summary and key points with Ollama
    4. Classifies into areas and topics (new taxonomy)
    5. Creates video-topic associations

    Processing runs in background. Use /ai-process/status/{job_id} to check progress.

    Options:
    - source: Filter by source (tiktok, youtube, all)
    - include_transcription: Use Whisper for audio transcription
    - include_summary: Generate AI summary
    - include_key_points: Generate key points list
    - include_categorization: Re-categorize based on transcript (uses new taxonomy)
    - include_subcategories: Generate topic associations
    - whisper_model: Model size (tiny, base, small, medium)
    - limit: Limit number of videos (for testing)
    - skip_processed: Skip videos that already have transcript
    - only_without_area: Only process videos without area_id (for taxonomy migration)
    """
    import httpx

    # Check if Ollama is running
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            health = await client.get("http://localhost:11434/api/tags")
            if health.status_code != 200:
                raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")

    # Check if faster-whisper is installed
    if request.include_transcription:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="faster-whisper not installed. Run: pip install faster-whisper"
            )

    job_id = f"ai_process_{int(time.time())}"

    job = {
        "id": job_id,
        "status": "pending",
        "total_videos": 0,
        "processed": 0,
        "transcribed": 0,
        "summarized": 0,
        "categorized": 0,
        "failed": 0,
        "skipped": 0,
        "area_assigned": 0,
        "key_points_added": 0,
        "started_at": None,
        "completed_at": None,
        "eta_minutes": None,
        "current_video": None,
        "error": None,
        "errors_list": [],
    }

    processing_jobs[job_id] = job

    # Start background processing
    background_tasks.add_task(process_ai_job, job_id, request)

    return AIProcessJob(**job)


@router.get("/status/{job_id}", response_model=AIProcessJob)
async def get_ai_job_status(job_id: str):
    """Get status of an AI processing job."""
    if job_id not in processing_jobs:
        # Try to load from file
        results_file = RESULTS_DIR / f"{job_id}_results.json"
        if results_file.exists():
            with open(results_file) as f:
                data = json.load(f)
                return AIProcessJob(**data)
        raise HTTPException(status_code=404, detail="Job not found")

    return AIProcessJob(**processing_jobs[job_id])


@router.post("/pause/{job_id}")
async def pause_ai_job(job_id: str):
    """Pause a running AI processing job."""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]
    if job["status"] != "running":
        raise HTTPException(status_code=400, detail=f"Job is not running (status: {job['status']})")

    job["status"] = "paused"
    return {"message": "Job paused", "job": AIProcessJob(**job)}


@router.post("/cancel/{job_id}")
async def cancel_ai_job(job_id: str):
    """Cancel a running or paused AI processing job permanently."""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]
    if job["status"] == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed job")

    # Mark as cancelled - the processing loop will check this
    job["status"] = "cancelled"
    job["completed_at"] = datetime.now().isoformat()
    return {"message": "Job cancelled", "job": AIProcessJob(**job)}


@router.delete("/jobs/{job_id}")
async def delete_ai_job(job_id: str):
    """Delete a job from the list (only non-running jobs)."""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]
    if job["status"] == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running job. Cancel or pause it first.")

    del processing_jobs[job_id]
    return {"message": f"Job {job_id} deleted"}


@router.get("/jobs")
async def list_ai_jobs():
    """List all AI processing jobs (max 10 most recent)."""

    # Auto-cleanup: Remove old paused/cancelled jobs (older than 1 hour)
    cutoff = datetime.now().timestamp() - 3600  # 1 hour
    to_remove = []
    for job_id, job in processing_jobs.items():
        if job["status"] in ("paused", "cancelled", "completed"):
            try:
                completed_at = job.get("completed_at") or job.get("started_at")
                if completed_at:
                    job_time = datetime.fromisoformat(completed_at.replace("Z", "+00:00")).timestamp()
                    if job_time < cutoff:
                        to_remove.append(job_id)
            except:
                pass
    for job_id in to_remove:
        del processing_jobs[job_id]

    jobs = [AIProcessJob(**j) for j in processing_jobs.values()]

    # Also load completed jobs from files (but limit to recent ones)
    result_files = sorted(RESULTS_DIR.glob("ai_process_*_results.json"), reverse=True)[:10]
    for f in result_files:
        try:
            with open(f) as file:
                data = json.load(file)
                if data["id"] not in processing_jobs:
                    jobs.append(AIProcessJob(**data))
        except Exception as e:
            print(f"Error loading job file {f}: {e}")

    # Sort by start time and limit to 10 most recent
    sorted_jobs = sorted(jobs, key=lambda x: x.started_at or "", reverse=True)
    return sorted_jobs[:10]


@router.get("/health")
async def check_ai_health():
    """Check if all AI services are ready."""
    import httpx

    result = {
        "ollama": {"status": "unknown", "model": "llama3.2:3b"},
        "whisper": {"status": "unknown", "models": []},
        "yt_dlp": {"status": "unknown"},
    }

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                has_model = any("llama3" in name for name in model_names)
                result["ollama"] = {
                    "status": "ok" if has_model else "model_missing",
                    "model": "llama3.2:3b",
                    "available_models": model_names
                }
    except:
        result["ollama"]["status"] = "offline"

    # Check Whisper
    try:
        from faster_whisper import WhisperModel
        result["whisper"] = {
            "status": "ok",
            "models": ["tiny", "base", "small", "medium", "large"]
        }
    except ImportError:
        result["whisper"]["status"] = "not_installed"

    # Check yt-dlp
    try:
        proc = subprocess.run(["python3", "-m", "yt_dlp", "--version"], capture_output=True, timeout=5)
        if proc.returncode == 0:
            result["yt_dlp"] = {
                "status": "ok",
                "version": proc.stdout.decode().strip()
            }
    except:
        result["yt_dlp"]["status"] = "not_installed"

    all_ok = all(
        r.get("status") == "ok"
        for r in result.values()
    )

    return {
        "ready": all_ok,
        "services": result
    }


@router.post("/test/{video_id}")
async def test_single_video_process(video_id: int, whisper_model: str = "base"):
    """
    Test AI processing on a single video.
    Useful for debugging and testing before mass processing.
    Now uses new taxonomy (areas + topics).
    """
    from app.config import get_settings
    import httpx

    settings = get_settings()

    try:
        from supabase import create_client
        supabase = create_client(settings.supabase_url, settings.supabase_key)

        # Get video
        video_response = supabase.table("videos").select("*").eq("id", video_id).single().execute()

        if not video_response.data:
            raise HTTPException(status_code=404, detail="Video not found")

        video = video_response.data

        # Get categories (old taxonomy - for backwards compatibility)
        categories_response = supabase.table("categories").select("id, name").execute()
        category_map = {c["id"]: c["name"] for c in categories_response.data}

        # Get areas and topics (new taxonomy)
        areas_response = supabase.table("areas").select("*").order("sort_order").execute()
        areas = areas_response.data if areas_response.data else []

        topics_response = supabase.table("topics").select("*").execute()
        topics = topics_response.data if topics_response.data else []

        # Process
        request = AIProcessRequest(
            include_transcription=True,
            include_summary=True,
            include_key_points=True,
            include_categorization=True,
            include_subcategories=True,
            whisper_model=whisper_model
        )

        start_time = time.time()
        result = await process_single_video(
            video, request, category_map, supabase,
            areas=areas, topics=topics
        )
        elapsed = time.time() - start_time

        result["total_time_seconds"] = round(elapsed, 2)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYZE SELECTION ENDPOINT
# ============================================================================

class AnalyzeSelectionRequest(BaseModel):
    video_ids: List[int]
    mode: str = "extended"  # "light" (titles only) or "extended" (titles + summaries)


@router.post("/analyze-selection")
async def analyze_video_selection(request: AnalyzeSelectionRequest):
    """
    Analyze a selection of videos and return thematic analysis.
    - Light mode: Only uses titles + authors (fast, no prior processing needed)
    - Extended mode: Uses titles + summaries (more accurate, needs processed videos)
    """
    import httpx
    from supabase import create_client
    from app.config import get_settings

    settings = get_settings()
    supabase = create_client(settings.supabase_url, settings.supabase_key)

    if not request.video_ids:
        raise HTTPException(status_code=400, detail="No videos selected")

    if len(request.video_ids) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 videos per analysis")

    # Fetch video data
    all_videos = []
    chunk_size = 100

    for i in range(0, len(request.video_ids), chunk_size):
        chunk_ids = request.video_ids[i:i + chunk_size]
        response = supabase.table("videos").select(
            "id, title, author, summary, source, url"
        ).in_("id", chunk_ids).execute()

        if response.data:
            all_videos.extend(response.data)

    if not all_videos:
        raise HTTPException(status_code=404, detail="No videos found")

    # Create a map of video ID -> (short_title, url) for post-processing
    video_map = {}
    for v in all_videos:
        short_title = v['title'][:40] + "..." if len(v['title']) > 40 else v['title']
        video_map[str(v['id'])] = {
            'title': short_title,
            'url': v.get('url', '')
        }

    # Build context based on mode
    if request.mode == "light":
        # Light mode: only titles and authors
        video_list = "\n".join([
            f"- [{v['id']}] \"{v['title']}\" por {v['author'] or 'Desconocido'}"
            for v in all_videos
        ])

        prompt = f"""Analiza esta lista de {len(all_videos)} videos y proporciona un análisis temático detallado.

LISTA DE VIDEOS (solo títulos):
{video_list}

Proporciona un análisis en el siguiente formato:

## Temáticas Principales
Identifica las 3-5 temáticas principales que abarcan estos videos. Para cada temática:
- Nombre de la temática
- Breve descripción (1-2 oraciones)
- IDs de videos relacionados [ejemplo: 123, 456, 789]

## Subtemas Detectados
Lista de subtemas o nichos específicos dentro de las temáticas principales.

## Patrones y Tendencias
- Tipos de contenido predominantes
- Autores/creadores más frecuentes
- Observaciones sobre el conjunto

## Agrupaciones Sugeridas
Propón 3-5 grupos lógicos para organizar estos videos, con los IDs de cada grupo.

IMPORTANTE: Incluye siempre los IDs de los videos [entre corchetes] cuando los menciones para que el usuario pueda identificarlos."""

        num_predict = 1500

    else:
        # Extended mode: titles + summaries
        videos_with_summary = [v for v in all_videos if v.get('summary')]
        videos_without_summary = [v for v in all_videos if not v.get('summary')]

        video_list_parts = []

        for v in videos_with_summary:
            summary_text = v['summary'][:300] + "..." if len(v.get('summary', '')) > 300 else v.get('summary', '')
            video_list_parts.append(
                f"- [{v['id']}] \"{v['title']}\" por {v['author'] or 'Desconocido'}\n  Resumen: {summary_text}"
            )

        for v in videos_without_summary:
            video_list_parts.append(
                f"- [{v['id']}] \"{v['title']}\" por {v['author'] or 'Desconocido'} (sin resumen)"
            )

        video_list = "\n".join(video_list_parts)

        prompt = f"""Analiza esta lista de {len(all_videos)} videos ({len(videos_with_summary)} con resumen, {len(videos_without_summary)} solo título) y proporciona un análisis temático profundo.

LISTA DE VIDEOS:
{video_list[:12000]}

Proporciona un análisis detallado en el siguiente formato:

## Temáticas Principales
Identifica las 4-6 temáticas principales. Para cada una:
- **Nombre de la temática**
- Descripción detallada (2-3 oraciones)
- Relevancia/peso en el conjunto (alta/media/baja)
- Videos representativos: [IDs]

## Subtemas y Nichos
Lista detallada de subtemas específicos detectados, agrupados por temática principal.

## Análisis de Contenido
- Tipos de contenido predominantes (tutoriales, opinión, entretenimiento, educativo, etc.)
- Nivel de profundidad general (básico, intermedio, avanzado)
- Idioma predominante si es identificable

## Patrones y Tendencias
- Temas recurrentes
- Estilos de contenido
- Autores/creadores destacados

## Agrupaciones Sugeridas
Propón 4-6 grupos lógicos para organizar estos videos:
- **Nombre del grupo**: Descripción breve
  - Videos: [IDs]

## Resumen Ejecutivo
Párrafo de 3-4 oraciones resumiendo el conjunto de videos y sus características principales.

IMPORTANTE: Siempre incluye los IDs [entre corchetes] cuando menciones videos específicos."""

        num_predict = 2500

    # Call Ollama
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:  # 3 min timeout for large analyses
            start_time = time.time()

            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.4,
                        "num_predict": num_predict,
                    }
                }
            )

            elapsed = time.time() - start_time

            if response.status_code != 200:
                raise HTTPException(status_code=503, detail="Error calling Ollama")

            result = response.json()
            analysis = result.get("response", "").strip()

            # Post-process: replace [ID] with [Title](url) links
            def replace_video_ids(text: str, vmap: dict) -> str:
                import re
                # Match patterns like [6304] or [6304, 6305] or [6304], [6305]
                def replacer(match):
                    ids_str = match.group(1)
                    # Split by comma and process each ID
                    ids = [id.strip() for id in ids_str.split(',')]
                    links = []
                    for vid in ids:
                        vid = vid.strip('[] ')
                        if vid in vmap:
                            info = vmap[vid]
                            if info['url']:
                                links.append(f"[{info['title']}]({info['url']})")
                            else:
                                links.append(f"**{info['title']}**")
                        else:
                            links.append(f"[{vid}]")
                    return ', '.join(links)

                # Replace [number] or [number, number, ...]
                result = re.sub(r'\[(\d+(?:\s*,\s*\d+)*)\]', replacer, text)
                return result

            analysis_with_links = replace_video_ids(analysis, video_map)

            return {
                "analysis": analysis_with_links,
                "mode": request.mode,
                "video_count": len(all_videos),
                "videos_with_summary": len([v for v in all_videos if v.get('summary')]) if request.mode == "extended" else None,
                "processing_time_seconds": round(elapsed, 2)
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Analysis timed out. Try with fewer videos.")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")


# ============================================================================
# ENRICHMENT STATS ENDPOINT
# ============================================================================

class EnrichmentSourceStats(BaseModel):
    """Stats for a single source."""
    source: str
    total: int
    without_transcript: int
    without_area: int
    without_summary: int
    without_key_points: int
    without_topics: int  # Videos with area but no topics assigned


class EnrichmentChannelStats(BaseModel):
    """Stats for a curated channel."""
    channel_id: int
    channel_name: str
    total: int
    without_transcript: int
    without_area: int
    without_summary: int
    without_key_points: int


class EnrichmentStatsResponse(BaseModel):
    """Response with enrichment stats by source."""
    total_videos: int
    total_archived: int
    by_source: list[EnrichmentSourceStats]
    by_channel: list[EnrichmentChannelStats]  # Stats per curated channel
    # Global counts (non-archived only)
    global_without_transcript: int
    global_without_area: int
    global_without_summary: int
    global_without_key_points: int
    global_without_topics: int


@router.get("/enrichment-stats", response_model=EnrichmentStatsResponse)
async def get_enrichment_stats():
    """
    Get enrichment stats for all videos, broken down by source.
    Shows how many videos are missing each type of enrichment.
    Only counts non-archived videos.
    Optimized: uses minimal field selection and single pass processing.
    """
    from supabase import create_client
    from dotenv import load_dotenv

    # Load env
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)

    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Database not configured")

    supabase = create_client(supabase_url, supabase_key)

    try:
        # Fetch all videos with pagination (Supabase default limit is 1000)
        all_videos = []
        page_size = 1000
        offset = 0

        while True:
            response = supabase.table("videos").select(
                "id, source, transcript, area_id, summary, key_points, is_archived, curated_channel_id"
            ).range(offset, offset + page_size - 1).execute()

            if response.data:
                all_videos.extend(response.data)
                print(f"[Stats] Fetched {len(response.data)} videos (offset {offset}, total: {len(all_videos)})")

            if not response.data or len(response.data) < page_size:
                break
            offset += page_size

        # Filter out archived in Python (more reliable than Supabase or_ filter)
        archived_videos = [v for v in all_videos if v.get("is_archived") == True]
        active_videos = [v for v in all_videos if not v.get("is_archived")]
        archived_count = len(archived_videos)

        print(f"[Stats] Total: {len(all_videos)}, Active: {len(active_videos)}, Archived: {archived_count}")

        # Get videos with topics assigned (only IDs) - also paginate this
        all_video_topics = []
        offset = 0
        while True:
            vt_response = supabase.table("video_topics").select("video_id").range(offset, offset + page_size - 1).execute()
            if vt_response.data:
                all_video_topics.extend(vt_response.data)
            if not vt_response.data or len(vt_response.data) < page_size:
                break
            offset += page_size

        videos_with_topics = set(vt["video_id"] for vt in all_video_topics)

        # Single pass: group by source and calculate stats
        by_source: dict[str, dict] = defaultdict(lambda: {
            "total": 0, "without_transcript": 0, "without_area": 0,
            "without_summary": 0, "without_key_points": 0, "without_topics": 0
        })

        global_stats = {
            "without_transcript": 0, "without_area": 0,
            "without_summary": 0, "without_key_points": 0, "without_topics": 0
        }

        for v in active_videos:
            source = v.get("source") or "unknown"
            stats = by_source[source]
            stats["total"] += 1

            has_transcript = bool(v.get("transcript"))
            has_area = v.get("area_id") is not None
            has_summary = bool(v.get("summary"))
            has_key_points = bool(v.get("key_points"))
            has_topics = v["id"] in videos_with_topics

            if not has_transcript:
                stats["without_transcript"] += 1
                global_stats["without_transcript"] += 1
            if not has_area:
                stats["without_area"] += 1
                global_stats["without_area"] += 1
            if not has_summary:
                stats["without_summary"] += 1
                global_stats["without_summary"] += 1
            if not has_key_points:
                stats["without_key_points"] += 1
                global_stats["without_key_points"] += 1
            if has_area and not has_topics:
                stats["without_topics"] += 1
                global_stats["without_topics"] += 1

        # Build source stats response
        source_stats = [
            EnrichmentSourceStats(
                source=source,
                total=stats["total"],
                without_transcript=stats["without_transcript"],
                without_area=stats["without_area"],
                without_summary=stats["without_summary"],
                without_key_points=stats["without_key_points"],
                without_topics=stats["without_topics"],
            )
            for source, stats in sorted(by_source.items())
        ]

        # Calculate stats per curated channel
        by_channel: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "without_transcript": 0, "without_area": 0,
            "without_summary": 0, "without_key_points": 0
        })

        for v in active_videos:
            channel_id = v.get("curated_channel_id")
            if channel_id:
                ch_stats = by_channel[channel_id]
                ch_stats["total"] += 1
                if not v.get("transcript"):
                    ch_stats["without_transcript"] += 1
                if v.get("area_id") is None:
                    ch_stats["without_area"] += 1
                if not v.get("summary"):
                    ch_stats["without_summary"] += 1
                if not v.get("key_points"):
                    ch_stats["without_key_points"] += 1

        # Get channel names
        channel_names = {}
        if by_channel:
            ch_response = supabase.table("curated_channels").select("id, name").in_("id", list(by_channel.keys())).execute()
            channel_names = {ch["id"]: ch["name"] for ch in (ch_response.data or [])}

        channel_stats = [
            EnrichmentChannelStats(
                channel_id=ch_id,
                channel_name=channel_names.get(ch_id, f"Canal {ch_id}"),
                total=stats["total"],
                without_transcript=stats["without_transcript"],
                without_area=stats["without_area"],
                without_summary=stats["without_summary"],
                without_key_points=stats["without_key_points"],
            )
            for ch_id, stats in sorted(by_channel.items(), key=lambda x: x[1]["total"], reverse=True)
        ]

        return EnrichmentStatsResponse(
            total_videos=len(active_videos),
            total_archived=archived_count,
            by_source=source_stats,
            by_channel=channel_stats,
            global_without_transcript=global_stats["without_transcript"],
            global_without_area=global_stats["without_area"],
            global_without_summary=global_stats["without_summary"],
            global_without_key_points=global_stats["without_key_points"],
            global_without_topics=global_stats["without_topics"],
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
