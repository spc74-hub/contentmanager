"""
Router for curated channels management.
Handles CRUD operations for curated YouTube channels with classification.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os
import re
import tempfile
import uuid
import asyncio
import subprocess
import json
from pathlib import Path
from dotenv import load_dotenv

# Load env
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

router = APIRouter(prefix="/api/channels", tags=["channels"])


# ============== Models ==============

class ChannelTheme(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0


class CuratedChannel(BaseModel):
    id: int
    name: str
    youtube_url: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    youtube_channel_url: Optional[str] = None
    thumbnail: Optional[str] = None
    theme_id: Optional[int] = None
    theme_name: Optional[str] = None
    level: str = "medio"
    energy: str = "media"
    use_type: str = "inspiracion"
    is_active: bool = True
    is_resolved: bool = False
    is_favorite: bool = False
    subscriber_count: Optional[int] = None
    last_import_at: Optional[str] = None
    total_videos_imported: int = 0
    created_at: Optional[str] = None


class ChannelCreate(BaseModel):
    name: str
    youtube_url: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    theme_id: Optional[int] = None
    level: str = "medio"
    energy: str = "media"
    use_type: str = "inspiracion"


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    youtube_url: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    youtube_channel_url: Optional[str] = None
    theme_id: Optional[int] = None
    level: Optional[str] = None
    energy: Optional[str] = None
    use_type: Optional[str] = None
    is_active: Optional[bool] = None
    is_resolved: Optional[bool] = None
    is_favorite: Optional[bool] = None
    subscriber_count: Optional[int] = None


class ChannelsResponse(BaseModel):
    channels: List[CuratedChannel]
    total: int
    themes: List[ChannelTheme]


# ============== Tag Models ==============

class ChannelTag(BaseModel):
    id: int
    name: str
    color: str = "#6B7280"
    created_at: Optional[str] = None


class TagCreate(BaseModel):
    name: str
    color: str = "#6B7280"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class ImportExcelRequest(BaseModel):
    file_path: str  # Path to Excel file


class ImportExcelResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


class ChannelStats(BaseModel):
    total_channels: int
    resolved_channels: int
    by_theme: dict
    by_level: dict
    by_energy: dict
    by_use_type: dict


# ============== Helper ==============

def get_supabase():
    from supabase import create_client
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Database not configured")
    return create_client(supabase_url, supabase_key)


def download_youtube_subtitles(video_id: str) -> Optional[str]:
    """
    Download subtitles from YouTube video using yt-dlp.

    Tries to get subtitles in this order:
    1. Manual Spanish subtitles
    2. Auto-generated Spanish subtitles
    3. Manual English subtitles
    4. Auto-generated English subtitles

    Returns: transcript_text or None
    """
    import subprocess

    video_url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        # Languages to try in order of preference
        lang_preferences = ["es", "en"]

        for lang in lang_preferences:
            # Try manual subtitles first, then auto-generated
            for auto_flag in [False, True]:
                cmd = [
                    "yt-dlp",
                    "--skip-download",
                    "--write-auto-sub" if auto_flag else "--write-sub",
                    "--sub-lang", lang,
                    "--sub-format", "vtt",
                    "-o", os.path.join(tmpdir, "subtitle"),
                    "--quiet",
                    "--no-warnings",
                    video_url
                ]

                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

                    # Check for subtitle files
                    for f in os.listdir(tmpdir):
                        if f.endswith('.vtt'):
                            vtt_path = os.path.join(tmpdir, f)
                            transcript = parse_vtt_subtitles(vtt_path)
                            if transcript and len(transcript) > 50:
                                print(f"[Subtitles] Found {'auto' if auto_flag else 'manual'} {lang} for {video_id}")
                                return transcript
                            # Clean up for next try
                            os.remove(vtt_path)
                except subprocess.TimeoutExpired:
                    continue
                except Exception as e:
                    print(f"[Subtitles] Error for {video_id}: {e}")
                    continue

        return None


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


# ============== Endpoints ==============

@router.get("/themes", response_model=List[ChannelTheme])
async def get_themes():
    """Get all channel themes."""
    supabase = get_supabase()
    response = supabase.table("channel_themes").select("*").order("sort_order").execute()
    return response.data or []


@router.get("", response_model=ChannelsResponse)
async def get_channels(
    theme_id: Optional[int] = None,
    level: Optional[str] = None,
    energy: Optional[str] = None,
    use_type: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get curated channels with optional filters."""
    supabase = get_supabase()

    # Build query
    query = supabase.table("curated_channels").select(
        "*, channel_themes(name, color)"
    )

    # Apply filters
    if theme_id:
        query = query.eq("theme_id", theme_id)
    if level:
        query = query.eq("level", level)
    if energy:
        query = query.eq("energy", energy)
    if use_type:
        query = query.eq("use_type", use_type)
    if is_resolved is not None:
        query = query.eq("is_resolved", is_resolved)
    if is_favorite is not None:
        query = query.eq("is_favorite", is_favorite)
    if search:
        query = query.ilike("name", f"%{search}%")

    # Get total count
    count_response = supabase.table("curated_channels").select("id", count="exact")
    if theme_id:
        count_response = count_response.eq("theme_id", theme_id)
    if level:
        count_response = count_response.eq("level", level)
    if energy:
        count_response = count_response.eq("energy", energy)
    if use_type:
        count_response = count_response.eq("use_type", use_type)
    if is_resolved is not None:
        count_response = count_response.eq("is_resolved", is_resolved)
    if is_favorite is not None:
        count_response = count_response.eq("is_favorite", is_favorite)
    if search:
        count_response = count_response.ilike("name", f"%{search}%")
    count_result = count_response.execute()
    total = count_result.count or 0

    # Get paginated results
    query = query.order("name").range(offset, offset + limit - 1)
    response = query.execute()

    # Transform data
    channels = []
    for ch in (response.data or []):
        theme_data = ch.pop("channel_themes", None)
        ch["theme_name"] = theme_data.get("name") if theme_data else None
        channels.append(CuratedChannel(**ch))

    # Get themes
    themes_response = supabase.table("channel_themes").select("*").order("sort_order").execute()

    return ChannelsResponse(
        channels=channels,
        total=total,
        themes=[ChannelTheme(**t) for t in (themes_response.data or [])]
    )


