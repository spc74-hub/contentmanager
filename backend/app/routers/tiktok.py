"""
TikTok import from data export (JSON).

To get your TikTok data:
1. Go to TikTok Settings → Account → Download your data
2. Select JSON format
3. Wait for the email with download link
4. Upload the "Favorite Videos.json" or full export here
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import json
import yt_dlp

router = APIRouter()

executor = ThreadPoolExecutor(max_workers=3)


class TikTokVideo(BaseModel):
    id: str
    url: str
    title: str
    author: str
    date: Optional[str] = None
    thumbnail: Optional[str] = None
    duration_seconds: int = 0
    duration_formatted: str = "0:00"
    # Enriched data (from yt-dlp if available)
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    description: str = ""


class TikTokImportResponse(BaseModel):
    total: int
    videos: list[TikTokVideo]
    source: str


def format_duration(seconds: int) -> str:
    if seconds is None:
        return "0:00"
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"


def enrich_with_ytdlp(url: str, cookies_file: Optional[str] = None) -> Optional[dict]:
    """Try to get additional metadata from yt-dlp (may fail due to IP blocks)."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'view_count': info.get('view_count') or 0,
                'like_count': info.get('like_count') or 0,
                'comment_count': info.get('comment_count') or 0,
                'description': info.get('description') or '',
                'duration': info.get('duration') or 0,
                'thumbnail': info.get('thumbnail') or '',
            }
    except Exception as e:
        print(f"Could not enrich TikTok video: {e}")
        return None


@router.post("/import/favorites", response_model=TikTokImportResponse)
async def import_favorites(file: UploadFile = File(...)):
    """
    Import TikTok favorites from exported JSON file.

    Upload the "Favorite Videos.json" from your TikTok data export.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    videos = []

    # Handle different export formats
    # Format 1: Direct array of favorites
    if isinstance(data, list):
        favorites = data
    # Format 2: Nested in "FavoriteVideoList" (older format)
    elif "FavoriteVideoList" in data:
        favorites = data["FavoriteVideoList"]
    # Format 3: Activity → Favorite Videos (newer format)
    elif "Activity" in data and "Favorite Videos" in data["Activity"]:
        favorites = data["Activity"]["Favorite Videos"].get("FavoriteVideoList", [])
    else:
        raise HTTPException(
            status_code=400,
            detail="Could not find favorites in JSON. Expected 'FavoriteVideoList' or 'Activity.Favorite Videos'"
        )

    for item in favorites:
        # Extract video info from different possible formats
        video_url = item.get("Link") or item.get("link") or item.get("url") or ""
        date = item.get("Date") or item.get("date") or ""

        # Extract video ID from URL
        video_id = ""
        if "/video/" in video_url:
            video_id = video_url.split("/video/")[-1].split("?")[0]
        elif "v=" in video_url:
            video_id = video_url.split("v=")[-1].split("&")[0]

        # Extract author from URL or data
        author = ""
        if "/@" in video_url:
            author = video_url.split("/@")[1].split("/")[0]
        author = item.get("Author") or item.get("author") or author or "Unknown"

        videos.append(TikTokVideo(
            id=video_id,
            url=video_url,
            title=f"TikTok by @{author}",  # TikTok doesn't have titles
            author=author,
            date=date,
        ))

    return TikTokImportResponse(
        total=len(videos),
        videos=videos,
        source="tiktok_export"
    )


@router.post("/import/json", response_model=TikTokImportResponse)
async def import_from_json_export(file: UploadFile = File(...)):
    """
    Import from full TikTok data export JSON.

    This handles the complete export file that includes all your data.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    videos = []

    # Try to find favorites in various locations
    favorites = []

    if "Activity" in data:
        activity = data["Activity"]
        # Favorite Videos
        if "Favorite Videos" in activity:
            fav_data = activity["Favorite Videos"]
            if isinstance(fav_data, dict) and "FavoriteVideoList" in fav_data:
                favorites.extend(fav_data["FavoriteVideoList"])
            elif isinstance(fav_data, list):
                favorites.extend(fav_data)

        # Liked Videos (also useful)
        if "Like List" in activity:
            like_data = activity["Like List"]
            if isinstance(like_data, dict) and "ItemFavoriteList" in like_data:
                favorites.extend(like_data["ItemFavoriteList"])
            elif isinstance(like_data, list):
                favorites.extend(like_data)

    # Direct format
    if "FavoriteVideoList" in data:
        favorites.extend(data["FavoriteVideoList"])

    if not favorites:
        raise HTTPException(
            status_code=400,
            detail="No favorites found in export. Make sure you exported your data with 'Favorite Videos' included."
        )

    for item in favorites:
        video_url = item.get("Link") or item.get("link") or item.get("url") or ""
        date = item.get("Date") or item.get("date") or ""

        video_id = ""
        if "/video/" in video_url:
            video_id = video_url.split("/video/")[-1].split("?")[0]

        author = ""
        if "/@" in video_url:
            author = video_url.split("/@")[1].split("/")[0]
        author = item.get("Author") or item.get("author") or author or "Unknown"

        videos.append(TikTokVideo(
            id=video_id,
            url=video_url,
            title=f"TikTok by @{author}",
            author=author,
            date=date,
        ))

    return TikTokImportResponse(
        total=len(videos),
        videos=videos,
        source="tiktok_full_export"
    )


@router.post("/enrich")
async def enrich_videos(videos: list[TikTokVideo], use_cookies: bool = False):
    """
    Try to enrich TikTok videos with additional metadata using yt-dlp.

    Note: This may fail if your IP is blocked by TikTok.
    Use cookies for better success rate.
    """
    enriched = []

    for video in videos:
        loop = asyncio.get_event_loop()
        extra = await loop.run_in_executor(executor, enrich_with_ytdlp, video.url, None)

        if extra:
            video.view_count = extra.get('view_count', 0)
            video.like_count = extra.get('like_count', 0)
            video.comment_count = extra.get('comment_count', 0)
            video.description = extra.get('description', '')
            video.duration_seconds = extra.get('duration', 0)
            video.duration_formatted = format_duration(extra.get('duration', 0))
            video.thumbnail = extra.get('thumbnail', '')

        enriched.append(video)

    return {"enriched": len([v for v in enriched if v.view_count > 0]), "videos": enriched}
