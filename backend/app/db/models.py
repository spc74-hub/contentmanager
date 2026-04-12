"""
SQLAlchemy ORM models for all 20+ tables in the content_manager database.
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey,
    BigInteger, UniqueConstraint, Index, func, ARRAY
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


# ============================================================================
# CATEGORIES (legacy)
# ============================================================================

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    videos: Mapped[List["Video"]] = relationship(back_populates="category")


# ============================================================================
# AREAS (new taxonomy)
# ============================================================================

class Area(Base):
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_es: Mapped[Optional[str]] = mapped_column(String(255))
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    color: Mapped[Optional[str]] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topics: Mapped[List["Topic"]] = relationship(back_populates="area", cascade="all, delete-orphan")
    videos: Mapped[List["Video"]] = relationship(back_populates="area")


# ============================================================================
# TOPICS
# ============================================================================

class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    area_id: Mapped[int] = mapped_column(Integer, ForeignKey("areas.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_es: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    area: Mapped["Area"] = relationship(back_populates="topics")
    video_topics: Mapped[List["VideoTopic"]] = relationship(back_populates="topic", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("name", "area_id", name="uq_topic_name_area"),
        Index("idx_topics_area_id", "area_id"),
        Index("idx_topics_video_count", video_count.desc()),
    )


# ============================================================================
# VIDEOS
# ============================================================================

class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    youtube_id: Mapped[Optional[str]] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_id: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, default="")
    summary: Mapped[Optional[str]] = mapped_column(Text, default="")
    key_points = Column(ARRAY(Text), default=[])
    duration: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail: Mapped[Optional[str]] = mapped_column(String(500))
    upload_date: Mapped[Optional[str]] = mapped_column(String(20))
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    curated_channel_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("curated_channels.id", ondelete="SET NULL"))
    source: Mapped[Optional[str]] = mapped_column(String(50), default="")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    has_transcript: Mapped[bool] = mapped_column(Boolean, default=False)
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    embedding = Column(Vector(768))
    embedding_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped["Category"] = relationship(back_populates="videos")
    area: Mapped[Optional["Area"]] = relationship(back_populates="videos")
    curated_channel: Mapped[Optional["CuratedChannel"]] = relationship(back_populates="videos")
    video_tags: Mapped[List["VideoTag"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    video_topics: Mapped[List["VideoTopic"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    video_subcategories: Mapped[List["VideoSubcategory"]] = relationship(back_populates="video", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_videos_category", "category_id"),
        Index("idx_videos_author", "author"),
        Index("idx_videos_youtube_id", "youtube_id"),
        Index("idx_videos_area_id", "area_id"),
        Index("idx_videos_source", "source"),
    )


# ============================================================================
# VIDEO-TOPICS junction
# ============================================================================

class VideoTopic(Base):
    __tablename__ = "video_topics"

    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True)
    topic_id: Mapped[int] = mapped_column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, default=1.0)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    video: Mapped["Video"] = relationship(back_populates="video_topics")
    topic: Mapped["Topic"] = relationship(back_populates="video_topics")

    __table_args__ = (
        Index("idx_video_topics_topic_id", "topic_id"),
    )


# ============================================================================
# TAGS
# ============================================================================

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tag_groups.id", ondelete="SET NULL"))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tag_group: Mapped[Optional["TagGroup"]] = relationship(back_populates="tags")
    video_tags: Mapped[List["VideoTag"]] = relationship(back_populates="tag", cascade="all, delete-orphan")


# ============================================================================
# TAG GROUPS
# ============================================================================

class TagGroup(Base):
    __tablename__ = "tag_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    color: Mapped[Optional[str]] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    tag_count: Mapped[int] = mapped_column(Integer, default=0)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tags: Mapped[List["Tag"]] = relationship(back_populates="tag_group")


# ============================================================================
# VIDEO-TAGS junction
# ============================================================================

class VideoTag(Base):
    __tablename__ = "video_tags"

    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    video: Mapped["Video"] = relationship(back_populates="video_tags")
    tag: Mapped["Tag"] = relationship(back_populates="video_tags")


# ============================================================================
# SUBCATEGORIES (legacy)
# ============================================================================

class Subcategory(Base):
    __tablename__ = "subcategories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id", ondelete="CASCADE"))
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================================
# VIDEO-SUBCATEGORIES junction
# ============================================================================

class VideoSubcategory(Base):
    __tablename__ = "video_subcategories"

    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True)
    subcategory_id: Mapped[int] = mapped_column(Integer, ForeignKey("subcategories.id", ondelete="CASCADE"), primary_key=True)

    video: Mapped["Video"] = relationship(back_populates="video_subcategories")


# ============================================================================
# FAVORITE AUTHORS
# ============================================================================

class FavoriteAuthor(Base):
    __tablename__ = "favorite_authors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================================
# CHANNEL THEMES
# ============================================================================

class ChannelTheme(Base):
    __tablename__ = "channel_themes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    channels: Mapped[List["CuratedChannel"]] = relationship(back_populates="theme")


# ============================================================================
# CURATED CHANNELS
# ============================================================================

class CuratedChannel(Base):
    __tablename__ = "curated_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    youtube_url: Mapped[Optional[str]] = mapped_column(String(500))
    youtube_channel_id: Mapped[Optional[str]] = mapped_column(String(100))
    youtube_channel_url: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail: Mapped[Optional[str]] = mapped_column(String(500))
    theme_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("channel_themes.id", ondelete="SET NULL"))
    level: Mapped[str] = mapped_column(String(50), default="medio")
    energy: Mapped[str] = mapped_column(String(50), default="media")
    use_type: Mapped[str] = mapped_column(String(50), default="inspiracion")
    language: Mapped[str] = mapped_column(String(10), default="es")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    subscriber_count: Mapped[Optional[int]] = mapped_column(Integer)
    last_import_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_videos_imported: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    theme: Mapped[Optional["ChannelTheme"]] = relationship(back_populates="channels")
    videos: Mapped[List["Video"]] = relationship(back_populates="curated_channel")
    tag_assignments: Mapped[List["ChannelTagAssignment"]] = relationship(back_populates="channel", cascade="all, delete-orphan")


# ============================================================================
# CHANNEL TAGS
# ============================================================================

class ChannelTag(Base):
    __tablename__ = "channel_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(20), default="#6B7280")
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    assignments: Mapped[List["ChannelTagAssignment"]] = relationship(back_populates="tag", cascade="all, delete-orphan")


# ============================================================================
# CHANNEL TAG ASSIGNMENTS
# ============================================================================

class ChannelTagAssignment(Base):
    __tablename__ = "channel_tag_assignments"

    channel_id: Mapped[int] = mapped_column(Integer, ForeignKey("curated_channels.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("channel_tags.id", ondelete="CASCADE"), primary_key=True)

    channel: Mapped["CuratedChannel"] = relationship(back_populates="tag_assignments")
    tag: Mapped["ChannelTag"] = relationship(back_populates="assignments")


# ============================================================================
# CHANNEL LEVELS
# ============================================================================

class ChannelLevel(Base):
    __tablename__ = "channel_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(100), default="bg-gray-100 text-gray-700")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ============================================================================
# CHANNEL ENERGIES
# ============================================================================

class ChannelEnergy(Base):
    __tablename__ = "channel_energies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(100), default="bg-gray-100 text-gray-700")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ============================================================================
# CHANNEL USE TYPES
# ============================================================================

class ChannelUseType(Base):
    __tablename__ = "channel_use_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="BookOpen")
    color: Mapped[str] = mapped_column(String(100), default="bg-gray-100 text-gray-700")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ============================================================================
# SUBSCRIBED CHANNELS
# ============================================================================

class SubscribedChannel(Base):
    __tablename__ = "subscribed_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    channel_name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    first_import_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_video_date: Mapped[Optional[str]] = mapped_column(String(20))
    last_import_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_videos_imported: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ============================================================================
# USERS (for JWT auth)
# ============================================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