@router.get("/stats", response_model=ChannelStats)
async def get_channel_stats():
    """Get channel statistics."""
    supabase = get_supabase()

    # Get all channels
    response = supabase.table("curated_channels").select(
        "id, theme_id, level, energy, use_type, is_resolved"
    ).execute()
    channels = response.data or []

    # Get themes for mapping
    themes_response = supabase.table("channel_themes").select("id, name").execute()
    theme_map = {t["id"]: t["name"] for t in (themes_response.data or [])}

    # Calculate stats
    by_theme = {}
    by_level = {"intro": 0, "medio": 0, "avanzado": 0}
    by_energy = {"baja": 0, "media": 0, "alta": 0}
    by_use_type = {"estudio": 0, "inspiracion": 0, "ocio": 0, "espiritual": 0}
    resolved_count = 0

    for ch in channels:
        # Theme
        theme_name = theme_map.get(ch.get("theme_id"), "Sin tema")
        by_theme[theme_name] = by_theme.get(theme_name, 0) + 1

        # Level
        level = ch.get("level", "medio")
        if level in by_level:
            by_level[level] += 1

        # Energy
        energy = ch.get("energy", "media")
        if energy in by_energy:
            by_energy[energy] += 1

        # Use type
        use_type = ch.get("use_type", "inspiracion")
        if use_type in by_use_type:
            by_use_type[use_type] += 1

        # Resolved
        if ch.get("is_resolved"):
            resolved_count += 1

    return ChannelStats(
        total_channels=len(channels),
        resolved_channels=resolved_count,
        by_theme=by_theme,
        by_level=by_level,
        by_energy=by_energy,
        by_use_type=by_use_type
    )


