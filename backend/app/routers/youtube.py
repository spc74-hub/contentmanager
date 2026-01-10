import re
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from app.config import get_settings
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
settings = get_settings()

# Store tokens temporarily (in production, use database)
tokens_store: dict = {}

SCOPES = ['https://www.googleapis.com/auth/youtube.readonly']


class PlaylistResponse(BaseModel):
    id: str
    title: str
    description: str
    video_count: int
    thumbnail: Optional[str]


class VideoResponse(BaseModel):
    id: str
    title: str
    author: str
    description: str
    duration: int
    likes: int
    views: int
    url: str
    thumbnail: Optional[str]
    published_at: str


def get_flow():
    client_config = {
        "web": {
            "client_id": settings.youtube_client_id,
            "client_secret": settings.youtube_client_secret,
            "redirect_uris": [f"{settings.frontend_url}/api/youtube/callback", "http://localhost:8000/api/youtube/callback"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES)


def parse_duration(duration_str: str) -> int:
    """Convert ISO 8601 duration (PT15M33S) to minutes."""
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if match:
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        return hours * 60 + minutes + (1 if seconds > 30 else 0)
    return 0


@router.get("/auth")
async def youtube_auth():
    """Initiate YouTube OAuth flow."""
    flow = get_flow()
    flow.redirect_uri = "http://localhost:8000/api/youtube/callback"

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )

    return RedirectResponse(url=authorization_url)


@router.get("/callback")
async def youtube_callback(code: str = Query(...), state: str = Query(None)):
    """Handle OAuth callback from YouTube."""
    try:
        flow = get_flow()
        flow.redirect_uri = "http://localhost:8000/api/youtube/callback"
        flow.fetch_token(code=code)

        credentials = flow.credentials
        tokens_store["default"] = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
        }

        # Redirect to frontend with success
        return RedirectResponse(url=f"{settings.frontend_url}/import?connected=true")
    except Exception as e:
        return RedirectResponse(url=f"{settings.frontend_url}/import?error={str(e)}")


@router.get("/status")
async def youtube_status():
    """Check if YouTube is connected."""
    return {"connected": "default" in tokens_store}


@router.get("/playlists", response_model=list[PlaylistResponse])
async def get_playlists():
    """Get user's YouTube playlists."""
    if "default" not in tokens_store:
        raise HTTPException(status_code=401, detail="YouTube not connected")

    from google.oauth2.credentials import Credentials
    creds = Credentials(**tokens_store["default"])
    youtube = build('youtube', 'v3', credentials=creds)

    playlists = []
    request = youtube.playlists().list(
        part="snippet,contentDetails",
        mine=True,
        maxResults=50
    )

    while request:
        response = request.execute()
        for item in response.get('items', []):
            playlists.append(PlaylistResponse(
                id=item['id'],
                title=item['snippet']['title'],
                description=item['snippet'].get('description', ''),
                video_count=item['contentDetails']['itemCount'],
                thumbnail=item['snippet']['thumbnails'].get('medium', {}).get('url')
            ))
        request = youtube.playlists().list_next(request, response)

    return playlists


@router.get("/playlist/{playlist_id}/videos", response_model=list[VideoResponse])
async def get_playlist_videos(playlist_id: str):
    """Get all videos from a playlist."""
    if "default" not in tokens_store:
        raise HTTPException(status_code=401, detail="YouTube not connected")

    from google.oauth2.credentials import Credentials
    creds = Credentials(**tokens_store["default"])
    youtube = build('youtube', 'v3', credentials=creds)

    videos = []
    request = youtube.playlistItems().list(
        part="snippet,contentDetails",
        playlistId=playlist_id,
        maxResults=50
    )

    while request:
        response = request.execute()
        video_ids = [item['contentDetails']['videoId'] for item in response.get('items', [])]

        if video_ids:
            videos_response = youtube.videos().list(
                part="snippet,contentDetails,statistics",
                id=','.join(video_ids)
            ).execute()

            for video in videos_response.get('items', []):
                videos.append(VideoResponse(
                    id=video['id'],
                    title=video['snippet']['title'],
                    author=video['snippet']['channelTitle'],
                    description=video['snippet'].get('description', '')[:500],
                    duration=parse_duration(video['contentDetails']['duration']),
                    likes=int(video['statistics'].get('likeCount', 0)),
                    views=int(video['statistics'].get('viewCount', 0)),
                    url=f"https://www.youtube.com/watch?v={video['id']}",
                    thumbnail=video['snippet']['thumbnails'].get('medium', {}).get('url'),
                    published_at=video['snippet']['publishedAt']
                ))

        request = youtube.playlistItems().list_next(request, response)

    return videos
