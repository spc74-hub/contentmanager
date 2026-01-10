"""
yt-dlp based scraping for YouTube metadata.
NO API quota - completely free!
"""
import asyncio
import csv
import io
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import yt_dlp
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

router = APIRouter()

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Thread pool for running yt-dlp (it's blocking)
# Increased to 5 workers to handle more concurrent requests
executor = ThreadPoolExecutor(max_workers=5)

# Job management for cancellation support
# Stores active job IDs and their cancellation status
active_jobs: dict[str, dict] = {}  # job_id -> {"status": "running"|"cancelled"|"completed", "type": str, "progress": str, "started_at": str}

def register_job(job_id: str, job_type: str) -> None:
    """Register a new active job."""
    active_jobs[job_id] = {
        "status": "running",
        "type": job_type,
        "progress": "0%",
        "started_at": datetime.utcnow().isoformat()
    }

def update_job_progress(job_id: str, progress: str) -> None:
    """Update job progress."""
    if job_id in active_jobs:
        active_jobs[job_id]["progress"] = progress

def is_job_cancelled(job_id: str) -> bool:
    """Check if a job has been cancelled."""
    return active_jobs.get(job_id, {}).get("status") == "cancelled"

def complete_job(job_id: str) -> None:
    """Mark a job as completed and remove it after a delay."""
    if job_id in active_jobs:
        active_jobs[job_id]["status"] = "completed"
        # Clean up after 5 minutes
        # In production, you'd use a proper scheduler

def cancel_job(job_id: str) -> bool:
    """Cancel a job by ID."""
    if job_id in active_jobs and active_jobs[job_id]["status"] == "running":
        active_jobs[job_id]["status"] = "cancelled"
        return True
    return False


class VideoMetadata(BaseModel):
    id: str
    title: str
    author: str
    channel_id: str
    description: str
    duration_seconds: int
    duration_formatted: str
    view_count: int
    like_count: int
    comment_count: Optional[int]
    upload_date: str
    thumbnail: str
    url: str
    tags: list[str]
    categories: list[str]
    transcript: Optional[str] = None  # YouTube subtitles/transcript
    has_transcript: bool = False


class PlaylistInfo(BaseModel):
    id: str
    title: str
    channel: str
    video_count: int
    videos: list[VideoMetadata]


class ScrapeRequest(BaseModel):
    url: str
    extract_full_metadata: bool = True  # If False, only basic info (faster)
    use_cookies: bool = False  # Use browser cookies for private playlists
    browser: str = "chrome"  # Browser to get cookies from: chrome, firefox, safari, edge
    extract_transcript: bool = False  # Extract YouTube subtitles/transcript


def format_duration(seconds: int) -> str:
    """Convert seconds to HH:MM:SS or MM:SS format."""
    if seconds is None:
        return "0:00"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def extract_transcript_from_subtitles(info: dict) -> Optional[str]:
    """Extract transcript text from YouTube subtitles."""
    subtitles = info.get('subtitles', {})
    automatic_captions = info.get('automatic_captions', {})

    # Priority: manual Spanish > manual English > auto Spanish > auto English
    for lang in ['es', 'en', 'es-ES', 'en-US']:
        if lang in subtitles:
            return f"[manual:{lang}]"  # Marker for later download
        if lang in automatic_captions:
            return f"[auto:{lang}]"  # Marker for later download

    return None


def get_subtitle_text(video_id: str, lang_marker: str) -> Optional[str]:
    """Download and extract text from subtitles."""
    import tempfile
    import os
    import json

    is_auto = lang_marker.startswith("[auto:")
    lang = lang_marker.split(":")[1].rstrip("]")

    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'writesubtitles': not is_auto,
            'writeautomaticsub': is_auto,
            'subtitleslangs': [lang],
            'subtitlesformat': 'json3',
            'outtmpl': os.path.join(tmpdir, '%(id)s.%(ext)s'),
        }

        url = f"https://www.youtube.com/watch?v={video_id}"

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            # Find the subtitle file
            for filename in os.listdir(tmpdir):
                if filename.endswith('.json3'):
                    filepath = os.path.join(tmpdir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # Extract text from json3 format
                    texts = []
                    for event in data.get('events', []):
                        for seg in event.get('segs', []):
                            text = seg.get('utf8', '').strip()
                            if text and text != '\n':
                                texts.append(text)

                    transcript = ' '.join(texts)
                    # Limit to ~15000 chars (~10-15 min of speech)
                    # This balances API efficiency with content coverage
                    return transcript[:15000] if transcript else None
        except Exception as e:
            print(f"Error extracting subtitles: {e}")
            return None

    return None


def extract_video_metadata(info: dict, include_transcript: bool = False) -> VideoMetadata:
    """Extract relevant metadata from yt-dlp info dict."""
    duration = info.get('duration') or 0

    # Check for available subtitles
    transcript_marker = extract_transcript_from_subtitles(info)
    has_transcript = transcript_marker is not None

    # Optionally download full transcript
    transcript = None
    if include_transcript and has_transcript:
        transcript = get_subtitle_text(info.get('id', ''), transcript_marker)

    # Handle None values for required string fields
    author = info.get('channel') or info.get('uploader') or 'Desconocido'
    channel_id = info.get('channel_id') or ''
    video_id = info.get('id') or ''

    return VideoMetadata(
        id=video_id,
        title=info.get('title') or 'Sin título',
        author=author,
        channel_id=channel_id,
        description=(info.get('description') or '')[:1000],
        duration_seconds=duration,
        duration_formatted=format_duration(duration),
        view_count=info.get('view_count') or 0,
        like_count=info.get('like_count') or 0,
        comment_count=info.get('comment_count'),
        upload_date=info.get('upload_date') or '',
        thumbnail=info.get('thumbnail') or '',
        url=info.get('webpage_url') or f"https://www.youtube.com/watch?v={video_id}",
        tags=info.get('tags') or [],
        categories=info.get('categories') or [],
        transcript=transcript,
        has_transcript=has_transcript
    )


def scrape_playlist_sync(url: str, extract_full: bool = True, use_cookies: bool = False, browser: str = "chrome") -> dict:
    """Synchronous function to scrape playlist with yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': not extract_full,  # If True, only get basic info (faster)
        'ignoreerrors': True,  # Skip private/deleted videos
    }

    # Add browser cookies for private playlists
    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info


def scrape_video_sync(url: str) -> dict:
    """Synchronous function to scrape single video with yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info


# ============================================================================
# JOB MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/jobs")
async def list_active_jobs():
    """
    List all active and recent jobs.
    Returns jobs that are running, cancelled, or recently completed.
    """
    # Clean up old completed jobs (older than 5 minutes)
    cutoff = datetime.utcnow().timestamp() - 300  # 5 minutes
    to_remove = []
    for job_id, job in active_jobs.items():
        if job["status"] == "completed":
            try:
                job_time = datetime.fromisoformat(job["started_at"]).timestamp()
                if job_time < cutoff:
                    to_remove.append(job_id)
            except:
                pass
    for job_id in to_remove:
        del active_jobs[job_id]

    return {
        "jobs": [
            {"id": job_id, **job}
            for job_id, job in active_jobs.items()
        ],
        "total": len(active_jobs),
        "running": sum(1 for j in active_jobs.values() if j["status"] == "running")
    }


@router.post("/jobs/{job_id}/cancel")
async def cancel_active_job(job_id: str):
    """
    Cancel a running job by ID.
    The job will stop at the next checkpoint.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if active_jobs[job_id]["status"] != "running":
        return {
            "success": False,
            "message": f"Job {job_id} is not running (status: {active_jobs[job_id]['status']})"
        }

    cancel_job(job_id)
    return {
        "success": True,
        "message": f"Job {job_id} marked for cancellation. It will stop at the next checkpoint."
    }


@router.delete("/jobs/{job_id}")
async def remove_job(job_id: str):
    """
    Remove a job from the tracking list.
    Only works for completed or cancelled jobs.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if active_jobs[job_id]["status"] == "running":
        raise HTTPException(status_code=400, detail="Cannot remove a running job. Cancel it first.")

    del active_jobs[job_id]
    return {"success": True, "message": f"Job {job_id} removed"}


@router.post("/video", response_model=VideoMetadata)
async def scrape_video(request: ScrapeRequest):
    """
    Scrape metadata for a single YouTube video.
    NO API quota used!
    """
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, scrape_video_sync, request.url)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        return extract_video_metadata(info, include_transcript=request.extract_transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping video: {str(e)}")


@router.post("/playlist", response_model=PlaylistInfo)
async def scrape_playlist(request: ScrapeRequest):
    """
    Scrape all videos from a YouTube playlist.
    NO API quota used!

    Set extract_full_metadata=False for faster results (only basic info).
    """
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(
            executor,
            lambda: scrape_playlist_sync(request.url, request.extract_full_metadata, request.use_cookies, request.browser)
        )

        if not info:
            raise HTTPException(status_code=404, detail="Playlist not found")

        videos = []
        entries = info.get('entries', [])

        for entry in entries:
            if entry is None:  # Skipped video (private/deleted)
                continue

            if request.extract_full_metadata:
                videos.append(extract_video_metadata(entry, include_transcript=request.extract_transcript))
            else:
                # Basic info only (from flat extraction)
                video_id = entry.get('id') or ''
                author = entry.get('channel') or entry.get('uploader') or 'Desconocido'
                videos.append(VideoMetadata(
                    id=video_id,
                    title=entry.get('title') or 'Sin título',
                    author=author,
                    channel_id=entry.get('channel_id') or '',
                    description='',
                    duration_seconds=entry.get('duration') or 0,
                    duration_formatted=format_duration(entry.get('duration') or 0),
                    view_count=entry.get('view_count') or 0,
                    like_count=0,  # Not available in flat mode
                    comment_count=None,
                    upload_date=entry.get('upload_date') or '',
                    thumbnail=entry.get('thumbnail') or '',
                    url=entry.get('url') or f"https://www.youtube.com/watch?v={video_id}",
                    tags=[],
                    categories=[],
                    transcript=None,
                    has_transcript=False
                ))

        return PlaylistInfo(
            id=info.get('id', ''),
            title=info.get('title', 'Playlist'),
            channel=info.get('channel', info.get('uploader', '')),
            video_count=len(videos),
            videos=videos
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping playlist: {str(e)}")


@router.get("/test/{video_id}")
async def test_scrape(video_id: str):
    """
    Quick test endpoint - scrape a single video by ID.
    Example: /api/scraper/test/dQw4w9WgXcQ
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, scrape_video_sync, url)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        return extract_video_metadata(info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/transcript/{video_id}")
async def get_transcript(video_id: str):
    """
    Get transcript/subtitles for a specific video.
    Returns the text content from YouTube subtitles.
    Example: /api/scraper/transcript/dQw4w9WgXcQ
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, scrape_video_sync, url)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        # Check for available subtitles
        transcript_marker = extract_transcript_from_subtitles(info)
        if not transcript_marker:
            return {
                "video_id": video_id,
                "has_transcript": False,
                "transcript": None,
                "message": "No subtitles available for this video"
            }

        # Download and extract transcript
        transcript = await loop.run_in_executor(
            executor,
            lambda: get_subtitle_text(video_id, transcript_marker)
        )

        return {
            "video_id": video_id,
            "has_transcript": True,
            "transcript": transcript,
            "source": "manual" if "manual" in transcript_marker else "auto"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ============================================================================
# SUBSCRIPTION IMPORTS - Import videos from YouTube subscriptions
# ============================================================================

class ChannelInfo(BaseModel):
    """Information about a subscribed channel."""
    channel_id: str
    channel_name: str
    channel_url: str
    thumbnail: Optional[str] = None
    video_count: int = 0  # Number of videos found in the feed


class SubscriptionChannelsRequest(BaseModel):
    """Request to get list of subscribed channels."""
    use_cookies: bool = True
    browser: str = "chrome"


class SubscriptionChannelsResponse(BaseModel):
    """Response with list of subscribed channels."""
    channels: list[ChannelInfo]
    total_channels: int
    total_videos_in_feed: int


class ChannelVideosRequest(BaseModel):
    """Request to get videos from selected channels."""
    channel_ids: list[str]
    videos_per_channel: int = 10
    use_cookies: bool = True
    browser: str = "chrome"
    extract_full_metadata: bool = False
    extract_transcript: bool = False


class ChannelVideosResponse(BaseModel):
    """Response with videos from the selected channels."""
    videos: list[VideoMetadata]
    total_videos: int
    channels_processed: int
    channels_failed: list[str] = []
    processing_time_seconds: float


def get_subscription_feed_sync(use_cookies: bool = True, browser: str = "chrome", max_videos: int = 50) -> list[dict]:
    """Synchronous function to get subscription feed with yt-dlp.

    Returns list of video info dicts with full channel information.

    Note: Uses full extraction (not flat) to get channel info, which is slower
    but necessary since flat mode doesn't include channel data for subscription feeds.

    Args:
        max_videos: Limit videos to read from feed (default 50 for reasonable speed).
                   Each video takes ~2-3 seconds to process.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,  # Need full extraction for channel info
        'ignoreerrors': True,
    }

    if max_videos > 0:
        ydl_opts['playlistend'] = max_videos

    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    url = "https://www.youtube.com/feed/subscriptions"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            return []
        entries = info.get('entries', [])
        # Filter out None entries (failed extractions)
        return [e for e in entries if e is not None]


def get_channel_videos_sync(
    channel_url: str,
    max_videos: int = 10,
    use_cookies: bool = True,
    browser: str = "chrome",
    extract_full: bool = False
) -> list[dict]:
    """Synchronous function to get videos from a channel."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': not extract_full,
        'ignoreerrors': True,
        'playlistend': max_videos,
    }

    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)
        return info.get('entries', []) if info else []


