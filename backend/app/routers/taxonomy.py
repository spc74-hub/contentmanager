"""
Taxonomy Management Router
CRUD for Areas, Topics, Tag Groups + Bulk Video Actions
"""

from fastapi import APIRouter, HTTPException
from supabase import create_client
from app.config import get_settings
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()
settings = get_settings()

supabase = create_client(settings.supabase_url, settings.supabase_key)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class AreaCreate(BaseModel):
    name: str
    name_es: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = 0


class AreaUpdate(BaseModel):
    name: Optional[str] = None
    name_es: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class TopicCreate(BaseModel):
    area_id: int
    name: str
    name_es: Optional[str] = None
    description: Optional[str] = None


class TopicUpdate(BaseModel):
    area_id: Optional[int] = None  # For moving topic to another area
    name: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None


class TagGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = 0


class TagGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class BulkVideoIds(BaseModel):
    video_ids: List[int]


class BulkAssignArea(BaseModel):
    video_ids: List[int]
    area_id: Optional[int]  # None to unassign


class BulkAssignTopic(BaseModel):
    video_ids: List[int]
    topic_id: int
    remove: bool = False  # True to remove instead of add


class MergeTags(BaseModel):
    source_tag_ids: List[int]
    target_tag_id: int


class CountsFilter(BaseModel):
    status: Optional[str] = "all"  # pending, validated, archived, all
    sources: Optional[List[str]] = None  # Filter by sources (include)
    exclude_sources: Optional[List[str]] = None  # Exclude sources
    search: Optional[str] = None  # Search in title
    area_id: Optional[int] = None  # Filter by area


# ============================================================================
# AREAS ENDPOINTS
# ============================================================================

@router.get("/areas")
async def get_areas():
    """Get all areas with video counts."""
    response = supabase.table("areas").select("*").order("sort_order").execute()
    return response.data


