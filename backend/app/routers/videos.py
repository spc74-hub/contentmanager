from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.db.models import Video, Category

router = APIRouter()


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


def video_to_dict(v: Video) -> dict:
    d = {
        "id": v.id, "youtube_id": v.youtube_id, "title": v.title, "author": v.author,
        "channel_id": v.channel_id, "description": v.description, "summary": v.summary,
        "key_points": v.key_points or [], "duration": v.duration, "view_count": v.view_count,
        "like_count": v.like_count, "url": v.url, "thumbnail": v.thumbnail,
        "upload_date": v.upload_date, "category_id": v.category_id, "area_id": v.area_id,
        "source": v.source, "is_favorite": v.is_favorite, "is_archived": v.is_archived,
        "is_validated": v.is_validated, "has_transcript": v.has_transcript,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }
    if v.category:
        d["categories"] = {"id": v.category.id, "name": v.category.name, "icon": v.category.icon, "color": v.category.color}
    else:
        d["categories"] = None
    if v.area:
        d["areas"] = {"id": v.area.id, "name": v.area.name, "name_es": v.area.name_es, "icon": v.area.icon, "color": v.area.color, "sort_order": v.area.sort_order, "video_count": v.area.video_count}
    else:
        d["areas"] = None
    return d


@router.get("/")
async def get_videos(category_id: Optional[int] = None, author: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(Video).options(selectinload(Video.category), selectinload(Video.area))
    if category_id:
        query = query.where(Video.category_id == category_id)
    if author:
        query = query.where(Video.author == author)
    query = query.order_by(Video.created_at.desc())
    result = await db.execute(query)
    videos = result.scalars().all()
    return [video_to_dict(v) for v in videos]


@router.get("/{video_id}")
async def get_video(video_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video).options(selectinload(Video.category), selectinload(Video.area)).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video_to_dict(video)


@router.post("/")
async def create_video(video: VideoCreate, db: AsyncSession = Depends(get_db)):
    db_video = Video(
        youtube_id=video.youtube_id, title=video.title, author=video.author,
        summary=video.summary, duration=video.duration, like_count=video.likes,
        url=video.url, thumbnail=video.thumbnail, category_id=video.category_id,
    )
    db.add(db_video)
    await db.commit()
    await db.refresh(db_video)
    return {"id": db_video.id, "title": db_video.title}


@router.post("/bulk")
async def create_videos_bulk(videos: list[VideoCreate], db: AsyncSession = Depends(get_db)):
    db_videos = [
        Video(
            youtube_id=v.youtube_id, title=v.title, author=v.author,
            summary=v.summary, duration=v.duration, like_count=v.likes,
            url=v.url, thumbnail=v.thumbnail, category_id=v.category_id,
        )
        for v in videos
    ]
    db.add_all(db_videos)
    await db.commit()
    return {"created": len(db_videos)}


@router.put("/{video_id}")
async def update_video(video_id: int, video: VideoUpdate, db: AsyncSession = Depends(get_db)):
    update_data = {k: v for k, v in video.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "likes" in update_data:
        update_data["like_count"] = update_data.pop("likes")
    result = await db.execute(select(Video).where(Video.id == video_id))
    db_video = result.scalar_one_or_none()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    for k, v in update_data.items():
        setattr(db_video, k, v)
    await db.commit()
    await db.refresh(db_video)
    return {"id": db_video.id, "title": db_video.title}


@router.delete("/{video_id}")
async def delete_video(video_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Video).where(Video.id == video_id))
    await db.commit()
    return {"deleted": True}


@router.post("/delete-bulk")
async def delete_videos_bulk(video_ids: list[int], db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Video).where(Video.id.in_(video_ids)))
    await db.commit()
    return {"deleted": result.rowcount, "total": len(video_ids)}


@router.post("/fix-thumbnails")
async def fix_missing_thumbnails(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video.id, Video.youtube_id).where(Video.thumbnail.is_(None))
    )
    rows = result.all()
    fixed_count = 0
    for row in rows:
        if row.youtube_id:
            new_thumbnail = f"https://i.ytimg.com/vi/{row.youtube_id}/hqdefault.jpg"
            await db.execute(
                update(Video).where(Video.id == row.id).values(thumbnail=new_thumbnail)
            )
            fixed_count += 1
    await db.commit()
    return {"fixed": fixed_count, "total_null": len(rows)}


@router.get("/authors/list")
async def get_authors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video.author).distinct().order_by(Video.author))
    authors = [row[0] for row in result.all()]
    return authors
