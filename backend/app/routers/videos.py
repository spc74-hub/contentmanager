from fastapi import APIRouter, HTTPException
from supabase import create_client
from app.config import get_settings
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
settings = get_settings()

supabase = create_client(settings.supabase_url, settings.supabase_key)


class VideoCreate(BaseModel):
    youtube_id: Optional[str] = None
    title: str
    author: str
    summary: str
    duration: int
    likes: int
    url: str
    thumbnail: Optional[str] = None
    category_id: int


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    summary: Optional[str] = None
    duration: Optional[int] = None
    likes: Optional[int] = None
    url: Optional[str] = None
    thumbnail: Optional[str] = None
    category_id: Optional[int] = None


@router.get("/")
async def get_videos(category_id: Optional[int] = None, author: Optional[str] = None):
    """Get all videos with optional filters."""
    query = supabase.table("videos").select("*, categories(*)")

    if category_id:
        query = query.eq("category_id", category_id)
    if author:
        query = query.eq("author", author)

    response = query.order("created_at", desc=True).execute()
    return response.data


@router.get("/{video_id}")
async def get_video(video_id: int):
    """Get a single video by ID."""
    response = supabase.table("videos").select("*, categories(*)").eq("id", video_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data


@router.post("/")
async def create_video(video: VideoCreate):
    """Create a new video."""
    response = supabase.table("videos").insert(video.model_dump()).execute()
    return response.data[0]


@router.post("/bulk")
async def create_videos_bulk(videos: list[VideoCreate]):
    """Create multiple videos at once."""
    data = [v.model_dump() for v in videos]
    response = supabase.table("videos").insert(data).execute()
    return {"created": len(response.data)}


@router.put("/{video_id}")
async def update_video(video_id: int, video: VideoUpdate):
    """Update a video."""
    update_data = {k: v for k, v in video.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("videos").update(update_data).eq("id", video_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Video not found")
    return response.data[0]


@router.delete("/{video_id}")
async def delete_video(video_id: int):
    """Delete a video."""
    response = supabase.table("videos").delete().eq("id", video_id).execute()
    return {"deleted": True}


@router.post("/delete-bulk")
async def delete_videos_bulk(video_ids: list[int]):
    """Delete multiple videos at once."""
    deleted_count = 0
    for video_id in video_ids:
        try:
            supabase.table("videos").delete().eq("id", video_id).execute()
            deleted_count += 1
        except Exception:
            pass
    return {"deleted": deleted_count, "total": len(video_ids)}


@router.post("/fix-thumbnails")
async def fix_missing_thumbnails():
    """Fix missing thumbnails by generating from youtube_id."""
    # Get videos with null thumbnail - use is_ filter for null
    response = supabase.table("videos").select("id, youtube_id").is_("thumbnail", "null").execute()

    fixed_count = 0
    errors = []
    for video in response.data or []:
        youtube_id = video.get("youtube_id")

        if youtube_id:
            new_thumbnail = f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg"
            try:
                supabase.table("videos").update({
                    "thumbnail": new_thumbnail
                }).eq("id", video["id"]).execute()
                fixed_count += 1
            except Exception as e:
                errors.append(str(e))

    return {"fixed": fixed_count, "total_null": len(response.data or []), "errors": errors[:5]}


@router.get("/authors/list")
async def get_authors():
    """Get unique list of authors."""
    response = supabase.table("videos").select("author").execute()
    authors = list(set(v["author"] for v in response.data))
    authors.sort()
    return authors
