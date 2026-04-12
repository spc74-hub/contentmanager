"""
Router for curated channels management.
Handles CRUD operations for curated YouTube channels with classification.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
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
import io
import csv
from pathlib import Path
from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import (
    CuratedChannel as CuratedChannelModel, ChannelTheme as ChannelThemeModel,
    ChannelTag as ChannelTagModel, ChannelTagAssignment,
    ChannelLevel as ChannelLevelModel, ChannelEnergy as ChannelEnergyModel,
    ChannelUseType as ChannelUseTypeModel,
)

router = APIRouter(prefix="/api/channels", tags=["channels"])


# ============== Pydantic Models ==============

class ChannelTheme(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0

class ThemeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6B7280"
    sort_order: int = 0

class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

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
    language: str = "es"
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
    language: str = "es"

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    youtube_url: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    youtube_channel_url: Optional[str] = None
    theme_id: Optional[int] = None
    level: Optional[str] = None
    energy: Optional[str] = None
    use_type: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None
    is_resolved: Optional[bool] = None
    is_favorite: Optional[bool] = None
    subscriber_count: Optional[int] = None

class ChannelsResponse(BaseModel):
    channels: List[CuratedChannel]
    total: int
    themes: List[ChannelTheme]

class TagCreate(BaseModel):
    name: str
    color: str = "#6B7280"

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class ChannelLevelPydantic(BaseModel):
    id: int
    name: str
    label: str
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelLevelCreate(BaseModel):
    name: str
    label: str
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelLevelUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class ChannelEnergyPydantic(BaseModel):
    id: int
    name: str
    label: str
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelEnergyCreate(BaseModel):
    name: str
    label: str
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelEnergyUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class ChannelUseTypePydantic(BaseModel):
    id: int
    name: str
    label: str
    icon: str = "BookOpen"
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelUseTypeCreate(BaseModel):
    name: str
    label: str
    icon: str = "BookOpen"
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0

class ChannelUseTypeUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class ChannelStats(BaseModel):
    total_channels: int
    resolved_channels: int
    by_theme: dict
    by_level: dict
    by_energy: dict
    by_use_type: dict
    by_language: dict
    by_subscriber_range: dict

class AddByUrlRequest(BaseModel):
    url: str

class AddByUrlResponse(BaseModel):
    success: bool
    channel_id: Optional[int] = None
    channel_name: Optional[str] = None
    error: Optional[str] = None


# ============== Helper ==============

def channel_to_dict(ch: CuratedChannelModel) -> dict:
    return {
        "id": ch.id, "name": ch.name, "youtube_url": ch.youtube_url,
        "youtube_channel_id": ch.youtube_channel_id, "youtube_channel_url": ch.youtube_channel_url,
        "thumbnail": ch.thumbnail, "theme_id": ch.theme_id,
        "theme_name": ch.theme.name if ch.theme else None,
        "level": ch.level, "energy": ch.energy, "use_type": ch.use_type,
        "language": ch.language, "is_active": ch.is_active, "is_resolved": ch.is_resolved,
        "is_favorite": ch.is_favorite, "subscriber_count": ch.subscriber_count,
        "last_import_at": ch.last_import_at.isoformat() if ch.last_import_at else None,
        "total_videos_imported": ch.total_videos_imported,
        "created_at": ch.created_at.isoformat() if ch.created_at else None,
    }


def parse_vtt_subtitles(vtt_path: str) -> Optional[str]:
    try:
        with open(vtt_path, 'r', encoding='utf-8') as f:
            content = f.read()
        lines = content.split('\n')
        text_lines = []
        seen_lines = set()
        for line in lines:
            line = line.strip()
            if not line or line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:') or '-->' in line or line.isdigit():
                continue
            line = re.sub(r'<[^>]+>', '', line)
            line = re.sub(r'\[.*?\]', '', line).strip()
            if line and line not in seen_lines:
                seen_lines.add(line)
                text_lines.append(line)
        transcript = ' '.join(text_lines)
        transcript = re.sub(r'\s+', ' ', transcript).strip()
        return transcript if len(transcript) > 20 else None
    except Exception:
        return None


def download_youtube_subtitles(video_id: str) -> Optional[str]:
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory() as tmpdir:
        for lang in ["es", "en"]:
            for auto_flag in [False, True]:
                cmd = [
                    "yt-dlp", "--skip-download",
                    "--write-auto-sub" if auto_flag else "--write-sub",
                    "--sub-lang", lang, "--sub-format", "vtt",
                    "-o", os.path.join(tmpdir, "subtitle"), "--quiet", "--no-warnings",
                    video_url
                ]
                try:
                    subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                    for f in os.listdir(tmpdir):
                        if f.endswith('.vtt'):
                            transcript = parse_vtt_subtitles(os.path.join(tmpdir, f))
                            if transcript and len(transcript) > 50:
                                return transcript
                            os.remove(os.path.join(tmpdir, f))
                except (subprocess.TimeoutExpired, Exception):
                    continue
        return None


# ============== Themes Endpoints ==============

@router.get("/themes", response_model=List[ChannelTheme])
async def get_themes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelThemeModel).order_by(ChannelThemeModel.sort_order))
    return [ChannelTheme(id=t.id, name=t.name, description=t.description, color=t.color, sort_order=t.sort_order) for t in result.scalars().all()]


@router.post("/themes", response_model=ChannelTheme)
async def create_theme(theme: ThemeCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(ChannelThemeModel).where(ChannelThemeModel.name == theme.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"El tema '{theme.name}' ya existe")
    db_theme = ChannelThemeModel(name=theme.name, description=theme.description, color=theme.color, sort_order=theme.sort_order)
    db.add(db_theme)
    await db.commit()
    await db.refresh(db_theme)
    return ChannelTheme(id=db_theme.id, name=db_theme.name, description=db_theme.description, color=db_theme.color, sort_order=db_theme.sort_order)


@router.put("/themes/{theme_id}", response_model=ChannelTheme)
async def update_theme(theme_id: int, theme: ThemeUpdate, db: AsyncSession = Depends(get_db)):
    data = theme.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    result = await db.execute(select(ChannelThemeModel).where(ChannelThemeModel.id == theme_id))
    db_theme = result.scalar_one_or_none()
    if not db_theme:
        raise HTTPException(status_code=404, detail="Tema no encontrado")
    for k, v in data.items():
        setattr(db_theme, k, v)
    await db.commit()
    await db.refresh(db_theme)
    return ChannelTheme(id=db_theme.id, name=db_theme.name, description=db_theme.description, color=db_theme.color, sort_order=db_theme.sort_order)


@router.delete("/themes/{theme_id}")
async def delete_theme(theme_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelThemeModel).where(ChannelThemeModel.id == theme_id))
    theme = result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Tema no encontrado")
    count_r = await db.execute(select(func.count(CuratedChannelModel.id)).where(CuratedChannelModel.theme_id == theme_id))
    count = count_r.scalar() or 0
    if count > 0:
        await db.execute(update(CuratedChannelModel).where(CuratedChannelModel.theme_id == theme_id).values(theme_id=None))
    await db.execute(delete(ChannelThemeModel).where(ChannelThemeModel.id == theme_id))
    await db.commit()
    return {"success": True, "deleted_theme": theme.name, "channels_affected": count}


# ============== Channel Levels CRUD ==============

@router.get("/levels", response_model=List[ChannelLevelPydantic])
async def get_levels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelLevelModel).order_by(ChannelLevelModel.sort_order))
    return [ChannelLevelPydantic(id=l.id, name=l.name, label=l.label, color=l.color, sort_order=l.sort_order) for l in result.scalars().all()]


@router.post("/levels", response_model=ChannelLevelPydantic)
async def create_level(level: ChannelLevelCreate, db: AsyncSession = Depends(get_db)):
    db_level = ChannelLevelModel(**level.model_dump())
    db.add(db_level)
    await db.commit()
    await db.refresh(db_level)
    return ChannelLevelPydantic(id=db_level.id, name=db_level.name, label=db_level.label, color=db_level.color, sort_order=db_level.sort_order)


@router.put("/levels/{level_id}", response_model=ChannelLevelPydantic)
async def update_level(level_id: int, level: ChannelLevelUpdate, db: AsyncSession = Depends(get_db)):
    data = level.model_dump(exclude_none=True)
    result = await db.execute(select(ChannelLevelModel).where(ChannelLevelModel.id == level_id))
    db_level = result.scalar_one_or_none()
    if not db_level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    for k, v in data.items():
        setattr(db_level, k, v)
    await db.commit()
    await db.refresh(db_level)
    return ChannelLevelPydantic(id=db_level.id, name=db_level.name, label=db_level.label, color=db_level.color, sort_order=db_level.sort_order)


@router.delete("/levels/{level_id}")
async def delete_level(level_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelLevelModel).where(ChannelLevelModel.id == level_id))
    db_level = result.scalar_one_or_none()
    if not db_level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    await db.execute(delete(ChannelLevelModel).where(ChannelLevelModel.id == level_id))
    await db.commit()
    return {"success": True, "deleted_level": db_level.name}


# ============== Channel Energies CRUD ==============

@router.get("/energies", response_model=List[ChannelEnergyPydantic])
async def get_energies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelEnergyModel).order_by(ChannelEnergyModel.sort_order))
    return [ChannelEnergyPydantic(id=e.id, name=e.name, label=e.label, color=e.color, sort_order=e.sort_order) for e in result.scalars().all()]


@router.post("/energies", response_model=ChannelEnergyPydantic)
async def create_energy(energy: ChannelEnergyCreate, db: AsyncSession = Depends(get_db)):
    db_energy = ChannelEnergyModel(**energy.model_dump())
    db.add(db_energy)
    await db.commit()
    await db.refresh(db_energy)
    return ChannelEnergyPydantic(id=db_energy.id, name=db_energy.name, label=db_energy.label, color=db_energy.color, sort_order=db_energy.sort_order)


@router.put("/energies/{energy_id}", response_model=ChannelEnergyPydantic)
async def update_energy(energy_id: int, energy: ChannelEnergyUpdate, db: AsyncSession = Depends(get_db)):
    data = energy.model_dump(exclude_none=True)
    result = await db.execute(select(ChannelEnergyModel).where(ChannelEnergyModel.id == energy_id))
    db_energy = result.scalar_one_or_none()
    if not db_energy:
        raise HTTPException(status_code=404, detail="Energia no encontrada")
    for k, v in data.items():
        setattr(db_energy, k, v)
    await db.commit()
    await db.refresh(db_energy)
    return ChannelEnergyPydantic(id=db_energy.id, name=db_energy.name, label=db_energy.label, color=db_energy.color, sort_order=db_energy.sort_order)


@router.delete("/energies/{energy_id}")
async def delete_energy(energy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelEnergyModel).where(ChannelEnergyModel.id == energy_id))
    db_energy = result.scalar_one_or_none()
    if not db_energy:
        raise HTTPException(status_code=404, detail="Energia no encontrada")
    await db.execute(delete(ChannelEnergyModel).where(ChannelEnergyModel.id == energy_id))
    await db.commit()
    return {"success": True, "deleted_energy": db_energy.name}


# ============== Channel Use Types CRUD ==============

@router.get("/use-types", response_model=List[ChannelUseTypePydantic])
async def get_use_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelUseTypeModel).order_by(ChannelUseTypeModel.sort_order))
    return [ChannelUseTypePydantic(id=u.id, name=u.name, label=u.label, icon=u.icon, color=u.color, sort_order=u.sort_order) for u in result.scalars().all()]


@router.post("/use-types", response_model=ChannelUseTypePydantic)
async def create_use_type(use_type: ChannelUseTypeCreate, db: AsyncSession = Depends(get_db)):
    db_ut = ChannelUseTypeModel(**use_type.model_dump())
    db.add(db_ut)
    await db.commit()
    await db.refresh(db_ut)
    return ChannelUseTypePydantic(id=db_ut.id, name=db_ut.name, label=db_ut.label, icon=db_ut.icon, color=db_ut.color, sort_order=db_ut.sort_order)


@router.put("/use-types/{use_type_id}", response_model=ChannelUseTypePydantic)
async def update_use_type(use_type_id: int, use_type: ChannelUseTypeUpdate, db: AsyncSession = Depends(get_db)):
    data = use_type.model_dump(exclude_none=True)
    result = await db.execute(select(ChannelUseTypeModel).where(ChannelUseTypeModel.id == use_type_id))
    db_ut = result.scalar_one_or_none()
    if not db_ut:
        raise HTTPException(status_code=404, detail="Tipo de uso no encontrado")
    for k, v in data.items():
        setattr(db_ut, k, v)
    await db.commit()
    await db.refresh(db_ut)
    return ChannelUseTypePydantic(id=db_ut.id, name=db_ut.name, label=db_ut.label, icon=db_ut.icon, color=db_ut.color, sort_order=db_ut.sort_order)


@router.delete("/use-types/{use_type_id}")
async def delete_use_type(use_type_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelUseTypeModel).where(ChannelUseTypeModel.id == use_type_id))
    db_ut = result.scalar_one_or_none()
    if not db_ut:
        raise HTTPException(status_code=404, detail="Tipo de uso no encontrado")
    await db.execute(delete(ChannelUseTypeModel).where(ChannelUseTypeModel.id == use_type_id))
    await db.commit()
    return {"success": True, "deleted_use_type": db_ut.name}


# ============== Channels CRUD ==============

@router.get("", response_model=ChannelsResponse)
async def get_channels(
    theme_id: Optional[int] = None, level: Optional[str] = None, energy: Optional[str] = None,
    use_type: Optional[str] = None, language: Optional[str] = None,
    subscriber_range: Optional[str] = None, is_resolved: Optional[bool] = None,
    is_favorite: Optional[bool] = None, search: Optional[str] = None,
    limit: int = 100, offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(CuratedChannelModel).options(selectinload(CuratedChannelModel.theme))
    count_query = select(func.count(CuratedChannelModel.id))

    conditions = []
    if theme_id:
        conditions.append(CuratedChannelModel.theme_id == theme_id)
    if level:
        conditions.append(CuratedChannelModel.level == level)
    if energy:
        conditions.append(CuratedChannelModel.energy == energy)
    if use_type:
        conditions.append(CuratedChannelModel.use_type == use_type)
    if language:
        conditions.append(CuratedChannelModel.language == language)
    if is_resolved is not None:
        conditions.append(CuratedChannelModel.is_resolved == is_resolved)
    if is_favorite is not None:
        conditions.append(CuratedChannelModel.is_favorite == is_favorite)
    if search:
        conditions.append(CuratedChannelModel.name.ilike(f"%{search}%"))

    subscriber_ranges = {
        "0": (None, 0), "1-10K": (1, 10000), "10K-100K": (10000, 100000),
        "100K-500K": (100000, 500000), "500K-1M": (500000, 1000000),
        "1M-5M": (1000000, 5000000), "5M+": (5000000, None),
    }
    if subscriber_range and subscriber_range in subscriber_ranges:
        min_s, max_s = subscriber_ranges[subscriber_range]
        if subscriber_range == "0":
            conditions.append(or_(CuratedChannelModel.subscriber_count.is_(None), CuratedChannelModel.subscriber_count == 0))
        else:
            if min_s is not None:
                conditions.append(CuratedChannelModel.subscriber_count >= min_s)
            if max_s is not None:
                conditions.append(CuratedChannelModel.subscriber_count < max_s)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(CuratedChannelModel.name).offset(offset).limit(limit)
    result = await db.execute(query)
    channels = [CuratedChannel(**channel_to_dict(ch)) for ch in result.scalars().all()]

    themes_result = await db.execute(select(ChannelThemeModel).order_by(ChannelThemeModel.sort_order))
    themes = [ChannelTheme(id=t.id, name=t.name, description=t.description, color=t.color, sort_order=t.sort_order) for t in themes_result.scalars().all()]

    return ChannelsResponse(channels=channels, total=total, themes=themes)


@router.get("/stats", response_model=ChannelStats)
async def get_channel_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CuratedChannelModel).options(selectinload(CuratedChannelModel.theme)))
    channels = result.scalars().all()
    by_theme, by_level, by_energy, by_use_type, by_language = {}, {}, {}, {}, {}
    by_subscriber_range = {"0": 0, "1-10K": 0, "10K-100K": 0, "100K-500K": 0, "500K-1M": 0, "1M-5M": 0, "5M+": 0}
    resolved_count = 0

    for ch in channels:
        theme_name = ch.theme.name if ch.theme else "Sin tema"
        by_theme[theme_name] = by_theme.get(theme_name, 0) + 1
        by_level[ch.level] = by_level.get(ch.level, 0) + 1
        by_energy[ch.energy] = by_energy.get(ch.energy, 0) + 1
        by_use_type[ch.use_type] = by_use_type.get(ch.use_type, 0) + 1
        lang = ch.language or "es"
        by_language[lang] = by_language.get(lang, 0) + 1
        subs = ch.subscriber_count
        if subs is None or subs == 0: sr = "0"
        elif subs < 10000: sr = "1-10K"
        elif subs < 100000: sr = "10K-100K"
        elif subs < 500000: sr = "100K-500K"
        elif subs < 1000000: sr = "500K-1M"
        elif subs < 5000000: sr = "1M-5M"
        else: sr = "5M+"
        by_subscriber_range[sr] += 1
        if ch.is_resolved:
            resolved_count += 1

    return ChannelStats(
        total_channels=len(channels), resolved_channels=resolved_count,
        by_theme=by_theme, by_level=by_level, by_energy=by_energy,
        by_use_type=by_use_type, by_language=by_language, by_subscriber_range=by_subscriber_range,
    )


@router.post("/add-by-url", response_model=AddByUrlResponse)
async def add_channel_by_url(request: AddByUrlRequest, db: AsyncSession = Depends(get_db)):
    url = request.url.strip()
    if not url:
        return AddByUrlResponse(success=False, error="URL vacia")
    try:
        proc_result = subprocess.run(
            ["yt-dlp", "--dump-json", "--playlist-items", "1", "--no-warnings", url],
            capture_output=True, text=True, timeout=60
        )
        if proc_result.returncode != 0:
            return AddByUrlResponse(success=False, error=f"No se pudo resolver el canal")
        data = json.loads(proc_result.stdout)
        channel_name = data.get("channel") or data.get("uploader") or "Canal desconocido"
        channel_id = data.get("channel_id")
        channel_url = data.get("channel_url")

        existing = await db.execute(select(CuratedChannelModel).where(CuratedChannelModel.name == channel_name))
        if existing.scalar_one_or_none():
            return AddByUrlResponse(success=False, error=f"El canal '{channel_name}' ya existe")

        # Get or create "Suscripciones" theme
        theme_r = await db.execute(select(ChannelThemeModel).where(ChannelThemeModel.name == "Suscripciones"))
        theme = theme_r.scalar_one_or_none()
        if not theme:
            theme = ChannelThemeModel(name="Suscripciones", sort_order=100, color="#6366f1")
            db.add(theme)
            await db.flush()

        db_channel = CuratedChannelModel(
            name=channel_name, youtube_url=url, youtube_channel_id=channel_id,
            youtube_channel_url=channel_url, theme_id=theme.id,
            level="medio", energy="media", use_type="inspiracion", is_resolved=bool(channel_id),
        )
        db.add(db_channel)
        await db.commit()
        await db.refresh(db_channel)
        return AddByUrlResponse(success=True, channel_id=db_channel.id, channel_name=channel_name)
    except Exception as e:
        return AddByUrlResponse(success=False, error=str(e))


@router.post("", response_model=CuratedChannel)
async def create_channel(channel: ChannelCreate, db: AsyncSession = Depends(get_db)):
    db_channel = CuratedChannelModel(**channel.model_dump(exclude_none=True))
    db.add(db_channel)
    await db.commit()
    await db.refresh(db_channel, ["theme"])
    return CuratedChannel(**channel_to_dict(db_channel))


@router.put("/{channel_id}", response_model=CuratedChannel)
async def update_channel(channel_id: int, channel: ChannelUpdate, db: AsyncSession = Depends(get_db)):
    data = channel.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.execute(select(CuratedChannelModel).options(selectinload(CuratedChannelModel.theme)).where(CuratedChannelModel.id == channel_id))
    db_channel = result.scalar_one_or_none()
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    for k, v in data.items():
        setattr(db_channel, k, v)
    await db.commit()
    await db.refresh(db_channel, ["theme"])
    return CuratedChannel(**channel_to_dict(db_channel))


@router.delete("/{channel_id}")
async def delete_channel(channel_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(CuratedChannelModel).where(CuratedChannelModel.id == channel_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"success": True, "deleted_id": channel_id}


@router.post("/{channel_id}/toggle-favorite")
async def toggle_favorite(channel_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CuratedChannelModel).where(CuratedChannelModel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    ch.is_favorite = not ch.is_favorite
    await db.commit()
    return {"success": True, "is_favorite": ch.is_favorite}


# ============== Tag Endpoints ==============

@router.get("/tags")
async def get_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelTagModel).order_by(ChannelTagModel.name))
    return [{"id": t.id, "name": t.name, "color": t.color} for t in result.scalars().all()]


@router.post("/tags")
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db)):
    db_tag = ChannelTagModel(name=tag.name, color=tag.color)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return {"id": db_tag.id, "name": db_tag.name, "color": db_tag.color}


@router.put("/tags/{tag_id}")
async def update_tag(tag_id: int, tag: TagUpdate, db: AsyncSession = Depends(get_db)):
    data = tag.model_dump(exclude_none=True)
    result = await db.execute(select(ChannelTagModel).where(ChannelTagModel.id == tag_id))
    db_tag = result.scalar_one_or_none()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for k, v in data.items():
        setattr(db_tag, k, v)
    await db.commit()
    await db.refresh(db_tag)
    return {"id": db_tag.id, "name": db_tag.name, "color": db_tag.color}


@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(ChannelTagModel).where(ChannelTagModel.id == tag_id))
    await db.commit()
    return {"success": True, "deleted_id": tag_id}


@router.get("/export")
async def export_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CuratedChannelModel).options(selectinload(CuratedChannelModel.theme)).order_by(CuratedChannelModel.name))
    channels = result.scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nombre", "Tematica", "Nivel", "Energia", "Uso", "URL YouTube", "Canal ID", "Resuelto", "Favorito", "Videos Importados"])
    for ch in channels:
        youtube_url = ch.youtube_channel_url or ch.youtube_url or ""
        if not youtube_url and ch.youtube_channel_id:
            youtube_url = f"https://www.youtube.com/channel/{ch.youtube_channel_id}"
        writer.writerow([
            ch.name, ch.theme.name if ch.theme else "Sin tema",
            ch.level, ch.energy, ch.use_type, youtube_url,
            ch.youtube_channel_id or "", "Si" if ch.is_resolved else "No",
            "Si" if ch.is_favorite else "No", ch.total_videos_imported,
        ])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=canales_curados.csv"})