@router.get("/areas/{area_id}")
async def get_area(area_id: int):
    """Get a single area by ID."""
    response = supabase.table("areas").select("*").eq("id", area_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Area not found")
    return response.data


@router.post("/areas")
async def create_area(area: AreaCreate):
    """Create a new area."""
    response = supabase.table("areas").insert(area.model_dump()).execute()
    return response.data[0]


@router.put("/areas/{area_id}")
async def update_area(area_id: int, area: AreaUpdate):
    """Update an area."""
    update_data = {k: v for k, v in area.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("areas").update(update_data).eq("id", area_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Area not found")
    return response.data[0]


@router.delete("/areas/{area_id}")
async def delete_area(area_id: int, reassign_to: Optional[int] = None):
    """
    Delete an area.
    - reassign_to: if provided, reassign all videos to this area before deletion
    - if not provided, videos will have area_id set to NULL
    """
    # Check if area exists and get video count
    area = supabase.table("areas").select("*, video_count").eq("id", area_id).single().execute()
    if not area.data:
        raise HTTPException(status_code=404, detail="Area not found")

    video_count = area.data.get("video_count", 0)

    # Reassign videos if requested
    if reassign_to:
        supabase.table("videos").update({"area_id": reassign_to}).eq("area_id", area_id).execute()

    # Delete area (videos will have area_id set to NULL due to ON DELETE SET NULL)
    supabase.table("areas").delete().eq("id", area_id).execute()

    return {
        "deleted": True,
        "videos_affected": video_count,
        "reassigned_to": reassign_to
    }


# ============================================================================
# TOPICS ENDPOINTS
# ============================================================================

@router.get("/topics")
async def get_topics(area_id: Optional[int] = None):
    """Get all topics, optionally filtered by area."""
    query = supabase.table("topics").select("*, area:areas(*)")
    if area_id:
        query = query.eq("area_id", area_id)
    response = query.order("name").execute()
    return response.data


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: int):
    """Get a single topic by ID."""
    response = supabase.table("topics").select("*, area:areas(*)").eq("id", topic_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Topic not found")
    return response.data


@router.post("/topics")
async def create_topic(topic: TopicCreate):
    """Create a new topic."""
    # Verify area exists
    area = supabase.table("areas").select("id").eq("id", topic.area_id).single().execute()
    if not area.data:
        raise HTTPException(status_code=400, detail="Area not found")

    response = supabase.table("topics").insert(topic.model_dump()).execute()
    return response.data[0]


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: int, topic: TopicUpdate):
    """Update a topic (including moving to different area)."""
    update_data = {k: v for k, v in topic.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If changing area, verify new area exists
    if "area_id" in update_data:
        area = supabase.table("areas").select("id").eq("id", update_data["area_id"]).single().execute()
        if not area.data:
            raise HTTPException(status_code=400, detail="Target area not found")

    response = supabase.table("topics").update(update_data).eq("id", topic_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Topic not found")
    return response.data[0]


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int):
    """Delete a topic. Video-topic associations will be removed automatically."""
    # Get video count for this topic
    topic = supabase.table("topics").select("*, video_count").eq("id", topic_id).single().execute()
    if not topic.data:
        raise HTTPException(status_code=404, detail="Topic not found")

    video_count = topic.data.get("video_count", 0)

    # Delete topic (video_topics entries deleted via CASCADE)
    supabase.table("topics").delete().eq("id", topic_id).execute()

    return {
        "deleted": True,
        "videos_affected": video_count
    }


# ============================================================================
# TAG GROUPS ENDPOINTS
# ============================================================================

@router.get("/tag-groups")
async def get_tag_groups():
    """Get all tag groups with counts."""
    response = supabase.table("tag_groups").select("*").order("sort_order").execute()
    return response.data


@router.get("/tag-groups/{group_id}")
async def get_tag_group(group_id: int):
    """Get a single tag group by ID."""
    response = supabase.table("tag_groups").select("*").eq("id", group_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Tag group not found")
    return response.data


@router.get("/tag-groups/{group_id}/tags")
async def get_tags_by_group(group_id: int, limit: int = 100):
    """Get all tags in a specific group."""
    response = supabase.table("tags").select("*").eq("group_id", group_id).order("video_count", desc=True).limit(limit).execute()
    return response.data


@router.post("/tag-groups")
async def create_tag_group(group: TagGroupCreate):
    """Create a new tag group."""
    response = supabase.table("tag_groups").insert(group.model_dump()).execute()
    return response.data[0]


@router.put("/tag-groups/{group_id}")
async def update_tag_group(group_id: int, group: TagGroupUpdate):
    """Update a tag group."""
    update_data = {k: v for k, v in group.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("tag_groups").update(update_data).eq("id", group_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Tag group not found")
    return response.data[0]


@router.put("/tags/{tag_id}/group")
async def assign_tag_to_group(tag_id: int, group_id: Optional[int] = None):
    """Assign a tag to a group (or unassign if group_id is None)."""
    response = supabase.table("tags").update({"group_id": group_id}).eq("id", tag_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Tag not found")
    return response.data[0]


# ============================================================================
# BULK VIDEO ACTIONS
# ============================================================================

@router.post("/videos/bulk/archive")
async def bulk_archive_videos(data: BulkVideoIds):
    """Archive multiple videos."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    response = supabase.table("videos").update({"is_archived": True}).in_("id", data.video_ids).execute()
    return {"archived": len(response.data)}


@router.post("/videos/bulk/unarchive")
async def bulk_unarchive_videos(data: BulkVideoIds):
    """Unarchive multiple videos."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    response = supabase.table("videos").update({"is_archived": False}).in_("id", data.video_ids).execute()
    return {"unarchived": len(response.data)}


@router.post("/videos/bulk/validate")
async def bulk_validate_videos(data: BulkVideoIds):
    """Mark multiple videos as validated."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    response = supabase.table("videos").update({
        "is_validated": True,
        "validated_at": datetime.utcnow().isoformat()
    }).in_("id", data.video_ids).execute()
    return {"validated": len(response.data)}


@router.post("/videos/bulk/unvalidate")
async def bulk_unvalidate_videos(data: BulkVideoIds):
    """Remove validation from multiple videos."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    response = supabase.table("videos").update({
        "is_validated": False,
        "validated_at": None
    }).in_("id", data.video_ids).execute()
    return {"unvalidated": len(response.data)}


@router.post("/videos/bulk/assign-area")
async def bulk_assign_area(data: BulkAssignArea):
    """Assign multiple videos to an area."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    # Verify area exists if provided
    if data.area_id:
        area = supabase.table("areas").select("id").eq("id", data.area_id).single().execute()
        if not area.data:
            raise HTTPException(status_code=400, detail="Area not found")

    response = supabase.table("videos").update({"area_id": data.area_id}).in_("id", data.video_ids).execute()
    return {"updated": len(response.data), "area_id": data.area_id}


@router.post("/videos/bulk/assign-topic")
async def bulk_assign_topic(data: BulkAssignTopic):
    """Add or remove a topic from multiple videos."""
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")

    # Verify topic exists
    topic = supabase.table("topics").select("id, area_id").eq("id", data.topic_id).single().execute()
    if not topic.data:
        raise HTTPException(status_code=400, detail="Topic not found")

    if data.remove:
        # Remove topic from videos
        for video_id in data.video_ids:
            supabase.table("video_topics").delete().eq("video_id", video_id).eq("topic_id", data.topic_id).execute()
        return {"removed": len(data.video_ids), "topic_id": data.topic_id}
    else:
        # Add topic to videos (upsert to avoid duplicates)
        inserted = 0
        for video_id in data.video_ids:
            try:
                supabase.table("video_topics").insert({
                    "video_id": video_id,
                    "topic_id": data.topic_id
                }).execute()
                inserted += 1
            except Exception:
                # Already exists, skip
                pass

        # Also update video's area_id to match topic's area
        supabase.table("videos").update({"area_id": topic.data["area_id"]}).in_("id", data.video_ids).execute()

        return {"added": inserted, "topic_id": data.topic_id, "area_id": topic.data["area_id"]}


# ============================================================================
# SINGLE VIDEO STATUS ACTIONS
# ============================================================================

@router.put("/videos/{video_id}/archive")
async def archive_video(video_id: int):
    """Archive a single video."""
    response = supabase.table("videos").update({"is_archived": True}).eq("id", video_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data[0]


@router.put("/videos/{video_id}/unarchive")
async def unarchive_video(video_id: int):
    """Unarchive a single video."""
    response = supabase.table("videos").update({"is_archived": False}).eq("id", video_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data[0]


@router.put("/videos/{video_id}/validate")
async def validate_video(video_id: int):
    """Validate a single video."""
    response = supabase.table("videos").update({
        "is_validated": True,
        "validated_at": datetime.utcnow().isoformat()
    }).eq("id", video_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data[0]


@router.put("/videos/{video_id}/area")
async def update_video_area(video_id: int, area_id: Optional[int] = None):
    """Update a video's area."""
    if area_id:
        area = supabase.table("areas").select("id").eq("id", area_id).single().execute()
        if not area.data:
            raise HTTPException(status_code=400, detail="Area not found")

    response = supabase.table("videos").update({"area_id": area_id}).eq("id", video_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data[0]


# ============================================================================
# TAG MERGE
# ============================================================================

@router.post("/tags/merge")
async def merge_tags(data: MergeTags):
    """
    Merge multiple tags into one.
    - All video_tags referencing source tags will point to target tag
    - Source tags will be deleted
    - Target tag's video_count will be recalculated
    """
    if not data.source_tag_ids:
        raise HTTPException(status_code=400, detail="No source tag IDs provided")

    if data.target_tag_id in data.source_tag_ids:
        raise HTTPException(status_code=400, detail="Target tag cannot be in source tags")

    # Verify target exists
    target = supabase.table("tags").select("*").eq("id", data.target_tag_id).single().execute()
    if not target.data:
        raise HTTPException(status_code=400, detail="Target tag not found")

    merged_count = 0

    for source_id in data.source_tag_ids:
        # Get all video_tags for source
        video_tags = supabase.table("video_tags").select("video_id").eq("tag_id", source_id).execute()

        for vt in video_tags.data:
            video_id = vt["video_id"]
            # Check if target already has this video
            existing = supabase.table("video_tags").select("*").eq("video_id", video_id).eq("tag_id", data.target_tag_id).execute()

            if not existing.data:
                # Add to target
                try:
                    supabase.table("video_tags").insert({
                        "video_id": video_id,
                        "tag_id": data.target_tag_id
                    }).execute()
                    merged_count += 1
                except Exception:
                    pass

        # Delete source tag (CASCADE will remove video_tags)
        supabase.table("tags").delete().eq("id", source_id).execute()

    # Recalculate target video_count
    new_count = supabase.table("video_tags").select("*", count="exact").eq("tag_id", data.target_tag_id).execute()
    supabase.table("tags").update({"video_count": new_count.count}).eq("id", data.target_tag_id).execute()

    return {
        "merged": len(data.source_tag_ids),
        "new_videos_added": merged_count,
        "target_tag_id": data.target_tag_id,
        "new_video_count": new_count.count
    }


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/stats")
async def get_taxonomy_stats():
    """Get taxonomy statistics for dashboard."""
    # Video status counts
    total = supabase.table("videos").select("*", count="exact").execute()
    archived = supabase.table("videos").select("*", count="exact").eq("is_archived", True).execute()
    validated = supabase.table("videos").select("*", count="exact").eq("is_validated", True).eq("is_archived", False).execute()
    pending = supabase.table("videos").select("*", count="exact").eq("is_validated", False).eq("is_archived", False).execute()

    # Area/Topic counts
    areas = supabase.table("areas").select("*", count="exact").execute()
    topics = supabase.table("topics").select("*", count="exact").execute()

    # Videos without area
    no_area = supabase.table("videos").select("*", count="exact").is_("area_id", "null").eq("is_archived", False).execute()

    return {
        "videos": {
            "total": total.count,
            "archived": archived.count,
            "validated": validated.count,
            "pending": pending.count,
            "no_area": no_area.count
        },
        "taxonomy": {
            "areas": areas.count,
            "topics": topics.count
        }
    }


# ============================================================================
# FILTERED COUNTS ENDPOINT
# ============================================================================

@router.post("/counts")
async def get_filtered_counts(filters: CountsFilter):
    """
    Get video counts per area and tag group with applied filters.
    Used for dynamic sidebar updates when filtering videos.
    """
    # Build base query conditions
    # We need to do raw counts since Supabase client doesn't support GROUP BY directly

    # First, get all video IDs that match the filters
    query = supabase.table("videos").select("id, area_id")

    # Apply status filter
    if filters.status == "pending":
        query = query.eq("is_validated", False).eq("is_archived", False)
    elif filters.status == "validated":
        query = query.eq("is_validated", True).eq("is_archived", False)
    elif filters.status == "archived":
        query = query.eq("is_archived", True)
    else:
        # "all" = exclude archived by default (same as frontend)
        query = query.eq("is_archived", False)

    # Apply source filters
    if filters.sources:
        query = query.in_("source", filters.sources)
    if filters.exclude_sources:
        for source in filters.exclude_sources:
            query = query.neq("source", source)

    # Apply search filter
    if filters.search:
        query = query.ilike("title", f"%{filters.search}%")

    # Apply area filter
    if filters.area_id:
        query = query.eq("area_id", filters.area_id)

    # Fetch all matching videos with pagination
    all_videos = []
    page_size = 1000
    offset = 0

    while True:
        page_query = supabase.table("videos").select("id, area_id")

        # Re-apply filters for each page
        if filters.status == "pending":
            page_query = page_query.eq("is_validated", False).eq("is_archived", False)
        elif filters.status == "validated":
            page_query = page_query.eq("is_validated", True).eq("is_archived", False)
        elif filters.status == "archived":
            page_query = page_query.eq("is_archived", True)
        else:
            # "all" = exclude archived by default
            page_query = page_query.eq("is_archived", False)

        if filters.sources:
            page_query = page_query.in_("source", filters.sources)
        if filters.exclude_sources:
            for source in filters.exclude_sources:
                page_query = page_query.neq("source", source)

        if filters.search:
            page_query = page_query.ilike("title", f"%{filters.search}%")

        if filters.area_id:
            page_query = page_query.eq("area_id", filters.area_id)

        page_query = page_query.range(offset, offset + page_size - 1)
        response = page_query.execute()

        if not response.data:
            break

        all_videos.extend(response.data)

        if len(response.data) < page_size:
            break

        offset += page_size

    # Count by area
    area_counts = {}
    video_ids = []
    for video in all_videos:
        video_ids.append(video["id"])
        area_id = video.get("area_id")
        if area_id:
            area_counts[area_id] = area_counts.get(area_id, 0) + 1
        else:
            area_counts[None] = area_counts.get(None, 0) + 1

    # Get tag counts for these videos
    tag_group_counts = {}
    tag_counts = {}

    if video_ids:
        # Fetch video_tags for filtered videos (with pagination)
        all_video_tags = []

        # Split video_ids into chunks if needed (Supabase has limits on IN clause)
        chunk_size = 200  # Smaller chunks to avoid issues
        for i in range(0, len(video_ids), chunk_size):
            chunk_ids = video_ids[i:i + chunk_size]

            # Paginate results for each chunk (Supabase default limit is 1000)
            vt_offset = 0
            vt_page_size = 1000
            while True:
                vt_response = supabase.table("video_tags").select(
                    "video_id, tag_id, tags(id, name, group_id)"
                ).in_("video_id", chunk_ids).range(vt_offset, vt_offset + vt_page_size - 1).execute()

                if vt_response.data:
                    all_video_tags.extend(vt_response.data)

                if not vt_response.data or len(vt_response.data) < vt_page_size:
                    break

                vt_offset += vt_page_size

        # Count UNIQUE videos per tag and tag_group
        # Use sets to track which videos we've counted for each group
        videos_per_tag_group = {}  # tag_group_id -> set of video_ids
        videos_per_tag = {}  # tag_id -> set of video_ids

        for vt in all_video_tags:
            video_id = vt.get("video_id")
            tag_info = vt.get("tags")
            if tag_info and video_id:
                tag_id = tag_info["id"]
                tag_group_id = tag_info.get("group_id")

                # Track unique videos per tag
                if tag_id not in videos_per_tag:
                    videos_per_tag[tag_id] = set()
                videos_per_tag[tag_id].add(video_id)

                # Track unique videos per tag group
                if tag_group_id:
                    if tag_group_id not in videos_per_tag_group:
                        videos_per_tag_group[tag_group_id] = set()
                    videos_per_tag_group[tag_group_id].add(video_id)

        # Convert sets to counts
        tag_counts = {tag_id: len(video_set) for tag_id, video_set in videos_per_tag.items()}
        tag_group_counts = {group_id: len(video_set) for group_id, video_set in videos_per_tag_group.items()}

    return {
        "total_videos": len(all_videos),
        "area_counts": area_counts,
        "tag_group_counts": tag_group_counts,
        "tag_counts": tag_counts
    }