@router.get("/export")
async def export_channels():
    """Export all channels to CSV format."""
    import csv
    import io
    from fastapi.responses import StreamingResponse

    supabase = get_supabase()

    # Get all channels with theme info
    response = supabase.table("curated_channels").select(
        "*, channel_themes(name)"
    ).order("name").execute()

    channels = response.data or []

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Nombre",
        "Temática",
        "Nivel",
        "Energía",
        "Uso",
        "URL YouTube",
        "Canal ID",
        "Resuelto",
        "Favorito",
        "Videos Importados"
    ])

    # Data rows
    level_map = {"intro": "Intro", "medio": "Medio", "avanzado": "Avanzado"}
    energy_map = {"baja": "Baja", "media": "Media", "alta": "Alta"}
    use_map = {"estudio": "Estudio", "inspiracion": "Inspiración", "ocio": "Ocio", "espiritual": "Espiritual"}

    for ch in channels:
        theme_data = ch.get("channel_themes")
        theme_name = theme_data.get("name") if theme_data else "Sin tema"

        # Construct YouTube URL if we have channel_id
        youtube_url = ch.get("youtube_channel_url") or ch.get("youtube_url") or ""
        if not youtube_url and ch.get("youtube_channel_id"):
            youtube_url = f"https://www.youtube.com/channel/{ch.get('youtube_channel_id')}"

        writer.writerow([
            ch.get("name", ""),
            theme_name,
            level_map.get(ch.get("level", ""), ch.get("level", "")),
            energy_map.get(ch.get("energy", ""), ch.get("energy", "")),
            use_map.get(ch.get("use_type", ""), ch.get("use_type", "")),
            youtube_url,
            ch.get("youtube_channel_id", ""),
            "Sí" if ch.get("is_resolved") else "No",
            "Sí" if ch.get("is_favorite") else "No",
            ch.get("total_videos_imported", 0)
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=canales_curados.csv"}
    )


# ============== Tag Endpoints ==============

@router.get("/tags", response_model=List[ChannelTag])
async def get_tags():
    """Get all channel tags."""
    supabase = get_supabase()
    response = supabase.table("channel_tags").select("*").order("name").execute()
    return response.data or []


@router.post("/tags", response_model=ChannelTag)
async def create_tag(tag: TagCreate):
    """Create a new tag."""
    supabase = get_supabase()

    # Check if tag name already exists
    existing = supabase.table("channel_tags").select("id").eq("name", tag.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Tag already exists")

    response = supabase.table("channel_tags").insert({
        "name": tag.name,
        "color": tag.color
    }).execute()

    return response.data[0]


@router.put("/tags/{tag_id}", response_model=ChannelTag)
async def update_tag(tag_id: int, tag: TagUpdate):
    """Update a tag."""
    supabase = get_supabase()

    data = tag.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("channel_tags").update(data).eq("id", tag_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Tag not found")

    return response.data[0]


@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int):
    """Delete a tag."""
    supabase = get_supabase()

    response = supabase.table("channel_tags").delete().eq("id", tag_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Tag not found")

    return {"success": True, "deleted_id": tag_id}


@router.get("/by-tag/{tag_id}")
async def get_channels_by_tag(tag_id: int):
    """Get all channels with a specific tag."""
    supabase = get_supabase()

    # Get channel IDs with this tag
    assignments = supabase.table("channel_tag_assignments").select(
        "channel_id"
    ).eq("tag_id", tag_id).execute()

    channel_ids = [a["channel_id"] for a in assignments.data or []]

    if not channel_ids:
        return {"channels": [], "total": 0}

    # Get channels
    response = supabase.table("curated_channels").select(
        "*, channel_themes(name)"
    ).in_("id", channel_ids).execute()

    channels = []
    for ch in response.data or []:
        theme_name = None
        if ch.get("channel_themes"):
            theme_name = ch["channel_themes"].get("name")
        ch["theme_name"] = theme_name
        if "channel_themes" in ch:
            del ch["channel_themes"]
        channels.append(ch)

    return {"channels": channels, "total": len(channels)}


class AddByUrlRequest(BaseModel):
    url: str


class AddByUrlResponse(BaseModel):
    success: bool
    channel_id: Optional[int] = None
    channel_name: Optional[str] = None
    error: Optional[str] = None


@router.post("/add-by-url", response_model=AddByUrlResponse)
async def add_channel_by_url(request: AddByUrlRequest):
    """
    Add a channel by its YouTube URL.
    Resolves the channel info using yt-dlp and creates it with 'Suscripciones' theme.
    """
    import subprocess
    import json

    supabase = get_supabase()

    url = request.url.strip()
    if not url:
        return AddByUrlResponse(success=False, error="URL vacía")

    # Extract channel info using yt-dlp
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--dump-json",
                "--playlist-items", "1",
                "--no-warnings",
                url
            ],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return AddByUrlResponse(success=False, error=f"No se pudo resolver el canal: {result.stderr[:200]}")

        data = json.loads(result.stdout)
        channel_name = data.get("channel") or data.get("uploader") or "Canal desconocido"
        channel_id = data.get("channel_id")
        channel_url = data.get("channel_url")

        # Check if already exists
        existing = supabase.table("curated_channels").select("id").eq("name", channel_name).execute()
        if existing.data:
            return AddByUrlResponse(success=False, error=f"El canal '{channel_name}' ya existe")

        if channel_id:
            existing_by_id = supabase.table("curated_channels").select("id").eq("youtube_channel_id", channel_id).execute()
            if existing_by_id.data:
                return AddByUrlResponse(success=False, error=f"El canal ya existe con otro nombre")

        # Get or create "Suscripciones" theme
        themes = supabase.table("channel_themes").select("id").eq("name", "Suscripciones").execute()
        if themes.data:
            theme_id = themes.data[0]["id"]
        else:
            # Create the theme
            new_theme = supabase.table("channel_themes").insert({
                "name": "Suscripciones",
                "sort_order": 100,
                "color": "#6366f1"
            }).execute()
            theme_id = new_theme.data[0]["id"]

        # Create channel
        channel_data = {
            "name": channel_name,
            "youtube_url": url,
            "youtube_channel_id": channel_id,
            "youtube_channel_url": channel_url,
            "theme_id": theme_id,
            "level": "medio",
            "energy": "media",
            "use_type": "inspiracion",
            "is_resolved": bool(channel_id)
        }

        result = supabase.table("curated_channels").insert(channel_data).execute()
        if result.data:
            return AddByUrlResponse(
                success=True,
                channel_id=result.data[0]["id"],
                channel_name=channel_name
            )
        else:
            return AddByUrlResponse(success=False, error="Error al crear el canal")

    except subprocess.TimeoutExpired:
        return AddByUrlResponse(success=False, error="Timeout al resolver el canal")
    except json.JSONDecodeError:
        return AddByUrlResponse(success=False, error="No se pudo parsear la respuesta de YouTube")
    except Exception as e:
        return AddByUrlResponse(success=False, error=str(e))


@router.post("", response_model=CuratedChannel)
async def create_channel(channel: ChannelCreate):
    """Create a new curated channel."""
    supabase = get_supabase()

    data = channel.model_dump(exclude_none=True)
    response = supabase.table("curated_channels").insert(data).execute()

    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create channel")

    return CuratedChannel(**response.data[0])


@router.put("/{channel_id}", response_model=CuratedChannel)
async def update_channel(channel_id: int, channel: ChannelUpdate):
    """Update a curated channel."""
    supabase = get_supabase()

    data = channel.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("curated_channels").update(data).eq("id", channel_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    return CuratedChannel(**response.data[0])


@router.delete("/{channel_id}")
async def delete_channel(channel_id: int):
    """Delete a curated channel."""
    supabase = get_supabase()

    response = supabase.table("curated_channels").delete().eq("id", channel_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    return {"success": True, "deleted_id": channel_id}


@router.post("/{channel_id}/toggle-favorite")
async def toggle_favorite(channel_id: int):
    """Toggle favorite status for a channel."""
    supabase = get_supabase()

    # Get current state
    response = supabase.table("curated_channels").select("is_favorite").eq("id", channel_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    current_favorite = response.data.get("is_favorite", False)
    new_favorite = not current_favorite

    # Update
    supabase.table("curated_channels").update({"is_favorite": new_favorite}).eq("id", channel_id).execute()

    return {"success": True, "is_favorite": new_favorite}


@router.post("/import-excel", response_model=ImportExcelResponse)
async def import_from_excel(file_path: str = "/Users/sergioporcarcelda/Downloads/Canales_YouTube_MASTER_400_INTELIGENTE.xlsx"):
    """
    Import channels from Excel file.
    Expected columns: Tema, Canal, URL YouTube, Nivel, Energía, Uso ideal
    """
    import pandas as pd

    supabase = get_supabase()

    # Check file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    # Read Excel
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel: {str(e)}")

    # Get themes mapping
    themes_response = supabase.table("channel_themes").select("id, name").execute()
    theme_map = {t["name"]: t["id"] for t in (themes_response.data or [])}

    # Map Excel values to DB enums
    level_map = {
        "Intro": "intro",
        "Medio": "medio",
        "Avanzado": "avanzado"
    }
    energy_map = {
        "Baja": "baja",
        "Media": "media",
        "Alta": "alta"
    }
    use_map = {
        "Estudio": "estudio",
        "Inspiración": "inspiracion",
        "Ocio": "ocio",
        "Espiritual": "espiritual"
    }

    imported = 0
    skipped = 0
    errors = []

    for _, row in df.iterrows():
        try:
            name = str(row.get("Canal", "")).strip()
            if not name:
                skipped += 1
                continue

            # Map values
            tema = str(row.get("Tema", "")).strip()
            theme_id = theme_map.get(tema)

            nivel = str(row.get("Nivel", "Medio")).strip()
            level = level_map.get(nivel, "medio")

            energia = str(row.get("Energía", "Media")).strip()
            energy = energy_map.get(energia, "media")

            uso = str(row.get("Uso ideal", "Inspiración")).strip()
            use_type = use_map.get(uso, "inspiracion")

            youtube_url = str(row.get("URL YouTube", "")).strip()

            # Insert channel
            data = {
                "name": name,
                "youtube_url": youtube_url if youtube_url else None,
                "theme_id": theme_id,
                "level": level,
                "energy": energy,
                "use_type": use_type,
                "is_resolved": False
            }

            supabase.table("curated_channels").upsert(
                data,
                on_conflict="name"
            ).execute()

            imported += 1

        except Exception as e:
            errors.append(f"{row.get('Canal', 'Unknown')}: {str(e)}")
            skipped += 1

    return ImportExcelResponse(
        imported=imported,
        skipped=skipped,
        errors=errors[:10]  # Limit errors returned
    )


@router.post("/{channel_id}/resolve")
async def resolve_channel(channel_id: int):
    """
    Resolve a channel's YouTube channel ID using yt-dlp.
    This converts search URLs to actual channel IDs.
    """
    import subprocess
    import json

    supabase = get_supabase()

    # Get channel
    response = supabase.table("curated_channels").select("*").eq("id", channel_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel = response.data
    name = channel.get("name", "")

    # Try to find channel using yt-dlp search
    try:
        # Search for channel
        search_query = f"ytsearch1:{name} channel"
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--flat-playlist", search_query],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and result.stdout:
            data = json.loads(result.stdout)
            channel_id_yt = data.get("channel_id")
            channel_url = data.get("channel_url")

            if channel_id_yt:
                # Update channel
                supabase.table("curated_channels").update({
                    "youtube_channel_id": channel_id_yt,
                    "youtube_channel_url": channel_url,
                    "is_resolved": True
                }).eq("id", channel_id).execute()

                return {
                    "success": True,
                    "channel_id": channel_id_yt,
                    "channel_url": channel_url
                }

        return {"success": False, "error": "Could not resolve channel"}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout resolving channel"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/{channel_id}", response_model=CuratedChannel)
async def get_channel(channel_id: int):
    """Get a single channel by ID."""
    supabase = get_supabase()

    response = supabase.table("curated_channels").select(
        "*, channel_themes(name, color)"
    ).eq("id", channel_id).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    ch = response.data
    theme_data = ch.pop("channel_themes", None)
    ch["theme_name"] = theme_data.get("name") if theme_data else None

    return CuratedChannel(**ch)


@router.get("/{channel_id}/tags", response_model=List[ChannelTag])
async def get_channel_tags(channel_id: int):
    """Get tags for a specific channel."""
    supabase = get_supabase()

    response = supabase.table("channel_tag_assignments").select(
        "tag_id, channel_tags(id, name, color, created_at)"
    ).eq("channel_id", channel_id).execute()

    tags = []
    for assignment in response.data or []:
        if assignment.get("channel_tags"):
            tags.append(assignment["channel_tags"])

    return tags


@router.post("/{channel_id}/tags/{tag_id}")
async def assign_tag_to_channel(channel_id: int, tag_id: int):
    """Assign a tag to a channel."""
    supabase = get_supabase()

    # Check if already assigned
    existing = supabase.table("channel_tag_assignments").select("*").eq(
        "channel_id", channel_id
    ).eq("tag_id", tag_id).execute()

    if existing.data:
        return {"success": True, "message": "Tag already assigned"}

    supabase.table("channel_tag_assignments").insert({
        "channel_id": channel_id,
        "tag_id": tag_id
    }).execute()

    return {"success": True}


@router.delete("/{channel_id}/tags/{tag_id}")
async def remove_tag_from_channel(channel_id: int, tag_id: int):
    """Remove a tag from a channel."""
    supabase = get_supabase()

    supabase.table("channel_tag_assignments").delete().eq(
        "channel_id", channel_id
    ).eq("tag_id", tag_id).execute()

    return {"success": True}


class ImportVideosRequest(BaseModel):
    max_videos: int = 20  # Max videos to import
    sort_by: str = "date"  # date, views, relevance


class ImportVideosResponse(BaseModel):
    success: bool
    imported: int
    skipped: int
    transcripts_found: int = 0  # Videos with YouTube subtitles
    errors: List[str]
    channel_resolved: bool = False


@router.post("/{channel_id}/import-videos", response_model=ImportVideosResponse)
async def import_videos_from_channel(channel_id: int, request: ImportVideosRequest):
    """
    Import videos from a curated channel using yt-dlp.
    First resolves the channel if not already resolved.
    """
    import subprocess
    import json
    from datetime import datetime

    supabase = get_supabase()

    # Get channel
    response = supabase.table("curated_channels").select("*").eq("id", channel_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel = response.data
    channel_name = channel.get("name", "")
    youtube_channel_id = channel.get("youtube_channel_id")
    youtube_channel_url = channel.get("youtube_channel_url")
    channel_resolved = False

    # If not resolved, try to resolve first
    if not youtube_channel_id:
        print(f"[Channels] Resolving channel: {channel_name}")
        try:
            # Use YouTube search with channel filter (sp=EgIQAg%253D%253D filters for channels)
            import urllib.parse
            search_term = urllib.parse.quote(f"{channel_name} channel")
            search_url = f"https://www.youtube.com/results?search_query={search_term}&sp=EgIQAg%253D%253D"

            # Get channel_id from first result
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--print", "channel_id",
                    "--print", "channel_url",
                    "--playlist-items", "1",
                    "--no-warnings",
                    search_url
                ],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0 and result.stdout:
                lines = result.stdout.strip().split('\n')
                if len(lines) >= 2:
                    youtube_channel_id = lines[0].strip()
                    youtube_channel_url = lines[1].strip()

                    if youtube_channel_id and youtube_channel_id.startswith('UC'):
                        # Update channel with resolved ID
                        supabase.table("curated_channels").update({
                            "youtube_channel_id": youtube_channel_id,
                            "youtube_channel_url": youtube_channel_url,
                            "is_resolved": True
                        }).eq("id", channel_id).execute()
                        channel_resolved = True
                        print(f"[Channels] Resolved {channel_name} -> {youtube_channel_id}")
                    else:
                        print(f"[Channels] Invalid channel_id: {youtube_channel_id}")
                        youtube_channel_id = None

        except Exception as e:
            print(f"[Channels] Failed to resolve {channel_name}: {e}")

    if not youtube_channel_id:
        return ImportVideosResponse(
            success=False,
            imported=0,
            skipped=0,
            errors=[f"Could not resolve YouTube channel for: {channel_name}"],
            channel_resolved=False
        )

    # Now fetch videos from the channel
    print(f"[Channels] Fetching videos from {channel_name} ({youtube_channel_id})")

    try:
        # Use channel URL to get videos
        channel_videos_url = f"https://www.youtube.com/channel/{youtube_channel_id}/videos"

        result = subprocess.run(
            [
                "yt-dlp",
                "--dump-json",
                "--flat-playlist",
                "--no-warnings",
                "--playlist-end", str(request.max_videos),
                channel_videos_url
            ],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            return ImportVideosResponse(
                success=False,
                imported=0,
                skipped=0,
                errors=[f"yt-dlp error: {result.stderr[:200]}"],
                channel_resolved=channel_resolved
            )

        # Parse videos
        videos_data = []
        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    videos_data.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        print(f"[Channels] Found {len(videos_data)} videos")

        imported = 0
        skipped = 0
        transcripts_found = 0
        errors = []

        for video_data in videos_data:
            try:
                video_id = video_data.get("id")
                if not video_id:
                    skipped += 1
                    continue

                # Check if video already exists
                existing = supabase.table("videos").select("id").eq("youtube_id", video_id).execute()
                if existing.data:
                    # Update with curated_channel_id if not set
                    supabase.table("videos").update({
                        "curated_channel_id": channel_id
                    }).eq("youtube_id", video_id).is_("curated_channel_id", "null").execute()
                    skipped += 1
                    continue

                # Insert new video
                duration = video_data.get("duration")
                # Get thumbnail - try direct field, then thumbnails array, then generate from video_id
                thumbnail = video_data.get("thumbnail")
                if not thumbnail:
                    thumbnails = video_data.get("thumbnails", [])
                    if thumbnails:
                        # Get highest quality thumbnail (usually last in array)
                        thumbnail = thumbnails[-1].get("url") if isinstance(thumbnails[-1], dict) else thumbnails[-1]
                if not thumbnail:
                    # Generate standard YouTube thumbnail URL
                    thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                # Get author - use channel field or fallback to curated channel name
                author = video_data.get("channel") or video_data.get("uploader") or channel_name

                # Try to download YouTube subtitles
                transcript = None
                try:
                    transcript = download_youtube_subtitles(video_id)
                    if transcript:
                        transcripts_found += 1
                        print(f"[Channels] Got transcript for {video_id} ({len(transcript)} chars)")
                except Exception as e:
                    print(f"[Channels] Subtitle error for {video_id}: {e}")

                video_record = {
                    "youtube_id": video_id,
                    "title": video_data.get("title", ""),
                    "author": author,
                    "channel_id": youtube_channel_id,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "thumbnail": thumbnail,
                    "duration": int(duration) if duration else 0,
                    "view_count": int(video_data.get("view_count") or 0),
                    "source": "curated_channel",
                    "curated_channel_id": channel_id,
                    "created_at": datetime.now().isoformat(),
                }

                # Add transcript if found
                if transcript:
                    video_record["transcript"] = transcript
                    video_record["has_transcript"] = True

                supabase.table("videos").insert(video_record).execute()
                imported += 1

            except Exception as e:
                errors.append(f"{video_data.get('id', 'unknown')}: {str(e)}")
                if len(errors) > 10:
                    break

        # Try to get channel info (subscriber count, thumbnail)
        channel_update_data = {
            "last_import_at": datetime.now().isoformat(),
            "total_videos_imported": channel.get("total_videos_imported", 0) + imported
        }

        # Get subscriber count from channel page
        try:
            channel_info_result = subprocess.run(
                [
                    "yt-dlp",
                    "--dump-json",
                    "--playlist-items", "0",
                    "--no-warnings",
                    f"https://www.youtube.com/channel/{youtube_channel_id}"
                ],
                capture_output=True,
                text=True,
                timeout=30
            )
            if channel_info_result.returncode == 0 and channel_info_result.stdout:
                channel_info = json.loads(channel_info_result.stdout)
                subscriber_count = channel_info.get("channel_follower_count")
                if subscriber_count:
                    channel_update_data["subscriber_count"] = subscriber_count
                    print(f"[Channels] {channel_name} has {subscriber_count:,} subscribers")
                # Get channel thumbnail
                channel_thumbnail = channel_info.get("thumbnail")
                if channel_thumbnail and not channel.get("thumbnail"):
                    channel_update_data["thumbnail"] = channel_thumbnail
        except Exception as e:
            print(f"[Channels] Could not get channel info: {e}")

        # Update channel stats
        supabase.table("curated_channels").update(channel_update_data).eq("id", channel_id).execute()

        print(f"[Channels] Imported {imported}, skipped {skipped}, transcripts {transcripts_found}")

        return ImportVideosResponse(
            success=True,
            imported=imported,
            skipped=skipped,
            transcripts_found=transcripts_found,
            errors=errors[:5],
            channel_resolved=channel_resolved
        )

    except subprocess.TimeoutExpired:
        return ImportVideosResponse(
            success=False,
            imported=0,
            skipped=0,
            errors=["Timeout fetching videos"],
            channel_resolved=channel_resolved
        )
    except Exception as e:
        return ImportVideosResponse(
            success=False,
            imported=0,
            skipped=0,
            errors=[str(e)],
            channel_resolved=channel_resolved
        )


# ============== Bulk Import ==============

class BulkImportRequest(BaseModel):
    channel_ids: Optional[List[int]] = None  # If None, import all favorites
    max_videos_per_channel: int = 10
    delay_seconds: int = 30  # Delay between channels


class BulkImportProgress(BaseModel):
    status: str  # "running", "completed", "error"
    total_channels: int
    processed_channels: int
    current_channel: Optional[str] = None
    results: List[dict]
    errors: List[str]


# Store for bulk import jobs (in production, use Redis or similar)
bulk_import_jobs: dict = {}


@router.post("/bulk-import/start")
async def start_bulk_import(request: BulkImportRequest):
    """
    Start bulk import of videos from multiple channels.
    Returns a job_id to track progress.
    """
    import asyncio
    import uuid
    import time

    supabase = get_supabase()
    job_id = str(uuid.uuid4())[:8]

    # Get channels to process
    if request.channel_ids:
        # Specific channels
        channels_response = supabase.table("curated_channels").select("id, name").in_("id", request.channel_ids).execute()
    else:
        # All favorites
        channels_response = supabase.table("curated_channels").select("id, name").eq("is_favorite", True).execute()

    channels = channels_response.data or []

    if not channels:
        return {"success": False, "error": "No hay canales para importar"}

    # Initialize job
    bulk_import_jobs[job_id] = {
        "status": "running",
        "total_channels": len(channels),
        "processed_channels": 0,
        "current_channel": None,
        "results": [],
        "errors": [],
        "started_at": datetime.now().isoformat()
    }

    # Start background task
    async def run_bulk_import():
        job = bulk_import_jobs[job_id]

        for i, channel in enumerate(channels):
            if job["status"] == "cancelled":
                break

            channel_id = channel["id"]
            channel_name = channel["name"]
            job["current_channel"] = channel_name
            job["processed_channels"] = i

            try:
                # Import videos for this channel
                import_request = ImportVideosRequest(
                    max_videos=request.max_videos_per_channel,
                    sort_by="date"
                )

                # Call the import function directly
                result = await import_videos_from_channel(channel_id, import_request)

                job["results"].append({
                    "channel": channel_name,
                    "imported": result.imported,
                    "skipped": result.skipped,
                    "transcripts": result.transcripts_found,
                    "success": result.success
                })

                if not result.success and result.errors:
                    job["errors"].extend([f"{channel_name}: {e}" for e in result.errors[:2]])

            except Exception as e:
                job["errors"].append(f"{channel_name}: {str(e)}")
                job["results"].append({
                    "channel": channel_name,
                    "imported": 0,
                    "skipped": 0,
                    "transcripts": 0,
                    "success": False
                })

            # Delay between channels (except for the last one)
            if i < len(channels) - 1 and job["status"] != "cancelled":
                await asyncio.sleep(request.delay_seconds)

        job["status"] = "completed" if job["status"] != "cancelled" else "cancelled"
        job["processed_channels"] = len(channels) if job["status"] == "completed" else job["processed_channels"]
        job["current_channel"] = None

    # Run in background
    asyncio.create_task(run_bulk_import())

    return {
        "success": True,
        "job_id": job_id,
        "total_channels": len(channels),
        "estimated_time_minutes": round((len(channels) * request.delay_seconds) / 60, 1)
    }


@router.get("/bulk-import/{job_id}")
async def get_bulk_import_progress(job_id: str):
    """Get progress of a bulk import job."""
    if job_id not in bulk_import_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return bulk_import_jobs[job_id]


@router.post("/bulk-import/{job_id}/cancel")
async def cancel_bulk_import(job_id: str):
    """Cancel a running bulk import job."""
    if job_id not in bulk_import_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    bulk_import_jobs[job_id]["status"] = "cancelled"
    return {"success": True, "message": "Job marked for cancellation"}


# ============== Update Subscriber Counts ==============

class UpdateSubscribersRequest(BaseModel):
    only_missing: bool = True  # Only update channels without subscriber_count
    only_favorites: bool = False  # Only update favorite channels
    delay_seconds: int = 5  # Delay between API calls to avoid rate limiting


@router.post("/update-subscribers/start")
async def start_update_subscribers(request: UpdateSubscribersRequest):
    """
    Start updating subscriber counts for channels.
    Returns a job_id to track progress.
    """
    import asyncio
    import uuid

    supabase = get_supabase()
    job_id = f"subs-{str(uuid.uuid4())[:6]}"

    # Build query for channels to update
    query = supabase.table("curated_channels").select("id, name, youtube_channel_id, youtube_url")

    if request.only_missing:
        query = query.is_("subscriber_count", "null")
    if request.only_favorites:
        query = query.eq("is_favorite", True)

    # Only channels with youtube_url or youtube_channel_id
    query = query.not_.is_("youtube_url", "null")

    channels_response = query.execute()
    channels = channels_response.data or []

    if not channels:
        return {"success": False, "error": "No hay canales para actualizar"}

    # Initialize job
    bulk_import_jobs[job_id] = {
        "status": "running",
        "total_channels": len(channels),
        "processed_channels": 0,
        "current_channel": None,
        "results": [],
        "errors": [],
        "started_at": datetime.now().isoformat()
    }

    async def run_update_subscribers():
        job = bulk_import_jobs[job_id]

        for i, channel in enumerate(channels):
            if job["status"] == "cancelled":
                break

            channel_id = channel["id"]
            channel_name = channel["name"]
            youtube_channel_id = channel.get("youtube_channel_id")
            youtube_url = channel.get("youtube_url")

            job["current_channel"] = channel_name
            job["processed_channels"] = i

            # Determine the URL to use
            if youtube_channel_id:
                target_url = f"https://www.youtube.com/channel/{youtube_channel_id}"
            elif youtube_url and "/results?" not in youtube_url:
                # Skip search URLs - they don't work with yt-dlp
                target_url = youtube_url
            else:
                reason = "URL de búsqueda (no válida)" if youtube_url and "/results?" in youtube_url else "No tiene URL de YouTube"
                job["errors"].append(f"{channel_name}: {reason}")
                job["results"].append({"channel": channel_name, "subscribers": 0, "success": False})
                continue

            try:
                # Get subscriber count from YouTube (use playlist-items 1 to get first video info)
                result = subprocess.run(
                    [
                        "yt-dlp",
                        "--dump-json",
                        "--playlist-items", "1",
                        "--no-warnings",
                        target_url
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                subscriber_count = None
                resolved_channel_id = None
                if result.returncode == 0 and result.stdout:
                    channel_info = json.loads(result.stdout)
                    subscriber_count = channel_info.get("channel_follower_count")
                    resolved_channel_id = channel_info.get("channel_id")

                if subscriber_count:
                    # Update in database - also save channel_id if we got it
                    update_data = {"subscriber_count": subscriber_count}
                    if resolved_channel_id and not youtube_channel_id:
                        update_data["youtube_channel_id"] = resolved_channel_id
                        update_data["is_resolved"] = True
                    supabase.table("curated_channels").update(update_data).eq("id", channel_id).execute()

                    job["results"].append({
                        "channel": channel_name,
                        "subscribers": subscriber_count,
                        "success": True
                    })
                else:
                    job["results"].append({
                        "channel": channel_name,
                        "subscribers": 0,
                        "success": False
                    })
                    job["errors"].append(f"{channel_name}: No se pudo obtener suscriptores")

            except Exception as e:
                job["errors"].append(f"{channel_name}: {str(e)}")
                job["results"].append({
                    "channel": channel_name,
                    "subscribers": 0,
                    "success": False
                })

            # Delay between API calls
            if i < len(channels) - 1 and job["status"] != "cancelled":
                await asyncio.sleep(request.delay_seconds)

        job["status"] = "completed" if job["status"] != "cancelled" else "cancelled"
        job["processed_channels"] = len(channels) if job["status"] == "completed" else job["processed_channels"]
        job["current_channel"] = None

    # Run in background
    asyncio.create_task(run_update_subscribers())

    return {
        "success": True,
        "job_id": job_id,
        "total_channels": len(channels),
        "estimated_time_minutes": round((len(channels) * request.delay_seconds) / 60, 1)
    }


class ResolveSearchUrlsRequest(BaseModel):
    delay_seconds: float = 2.0


@router.post("/resolve-search-urls/start")
async def start_resolve_search_urls(request: ResolveSearchUrlsRequest):
    """Resolve search URLs to real channel URLs using YouTube search"""
    supabase = get_supabase()
    job_id = f"resolve-{str(uuid.uuid4())[:6]}"

    # Get channels with search URLs
    channels_response = supabase.table("curated_channels").select(
        "id, name, youtube_url"
    ).like("youtube_url", "%/results?%").execute()

    channels = channels_response.data or []

    if not channels:
        return {"success": False, "error": "No hay canales con URLs de búsqueda para resolver"}

    # Initialize job
    bulk_import_jobs[job_id] = {
        "status": "running",
        "total_channels": len(channels),
        "processed_channels": 0,
        "current_channel": None,
        "results": [],
        "errors": [],
        "started_at": datetime.now().isoformat()
    }

    async def run_resolve_urls():
        job = bulk_import_jobs[job_id]

        for i, channel in enumerate(channels):
            if job["status"] == "cancelled":
                break

            channel_id = channel["id"]
            channel_name = channel["name"]

            job["current_channel"] = channel_name
            job["processed_channels"] = i

            try:
                # Search YouTube for the channel
                search_query = f"ytsearch1:{channel_name} channel"
                result = subprocess.run(
                    [
                        "yt-dlp",
                        "--dump-json",
                        "--no-warnings",
                        search_query
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                if result.returncode == 0 and result.stdout:
                    video_info = json.loads(result.stdout)
                    resolved_channel_id = video_info.get("channel_id")
                    uploader_url = video_info.get("uploader_url")
                    channel_found = video_info.get("channel")

                    if resolved_channel_id:
                        # Update in database
                        update_data = {
                            "youtube_channel_id": resolved_channel_id,
                            "is_resolved": True
                        }
                        if uploader_url:
                            update_data["youtube_url"] = uploader_url

                        supabase.table("curated_channels").update(update_data).eq("id", channel_id).execute()

                        job["results"].append({
                            "channel": channel_name,
                            "resolved_to": channel_found or uploader_url,
                            "success": True
                        })
                    else:
                        job["results"].append({
                            "channel": channel_name,
                            "resolved_to": None,
                            "success": False
                        })
                        job["errors"].append(f"{channel_name}: No se encontró canal")
                else:
                    job["results"].append({
                        "channel": channel_name,
                        "resolved_to": None,
                        "success": False
                    })
                    job["errors"].append(f"{channel_name}: Error en búsqueda")

            except Exception as e:
                job["errors"].append(f"{channel_name}: {str(e)}")
                job["results"].append({
                    "channel": channel_name,
                    "resolved_to": None,
                    "success": False
                })

            # Delay between API calls
            if i < len(channels) - 1 and job["status"] != "cancelled":
                await asyncio.sleep(request.delay_seconds)

        job["status"] = "completed" if job["status"] != "cancelled" else "cancelled"
        job["processed_channels"] = len(channels) if job["status"] == "completed" else job["processed_channels"]
        job["current_channel"] = None

    # Run in background
    asyncio.create_task(run_resolve_urls())

    return {
        "success": True,
        "job_id": job_id,
        "total_channels": len(channels),
        "estimated_time_minutes": round((len(channels) * request.delay_seconds) / 60, 1)
    }