@router.post("/subscriptions/channels", response_model=SubscriptionChannelsResponse)
async def get_subscription_channels(request: SubscriptionChannelsRequest):
    """
    Get list of channels from YouTube subscriptions feed.
    Requires browser cookies (Chrome by default) with active YouTube session.
    """
    try:
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(
            executor,
            lambda: get_subscription_feed_sync(request.use_cookies, request.browser)
        )

        if not entries:
            raise HTTPException(status_code=404, detail="Could not access subscription feed. Make sure you're logged into YouTube in your browser.")

        # Group videos by channel to get unique channels
        channels_dict: dict[str, ChannelInfo] = {}

        for entry in entries:
            if entry is None:
                continue

            channel_id = entry.get('channel_id') or ''
            if not channel_id:
                continue

            if channel_id not in channels_dict:
                channel_name = entry.get('channel') or entry.get('uploader') or 'Unknown'
                # Build channel URL
                channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"
                # Get channel thumbnail/avatar if available
                thumbnail = None
                thumbnails = entry.get('thumbnails', [])
                if thumbnails and isinstance(thumbnails, list) and len(thumbnails) > 0:
                    thumbnail = thumbnails[0].get('url')

                channels_dict[channel_id] = ChannelInfo(
                    channel_id=channel_id,
                    channel_name=channel_name,
                    channel_url=channel_url,
                    thumbnail=thumbnail,
                    video_count=1
                )
            else:
                channels_dict[channel_id].video_count += 1

        # Sort by video count (most active channels first)
        channels = sorted(channels_dict.values(), key=lambda c: c.video_count, reverse=True)

        return SubscriptionChannelsResponse(
            channels=channels,
            total_channels=len(channels),
            total_videos_in_feed=len(entries)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing subscriptions: {str(e)}")


@router.post("/subscriptions/videos", response_model=ChannelVideosResponse)
async def get_videos_from_channels(request: ChannelVideosRequest):
    """
    Get videos from selected channels.
    Processes channels sequentially with a small delay to avoid rate limiting.
    """
    import time
    start_time = time.time()

    all_videos: list[VideoMetadata] = []
    channels_failed: list[str] = []
    channels_processed = 0

    loop = asyncio.get_event_loop()

    for i, channel_id in enumerate(request.channel_ids):
        try:
            channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"

            entries = await loop.run_in_executor(
                executor,
                lambda url=channel_url: get_channel_videos_sync(
                    url,
                    request.videos_per_channel,
                    request.use_cookies,
                    request.browser,
                    request.extract_full_metadata
                )
            )

            for entry in entries:
                if entry is None:
                    continue

                if request.extract_full_metadata:
                    video = extract_video_metadata(entry, include_transcript=request.extract_transcript)
                else:
                    # Basic info only (from flat extraction)
                    video_id = entry.get('id') or ''
                    author = entry.get('channel') or entry.get('uploader') or 'Unknown'
                    video = VideoMetadata(
                        id=video_id,
                        title=entry.get('title') or 'No title',
                        author=author,
                        channel_id=entry.get('channel_id') or channel_id,
                        description='',
                        duration_seconds=entry.get('duration') or 0,
                        duration_formatted=format_duration(entry.get('duration') or 0),
                        view_count=entry.get('view_count') or 0,
                        like_count=0,
                        comment_count=None,
                        upload_date=entry.get('upload_date') or '',
                        thumbnail=entry.get('thumbnail') or '',
                        url=entry.get('url') or f"https://www.youtube.com/watch?v={video_id}",
                        tags=[],
                        categories=[],
                        transcript=None,
                        has_transcript=False
                    )
                all_videos.append(video)

            channels_processed += 1

            # Small delay between channels to avoid rate limiting
            if i < len(request.channel_ids) - 1:
                await asyncio.sleep(0.5)

        except Exception as e:
            print(f"Error processing channel {channel_id}: {e}")
            channels_failed.append(channel_id)

    processing_time = time.time() - start_time

    return ChannelVideosResponse(
        videos=all_videos,
        total_videos=len(all_videos),
        channels_processed=channels_processed,
        channels_failed=channels_failed,
        processing_time_seconds=round(processing_time, 2)
    )


# ============================================================================
# SUBSCRIBED CHANNELS MANAGEMENT - Store and manage channels from CSV
# ============================================================================

class SubscribedChannel(BaseModel):
    """A subscribed channel stored in the database."""
    id: Optional[int] = None
    channel_id: str
    channel_name: str
    channel_url: str
    thumbnail: Optional[str] = None
    is_active: bool = True
    first_import_at: Optional[str] = None
    last_video_date: Optional[str] = None
    last_import_at: Optional[str] = None
    total_videos_imported: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AddChannelByURLRequest(BaseModel):
    """Request to add a channel by URL."""
    url: str  # YouTube channel URL (various formats supported)
    use_cookies: bool = True
    browser: str = "chrome"


class ImportCSVRequest(BaseModel):
    """Request to import channels from CSV content."""
    csv_content: str  # Raw CSV text from Google Takeout


class ImportCSVResponse(BaseModel):
    """Response after importing channels from CSV."""
    channels_imported: int
    channels_updated: int
    channels_skipped: int
    total_in_csv: int


class SubscribedChannelsListResponse(BaseModel):
    """Response with list of subscribed channels from database."""
    channels: list[SubscribedChannel]
    total: int
    active: int


class ToggleChannelRequest(BaseModel):
    """Request to toggle a channel's active status."""
    channel_id: str
    is_active: bool


class ImportVideosFromChannelsRequest(BaseModel):
    """Request to import videos from subscribed channels."""
    channel_ids: Optional[list[str]] = None  # If None, use all active channels
    videos_per_channel: int = 5
    mode: str = "incremental"  # "incremental", "historical", "fixed"
    use_cookies: bool = True
    browser: str = "chrome"
    extract_full_metadata: bool = False
    extract_transcript: bool = False


class ImportVideosFromChannelsResponse(BaseModel):
    """Response after importing videos from channels."""
    videos: list[VideoMetadata]
    total_videos: int
    new_videos: int  # Videos not already in database
    channels_processed: int
    channels_failed: list[str]
    processing_time_seconds: float


def parse_google_takeout_csv(csv_content: str) -> list[dict]:
    """Parse Google Takeout subscriptions CSV.

    Expected format (Spanish headers):
    ID del canal,URL del canal,Título del canal

    Or English:
    Channel Id,Channel Url,Channel Title
    """
    channels = []
    reader = csv.reader(io.StringIO(csv_content))

    # Skip header row
    header = next(reader, None)
    if not header:
        return []

    for row in reader:
        if len(row) >= 3:
            channel_id = row[0].strip()
            channel_url = row[1].strip()
            channel_name = row[2].strip()

            if channel_id and channel_name:
                channels.append({
                    "channel_id": channel_id,
                    "channel_url": channel_url,
                    "channel_name": channel_name
                })

    return channels


@router.post("/subscribed-channels/import-csv", response_model=ImportCSVResponse)
async def import_channels_from_csv(request: ImportCSVRequest):
    """
    Import subscribed channels from Google Takeout CSV.
    Updates existing channels, inserts new ones.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    channels = parse_google_takeout_csv(request.csv_content)
    if not channels:
        raise HTTPException(status_code=400, detail="No valid channels found in CSV")

    imported = 0
    updated = 0
    skipped = 0

    for channel in channels:
        try:
            # Check if channel already exists
            existing = supabase.table("subscribed_channels").select("id").eq(
                "channel_id", channel["channel_id"]
            ).execute()

            if existing.data and len(existing.data) > 0:
                # Update existing channel name (might have changed)
                supabase.table("subscribed_channels").update({
                    "channel_name": channel["channel_name"],
                    "channel_url": channel["channel_url"]
                }).eq("channel_id", channel["channel_id"]).execute()
                updated += 1
            else:
                # Insert new channel
                supabase.table("subscribed_channels").insert({
                    "channel_id": channel["channel_id"],
                    "channel_name": channel["channel_name"],
                    "channel_url": channel["channel_url"],
                    "is_active": True,
                    "total_videos_imported": 0
                }).execute()
                imported += 1

        except Exception as e:
            print(f"Error processing channel {channel['channel_id']}: {e}")
            skipped += 1

    return ImportCSVResponse(
        channels_imported=imported,
        channels_updated=updated,
        channels_skipped=skipped,
        total_in_csv=len(channels)
    )


@router.get("/subscribed-channels", response_model=SubscribedChannelsListResponse)
async def list_subscribed_channels():
    """
    Get all subscribed channels from the database.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        result = supabase.table("subscribed_channels").select("*").order(
            "channel_name", desc=False
        ).execute()

        channels = [SubscribedChannel(**c) for c in result.data]
        active_count = sum(1 for c in channels if c.is_active)

        return SubscribedChannelsListResponse(
            channels=channels,
            total=len(channels),
            active=active_count
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching channels: {str(e)}")


@router.post("/subscribed-channels/toggle")
async def toggle_channel_active(request: ToggleChannelRequest):
    """
    Toggle a channel's active status.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        supabase.table("subscribed_channels").update({
            "is_active": request.is_active
        }).eq("channel_id", request.channel_id).execute()

        return {"success": True, "channel_id": request.channel_id, "is_active": request.is_active}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating channel: {str(e)}")


def extract_channel_info_sync(url: str, use_cookies: bool = True, browser: str = "chrome") -> dict:
    """Extract channel information from a YouTube channel URL."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'playlistend': 1,  # Only need channel info, not videos
        'socket_timeout': 30,  # Timeout for network operations
    }

    if use_cookies:
        ydl_opts['cookiesfrombrowser'] = (browser,)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info if info else {}


@router.post("/subscribed-channels/add-by-url")
async def add_channel_by_url(request: AddChannelByURLRequest):
    """
    Add a channel by URL. Supports various YouTube URL formats:
    - https://youtube.com/@ChannelHandle
    - https://youtube.com/channel/UCxxxx
    - https://youtube.com/c/ChannelName
    - https://youtube.com/user/Username

    Extracts channel metadata using yt-dlp and saves to database.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        loop = asyncio.get_event_loop()
        # Add timeout to prevent hanging
        info = await asyncio.wait_for(
            loop.run_in_executor(
                executor,
                lambda: extract_channel_info_sync(request.url, request.use_cookies, request.browser)
            ),
            timeout=45.0  # 45 second timeout
        )

        if not info:
            raise HTTPException(status_code=404, detail="Could not extract channel information")

        # Extract channel details from the response
        channel_id = info.get('channel_id') or info.get('id', '')
        channel_name = info.get('channel') or info.get('uploader') or info.get('title') or 'Unknown'

        # Build canonical channel URL
        channel_url = f"https://www.youtube.com/channel/{channel_id}/videos" if channel_id else request.url

        # Get thumbnail
        thumbnail = None
        thumbnails = info.get('thumbnails', [])
        if thumbnails and isinstance(thumbnails, list):
            # Try to get a decent resolution thumbnail
            for t in thumbnails:
                if t.get('url'):
                    thumbnail = t['url']
                    break

        if not channel_id:
            raise HTTPException(status_code=400, detail="Could not extract channel ID from URL")

        # Check if channel already exists
        existing = supabase.table("subscribed_channels").select("id, channel_name").eq(
            "channel_id", channel_id
        ).execute()

        if existing.data and len(existing.data) > 0:
            return {
                "success": False,
                "message": f"Channel '{existing.data[0]['channel_name']}' already exists",
                "channel_id": channel_id,
                "already_exists": True
            }

        # Insert new channel
        result = supabase.table("subscribed_channels").insert({
            "channel_id": channel_id,
            "channel_name": channel_name,
            "channel_url": channel_url,
            "thumbnail": thumbnail,
            "is_active": True,
            "total_videos_imported": 0
        }).execute()

        return {
            "success": True,
            "message": f"Channel '{channel_name}' added successfully",
            "channel": {
                "channel_id": channel_id,
                "channel_name": channel_name,
                "channel_url": channel_url,
                "thumbnail": thumbnail
            }
        }

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout: Could not fetch channel information. YouTube may be slow or blocking requests.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding channel: {str(e)}")


@router.delete("/subscribed-channels/{channel_id}")
async def delete_subscribed_channel(channel_id: str):
    """
    Delete a subscribed channel from the database.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        supabase.table("subscribed_channels").delete().eq("channel_id", channel_id).execute()
        return {"success": True, "channel_id": channel_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting channel: {str(e)}")


@router.post("/subscribed-channels/import-videos", response_model=ImportVideosFromChannelsResponse)
async def import_videos_from_subscribed_channels(request: ImportVideosFromChannelsRequest):
    """
    Import videos from subscribed channels.

    Modes:
    - incremental: Only videos newer than last_video_date
    - historical: Videos older than the oldest imported (backfill)
    - fixed: Last N videos regardless of what's already imported

    Deduplication is always done by youtube_id.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Generate job ID and register it
    job_id = f"import_{int(time.time())}"
    register_job(job_id, "channel_import")

    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"📥 IMPORT VIDEOS FROM SUBSCRIBED CHANNELS [Job: {job_id}]")
    print(f"{'='*60}")
    print(f"Mode: {request.mode} | Videos/channel: {request.videos_per_channel}")
    print(f"Full metadata: {request.extract_full_metadata} | Transcript: {request.extract_transcript}")

    # Get channels to process
    if request.channel_ids:
        channels_result = supabase.table("subscribed_channels").select("*").in_(
            "channel_id", request.channel_ids
        ).execute()
    else:
        # All active channels
        channels_result = supabase.table("subscribed_channels").select("*").eq(
            "is_active", True
        ).execute()

    channels = channels_result.data
    if not channels:
        complete_job(job_id)
        raise HTTPException(status_code=404, detail="No channels found to process")

    total_channels = len(channels)
    print(f"📊 Channels to process: {total_channels}")

    # Get existing youtube_ids for deduplication
    existing_result = supabase.table("videos").select("youtube_id").execute()
    existing_ids = set(v["youtube_id"] for v in existing_result.data if v.get("youtube_id"))

    all_videos: list[VideoMetadata] = []
    new_videos_count = 0
    channels_failed: list[str] = []
    channels_processed = 0

    loop = asyncio.get_event_loop()

    for i, channel in enumerate(channels):
        # Check for cancellation at each channel
        if is_job_cancelled(job_id):
            print(f"\n⚠️ Job {job_id} cancelled by user at channel {i+1}/{total_channels}")
            break

        channel_id = channel["channel_id"]
        channel_name = channel.get("channel_name", channel_id)[:30]
        channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"

        # Update job progress
        progress = f"{i+1}/{total_channels} ({((i+1)/total_channels)*100:.0f}%)"
        update_job_progress(job_id, progress)

        elapsed = time.time() - start_time
        print(f"\n[{i+1}/{total_channels}] 🔄 {channel_name}... ({elapsed:.0f}s elapsed)")

        try:
            entries = await loop.run_in_executor(
                executor,
                lambda url=channel_url: get_channel_videos_sync(
                    url,
                    request.videos_per_channel,
                    request.use_cookies,
                    request.browser,
                    request.extract_full_metadata
                )
            )

            channel_new_videos = 0
            latest_video_date = channel.get("last_video_date")

            for entry in entries:
                if entry is None:
                    continue

                video_id = entry.get('id') or ''
                if not video_id:
                    continue

                # Skip if already in database
                if video_id in existing_ids:
                    continue

                # For incremental mode, check date
                upload_date = entry.get('upload_date') or ''
                if request.mode == "incremental" and latest_video_date and upload_date:
                    # upload_date format is YYYYMMDD, latest_video_date is ISO
                    try:
                        upload_dt = datetime.strptime(upload_date, "%Y%m%d")
                        latest_dt = datetime.fromisoformat(latest_video_date.replace("Z", "+00:00"))
                        if upload_dt <= latest_dt.replace(tzinfo=None):
                            continue  # Skip older videos
                    except (ValueError, TypeError):
                        pass  # If date parsing fails, include the video

                # Extract metadata
                if request.extract_full_metadata:
                    video = extract_video_metadata(entry, include_transcript=request.extract_transcript)
                else:
                    author = entry.get('channel') or entry.get('uploader') or channel["channel_name"]
                    video = VideoMetadata(
                        id=video_id,
                        title=entry.get('title') or 'No title',
                        author=author,
                        channel_id=entry.get('channel_id') or channel_id,
                        description='',
                        duration_seconds=entry.get('duration') or 0,
                        duration_formatted=format_duration(entry.get('duration') or 0),
                        view_count=entry.get('view_count') or 0,
                        like_count=0,
                        comment_count=None,
                        upload_date=upload_date,
                        thumbnail=entry.get('thumbnail') or '',
                        url=entry.get('url') or f"https://www.youtube.com/watch?v={video_id}",
                        tags=[],
                        categories=[],
                        transcript=None,
                        has_transcript=False
                    )

                all_videos.append(video)
                existing_ids.add(video_id)  # Prevent duplicates within this run
                channel_new_videos += 1

            # Update channel metadata
            update_data = {
                "last_import_at": datetime.utcnow().isoformat(),
                "total_videos_imported": channel.get("total_videos_imported", 0) + channel_new_videos
            }

            # Set first_import_at if this is the first import
            if not channel.get("first_import_at") and channel_new_videos > 0:
                update_data["first_import_at"] = datetime.utcnow().isoformat()

            # Update last_video_date if we found new videos
            if channel_new_videos > 0 and all_videos:
                # Find the most recent video date from this channel
                channel_videos = [v for v in all_videos if v.channel_id == channel_id]
                if channel_videos:
                    dates = [v.upload_date for v in channel_videos if v.upload_date]
                    if dates:
                        most_recent = max(dates)
                        try:
                            dt = datetime.strptime(most_recent, "%Y%m%d")
                            update_data["last_video_date"] = dt.isoformat()
                        except ValueError:
                            pass

            supabase.table("subscribed_channels").update(update_data).eq(
                "channel_id", channel_id
            ).execute()

            channels_processed += 1
            new_videos_count += channel_new_videos

            print(f"    ✅ +{channel_new_videos} videos (total: {len(all_videos)})")

            # Delay between channels
            if i < len(channels) - 1:
                await asyncio.sleep(0.5)

        except Exception as e:
            print(f"    ❌ Error: {str(e)[:50]}")
            channels_failed.append(channel_id)

    processing_time = time.time() - start_time

    # Mark job as completed
    was_cancelled = is_job_cancelled(job_id)
    complete_job(job_id)

    status_msg = "CANCELLED" if was_cancelled else "COMPLETED"
    print(f"\n{'='*60}")
    print(f"{'⚠️' if was_cancelled else '✅'} IMPORT {status_msg} [Job: {job_id}]")
    print(f"{'='*60}")
    print(f"⏱️  Time: {processing_time:.1f}s")
    print(f"📺 Channels: {channels_processed}/{total_channels} OK, {len(channels_failed)} failed")
    print(f"🎬 Videos: {len(all_videos)} total ({new_videos_count} new)")
    if channels_failed:
        print(f"❌ Failed: {', '.join(channels_failed[:5])}{'...' if len(channels_failed) > 5 else ''}")
    print(f"{'='*60}\n")

    return ImportVideosFromChannelsResponse(
        videos=all_videos,
        total_videos=len(all_videos),
        new_videos=new_videos_count,
        channels_processed=channels_processed,
        channels_failed=channels_failed,
        processing_time_seconds=round(processing_time, 2)
    )


# ============================================================================
# BULK VIDEO URLS IMPORT (YouTube + TikTok)
# ============================================================================

class BulkVideosRequest(BaseModel):
    urls: list[str]  # List of video URLs (YouTube or TikTok)
    extract_transcript: bool = False  # Extract YouTube subtitles


class VideoImportResult(BaseModel):
    url: str
    success: bool
    video: Optional[VideoMetadata] = None
    error: Optional[str] = None
    source: str  # 'youtube' or 'tiktok'


class BulkVideosResponse(BaseModel):
    results: list[VideoImportResult]
    total: int
    success_count: int
    failed_count: int
    processing_time_seconds: float


def detect_video_source(url: str) -> str:
    """Detect if URL is YouTube or TikTok."""
    url_lower = url.lower()
    if 'tiktok.com' in url_lower or 'vm.tiktok.com' in url_lower:
        return 'tiktok'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'
    else:
        # Try to detect by yt-dlp later
        return 'unknown'


def scrape_video_with_source(url: str, extract_transcript: bool = False) -> tuple[Optional[VideoMetadata], Optional[str], str]:
    """
    Scrape a single video URL, detecting source automatically.
    Returns (video_metadata, error_message, source)
    """
    source = detect_video_source(url)

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            if not info:
                return None, "Video not found", source

            # Update source based on extractor
            extractor = info.get('extractor', '').lower()
            if 'tiktok' in extractor:
                source = 'tiktok'
            elif 'youtube' in extractor:
                source = 'youtube'

            # Extract metadata using existing function
            video = extract_video_metadata(info, include_transcript=extract_transcript and source == 'youtube')

            # For TikTok, adjust the URL format
            if source == 'tiktok':
                video.url = info.get('webpage_url') or url

            return video, None, source

    except Exception as e:
        return None, str(e), source


@router.post("/videos/bulk", response_model=BulkVideosResponse)
async def scrape_bulk_videos(request: BulkVideosRequest):
    """
    Scrape metadata for multiple video URLs (YouTube and TikTok mixed).
    NO API quota used! Uses yt-dlp for all sources.

    Supports:
    - YouTube videos (youtube.com, youtu.be)
    - TikTok videos (tiktok.com, vm.tiktok.com)

    Each URL is processed independently, so failures don't affect other videos.
    """
    start_time = time.time()
    results: list[VideoImportResult] = []

    # Process URLs one by one (could be parallelized later)
    loop = asyncio.get_event_loop()

    for url in request.urls:
        url = url.strip()
        if not url:
            continue

        try:
            video, error, source = await loop.run_in_executor(
                executor,
                lambda u=url: scrape_video_with_source(u, request.extract_transcript)
            )

            if video:
                results.append(VideoImportResult(
                    url=url,
                    success=True,
                    video=video,
                    error=None,
                    source=source
                ))
            else:
                results.append(VideoImportResult(
                    url=url,
                    success=False,
                    video=None,
                    error=error or "Unknown error",
                    source=source
                ))

        except Exception as e:
            results.append(VideoImportResult(
                url=url,
                success=False,
                video=None,
                error=str(e),
                source=detect_video_source(url)
            ))

    processing_time = time.time() - start_time
    success_count = sum(1 for r in results if r.success)

    return BulkVideosResponse(
        results=results,
        total=len(results),
        success_count=success_count,
        failed_count=len(results) - success_count,
        processing_time_seconds=round(processing_time, 2)
    )
