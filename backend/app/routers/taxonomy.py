"""
Taxonomy Management Router
CRUD for Areas, Topics, Tag Groups + Bulk Video Actions
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_db
from app.db.models import Area, Topic, Video, VideoTopic, Tag, TagGroup, VideoTag

router = APIRouter()


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
    area_id: Optional[int] = None
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
    area_id: Optional[int]


class BulkAssignTopic(BaseModel):
    video_ids: List[int]
    topic_id: int
    remove: bool = False


class MergeTags(BaseModel):
    source_tag_ids: List[int]
    target_tag_id: int


class CountsFilter(BaseModel):
    status: Optional[str] = "all"
    sources: Optional[List[str]] = None
    exclude_sources: Optional[List[str]] = None
    search: Optional[str] = None
    area_id: Optional[int] = None


def area_to_dict(a: Area) -> dict:
    return {
        "id": a.id, "name": a.name, "name_es": a.name_es, "icon": a.icon,
        "color": a.color, "sort_order": a.sort_order, "video_count": a.video_count,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def topic_to_dict(t: Topic, include_area=False) -> dict:
    d = {
        "id": t.id, "area_id": t.area_id, "name": t.name, "name_es": t.name_es,
        "description": t.description, "video_count": t.video_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
    if include_area and t.area:
        d["area"] = area_to_dict(t.area)
    return d


def tag_group_to_dict(tg: TagGroup) -> dict:
    return {
        "id": tg.id, "name": tg.name, "description": tg.description,
        "icon": tg.icon, "color": tg.color, "sort_order": tg.sort_order,
        "tag_count": tg.tag_count, "video_count": tg.video_count,
        "created_at": tg.created_at.isoformat() if tg.created_at else None,
    }


# ============================================================================
# AREAS
# ============================================================================

@router.get("/areas")
async def get_areas(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Area).order_by(Area.sort_order))
    return [area_to_dict(a) for a in result.scalars().all()]


@router.get("/areas/{area_id}")
async def get_area(area_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Area).where(Area.id == area_id))
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    return area_to_dict(area)


@router.post("/areas")
async def create_area(area: AreaCreate, db: AsyncSession = Depends(get_db)):
    db_area = Area(**area.model_dump())
    db.add(db_area)
    await db.commit()
    await db.refresh(db_area)
    return area_to_dict(db_area)


@router.put("/areas/{area_id}")
async def update_area(area_id: int, area: AreaUpdate, db: AsyncSession = Depends(get_db)):
    update_data = {k: v for k, v in area.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.execute(select(Area).where(Area.id == area_id))
    db_area = result.scalar_one_or_none()
    if not db_area:
        raise HTTPException(status_code=404, detail="Area not found")
    for k, v in update_data.items():
        setattr(db_area, k, v)
    await db.commit()
    await db.refresh(db_area)
    return area_to_dict(db_area)


@router.delete("/areas/{area_id}")
async def delete_area(area_id: int, reassign_to: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Area).where(Area.id == area_id))
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    video_count = area.video_count or 0
    if reassign_to:
        await db.execute(update(Video).where(Video.area_id == area_id).values(area_id=reassign_to))
    await db.execute(delete(Area).where(Area.id == area_id))
    await db.commit()
    return {"deleted": True, "videos_affected": video_count, "reassigned_to": reassign_to}


# ============================================================================
# TOPICS
# ============================================================================

@router.get("/topics")
async def get_topics(area_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = select(Topic).options(selectinload(Topic.area)).order_by(Topic.name)
    if area_id:
        query = query.where(Topic.area_id == area_id)
    result = await db.execute(query)
    return [topic_to_dict(t, include_area=True) for t in result.scalars().all()]


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).options(selectinload(Topic.area)).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic_to_dict(topic, include_area=True)


@router.post("/topics")
async def create_topic(topic: TopicCreate, db: AsyncSession = Depends(get_db)):
    area_r = await db.execute(select(Area).where(Area.id == topic.area_id))
    if not area_r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Area not found")
    db_topic = Topic(**topic.model_dump())
    db.add(db_topic)
    await db.commit()
    await db.refresh(db_topic)
    return topic_to_dict(db_topic)


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: int, topic: TopicUpdate, db: AsyncSession = Depends(get_db)):
    update_data = {k: v for k, v in topic.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    db_topic = result.scalar_one_or_none()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    for k, v in update_data.items():
        setattr(db_topic, k, v)
    await db.commit()
    await db.refresh(db_topic)
    return topic_to_dict(db_topic)


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    video_count = topic.video_count or 0
    await db.execute(delete(Topic).where(Topic.id == topic_id))
    await db.commit()
    return {"deleted": True, "videos_affected": video_count}


# ============================================================================
# TAG GROUPS
# ============================================================================

@router.get("/tag-groups")
async def get_tag_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TagGroup).order_by(TagGroup.sort_order))
    return [tag_group_to_dict(tg) for tg in result.scalars().all()]


@router.get("/tag-groups/{group_id}")
async def get_tag_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TagGroup).where(TagGroup.id == group_id))
    tg = result.scalar_one_or_none()
    if not tg:
        raise HTTPException(status_code=404, detail="Tag group not found")
    return tag_group_to_dict(tg)


@router.get("/tag-groups/{group_id}/tags")
async def get_tags_by_group(group_id: int, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tag).where(Tag.group_id == group_id).order_by(Tag.video_count.desc()).limit(limit)
    )
    return [{"id": t.id, "name": t.name, "video_count": t.video_count, "group_id": t.group_id} for t in result.scalars().all()]


@router.post("/tag-groups")
async def create_tag_group(group: TagGroupCreate, db: AsyncSession = Depends(get_db)):
    db_tg = TagGroup(**group.model_dump())
    db.add(db_tg)
    await db.commit()
    await db.refresh(db_tg)
    return tag_group_to_dict(db_tg)


@router.put("/tag-groups/{group_id}")
async def update_tag_group(group_id: int, group: TagGroupUpdate, db: AsyncSession = Depends(get_db)):
    update_data = {k: v for k, v in group.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.execute(select(TagGroup).where(TagGroup.id == group_id))
    db_tg = result.scalar_one_or_none()
    if not db_tg:
        raise HTTPException(status_code=404, detail="Tag group not found")
    for k, v in update_data.items():
        setattr(db_tg, k, v)
    await db.commit()
    await db.refresh(db_tg)
    return tag_group_to_dict(db_tg)


@router.put("/tags/{tag_id}/group")
async def assign_tag_to_group(tag_id: int, group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.group_id = group_id
    await db.commit()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "group_id": tag.group_id}


# ============================================================================
# BULK VIDEO ACTIONS
# ============================================================================

@router.post("/videos/bulk/archive")
async def bulk_archive_videos(data: BulkVideoIds, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    result = await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(is_archived=True))
    await db.commit()
    return {"archived": result.rowcount}


@router.post("/videos/bulk/unarchive")
async def bulk_unarchive_videos(data: BulkVideoIds, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    result = await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(is_archived=False))
    await db.commit()
    return {"unarchived": result.rowcount}


@router.post("/videos/bulk/validate")
async def bulk_validate_videos(data: BulkVideoIds, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    result = await db.execute(
        update(Video).where(Video.id.in_(data.video_ids)).values(
            is_validated=True, validated_at=datetime.utcnow()
        )
    )
    await db.commit()
    return {"validated": result.rowcount}


@router.post("/videos/bulk/unvalidate")
async def bulk_unvalidate_videos(data: BulkVideoIds, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    result = await db.execute(
        update(Video).where(Video.id.in_(data.video_ids)).values(is_validated=False, validated_at=None)
    )
    await db.commit()
    return {"unvalidated": result.rowcount}


@router.post("/videos/bulk/assign-area")
async def bulk_assign_area(data: BulkAssignArea, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    if data.area_id:
        area_r = await db.execute(select(Area).where(Area.id == data.area_id))
        if not area_r.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Area not found")
    result = await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(area_id=data.area_id))
    await db.commit()
    return {"updated": result.rowcount, "area_id": data.area_id}


@router.post("/videos/bulk/assign-topic")
async def bulk_assign_topic(data: BulkAssignTopic, db: AsyncSession = Depends(get_db)):
    if not data.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    topic_r = await db.execute(select(Topic).where(Topic.id == data.topic_id))
    topic = topic_r.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic not found")
    if data.remove:
        for video_id in data.video_ids:
            await db.execute(delete(VideoTopic).where(VideoTopic.video_id == video_id, VideoTopic.topic_id == data.topic_id))
        await db.commit()
        return {"removed": len(data.video_ids), "topic_id": data.topic_id}
    else:
        inserted = 0
        for video_id in data.video_ids:
            existing = await db.execute(
                select(VideoTopic).where(VideoTopic.video_id == video_id, VideoTopic.topic_id == data.topic_id)
            )
            if not existing.scalar_one_or_none():
                db.add(VideoTopic(video_id=video_id, topic_id=data.topic_id))
                inserted += 1
        await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(area_id=topic.area_id))
        await db.commit()
        return {"added": inserted, "topic_id": data.topic_id, "area_id": topic.area_id}


# ============================================================================
# SINGLE VIDEO STATUS ACTIONS
# ============================================================================

@router.put("/videos/{video_id}/archive")
async def archive_video(video_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.is_archived = True
    await db.commit()
    return {"id": video.id, "is_archived": True}


@router.put("/videos/{video_id}/unarchive")
async def unarchive_video(video_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.is_archived = False
    await db.commit()
    return {"id": video.id, "is_archived": False}


@router.put("/videos/{video_id}/validate")
async def validate_video(video_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.is_validated = True
    video.validated_at = datetime.utcnow()
    await db.commit()
    return {"id": video.id, "is_validated": True}


@router.put("/videos/{video_id}/area")
async def update_video_area(video_id: int, area_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    if area_id:
        area_r = await db.execute(select(Area).where(Area.id == area_id))
        if not area_r.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Area not found")
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.area_id = area_id
    await db.commit()
    return {"id": video.id, "area_id": area_id}


# ============================================================================
# TAG MERGE
# ============================================================================

@router.post("/tags/merge")
async def merge_tags(data: MergeTags, db: AsyncSession = Depends(get_db)):
    if not data.source_tag_ids:
        raise HTTPException(status_code=400, detail="No source tag IDs provided")
    if data.target_tag_id in data.source_tag_ids:
        raise HTTPException(status_code=400, detail="Target tag cannot be in source tags")
    target_r = await db.execute(select(Tag).where(Tag.id == data.target_tag_id))
    if not target_r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Target tag not found")

    merged_count = 0
    for source_id in data.source_tag_ids:
        vt_r = await db.execute(select(VideoTag).where(VideoTag.tag_id == source_id))
        video_tags = vt_r.scalars().all()
        for vt in video_tags:
            existing = await db.execute(
                select(VideoTag).where(VideoTag.video_id == vt.video_id, VideoTag.tag_id == data.target_tag_id)
            )
            if not existing.scalar_one_or_none():
                db.add(VideoTag(video_id=vt.video_id, tag_id=data.target_tag_id))
                merged_count += 1
        await db.execute(delete(Tag).where(Tag.id == source_id))

    count_r = await db.execute(select(func.count()).select_from(VideoTag).where(VideoTag.tag_id == data.target_tag_id))
    new_count = count_r.scalar() or 0
    await db.execute(update(Tag).where(Tag.id == data.target_tag_id).values(video_count=new_count))
    await db.commit()
    return {"merged": len(data.source_tag_ids), "new_videos_added": merged_count, "target_tag_id": data.target_tag_id, "new_video_count": new_count}


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/stats")
async def get_taxonomy_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Video.id)))).scalar() or 0
    archived = (await db.execute(select(func.count(Video.id)).where(Video.is_archived == True))).scalar() or 0
    validated = (await db.execute(select(func.count(Video.id)).where(Video.is_validated == True, Video.is_archived == False))).scalar() or 0
    pending = (await db.execute(select(func.count(Video.id)).where(Video.is_validated == False, Video.is_archived == False))).scalar() or 0
    areas_count = (await db.execute(select(func.count(Area.id)))).scalar() or 0
    topics_count = (await db.execute(select(func.count(Topic.id)))).scalar() or 0
    no_area = (await db.execute(select(func.count(Video.id)).where(Video.area_id.is_(None), Video.is_archived == False))).scalar() or 0

    return {
        "videos": {"total": total, "archived": archived, "validated": validated, "pending": pending, "no_area": no_area},
        "taxonomy": {"areas": areas_count, "topics": topics_count},
    }


# ============================================================================
# FILTERED COUNTS
# ============================================================================

@router.post("/counts")
async def get_filtered_counts(filters: CountsFilter, db: AsyncSession = Depends(get_db)):
    query = select(Video.id, Video.area_id)

    if filters.status == "pending":
        query = query.where(Video.is_validated == False, Video.is_archived == False)
    elif filters.status == "validated":
        query = query.where(Video.is_validated == True, Video.is_archived == False)
    elif filters.status == "archived":
        query = query.where(Video.is_archived == True)
    else:
        query = query.where(Video.is_archived == False)

    if filters.sources:
        query = query.where(Video.source.in_(filters.sources))
    if filters.exclude_sources:
        for source in filters.exclude_sources:
            query = query.where(Video.source != source)
    if filters.search:
        query = query.where(Video.title.ilike(f"%{filters.search}%"))
    if filters.area_id:
        query = query.where(Video.area_id == filters.area_id)

    result = await db.execute(query)
    all_videos = result.all()

    area_counts = {}
    video_ids = []
    for row in all_videos:
        video_ids.append(row.id)
        area_id = row.area_id
        key = area_id if area_id else None
        area_counts[key] = area_counts.get(key, 0) + 1

    tag_group_counts = {}
    tag_counts = {}
    if video_ids:
        vt_result = await db.execute(
            select(VideoTag.video_id, VideoTag.tag_id, Tag.id, Tag.name, Tag.group_id)
            .join(Tag, VideoTag.tag_id == Tag.id)
            .where(VideoTag.video_id.in_(video_ids))
        )
        videos_per_tag = {}
        videos_per_group = {}
        for row in vt_result.all():
            video_id, tag_id_val, t_id, t_name, group_id = row
            if t_id not in videos_per_tag:
                videos_per_tag[t_id] = set()
            videos_per_tag[t_id].add(video_id)
            if group_id:
                if group_id not in videos_per_group:
                    videos_per_group[group_id] = set()
                videos_per_group[group_id].add(video_id)

        tag_counts = {tid: len(vset) for tid, vset in videos_per_tag.items()}
        tag_group_counts = {gid: len(vset) for gid, vset in videos_per_group.items()}

    return {
        "total_videos": len(all_videos),
        "area_counts": area_counts,
        "tag_group_counts": tag_group_counts,
        "tag_counts": tag_counts,
    }
