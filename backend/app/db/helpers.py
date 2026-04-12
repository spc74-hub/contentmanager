"""
Database helper functions used by routers that need synchronous-style DB access
(e.g., background tasks in scraper, ai_process).
"""
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    Video, SubscribedChannel, Area, Topic, VideoTopic, VideoTag, Tag
)
from app.db.session import async_session_maker


async def get_async_session() -> AsyncSession:
    """Get a new async session for background tasks."""
    return async_session_maker()


async def upsert_subscribed_channel(channel_id: str, channel_name: str, channel_url: str, thumbnail: str = None):
    async with async_session_maker() as db:
        result = await db.execute(select(SubscribedChannel).where(SubscribedChannel.channel_id == channel_id))
        existing = result.scalar_one_or_none()
        if existing:
            existing.channel_name = channel_name
            existing.channel_url = channel_url
            if thumbnail:
                existing.thumbnail = thumbnail
            await db.commit()
            return "updated"
        else:
            db.add(SubscribedChannel(
                channel_id=channel_id, channel_name=channel_name,
                channel_url=channel_url, thumbnail=thumbnail,
                is_active=True, total_videos_imported=0,
            ))
            await db.commit()
            return "created"


async def get_all_subscribed_channels():
    async with async_session_maker() as db:
        result = await db.execute(select(SubscribedChannel).order_by(SubscribedChannel.channel_name))
        return result.scalars().all()


async def video_exists_by_youtube_id(youtube_id: str) -> bool:
    async with async_session_maker() as db:
        result = await db.execute(select(Video.id).where(Video.youtube_id == youtube_id))
        return result.scalar_one_or_none() is not None


async def get_areas_and_topics():
    async with async_session_maker() as db:
        areas_r = await db.execute(select(Area).order_by(Area.sort_order))
        areas = areas_r.scalars().all()
        topics_r = await db.execute(select(Topic).order_by(Topic.name))
        topics = topics_r.scalars().all()
        return (
            [{"id": a.id, "name": a.name, "name_es": a.name_es} for a in areas],
            [{"id": t.id, "area_id": t.area_id, "name": t.name, "name_es": t.name_es} for t in topics],
        )


async def get_author_history(author: str) -> list:
    async with async_session_maker() as db:
        result = await db.execute(
            select(Video.id, Video.area_id, Area.name_es)
            .join(Area, Video.area_id == Area.id)
            .where(Video.author == author, Video.area_id.isnot(None))
            .limit(20)
        )
        return [{"video_id": r[0], "area_id": r[1], "area_name": r[2]} for r in result.all()]


async def get_video_tags_list(video_id: int) -> list:
    async with async_session_maker() as db:
        result = await db.execute(
            select(Tag.name).join(VideoTag, Tag.id == VideoTag.tag_id).where(VideoTag.video_id == video_id)
        )
        return [r[0] for r in result.all()]


async def update_video_fields(video_id: int, fields: dict):
    async with async_session_maker() as db:
        await db.execute(update(Video).where(Video.id == video_id).values(**fields))
        await db.commit()


async def insert_video_topic(video_id: int, topic_id: int, confidence: float = 1.0, needs_review: bool = False):
    async with async_session_maker() as db:
        existing = await db.execute(
            select(VideoTopic).where(VideoTopic.video_id == video_id, VideoTopic.topic_id == topic_id)
        )
        if not existing.scalar_one_or_none():
            db.add(VideoTopic(video_id=video_id, topic_id=topic_id, confidence=confidence, needs_review=needs_review))
            await db.commit()
