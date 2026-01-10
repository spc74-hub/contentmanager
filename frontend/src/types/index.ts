export * from './database'

export interface VideoFilters {
  categoryId?: number
  areaId?: number      // New taxonomy: filter by area
  topicId?: number     // New taxonomy: filter by topic
  author?: string
  durationRange?: string
  viewsRange?: string
  searchTerm?: string
  sortBy?: 'recent' | 'published' | 'views' | 'duration' | 'title'
  sortOrder?: 'asc' | 'desc'
  source?: string  // 'liked', 'playlist', 'single', 'watch_later'
  tagId?: number   // Filter by tag
  subcategoryId?: number  // Filter by AI subcategory (deprecated)
  aiStatus?: 'all' | 'processed' | 'pending'  // AI processing status
  isFavorite?: boolean  // Filter favorite videos
  curatedChannelId?: number  // Filter by curated channel
  channelTheme?: string  // Filter by channel theme/category
}

// Source types for video imports
// Based on actual sources in the database: liked_videos, playlist, tiktok, subscription, curated_channel
export type VideoSource = 'liked_videos' | 'playlist' | 'tiktok' | 'subscription' | 'curated_channel'

export const VIDEO_SOURCES: Record<VideoSource, string> = {
  liked_videos: 'Liked Videos',
  playlist: 'Playlist',
  tiktok: 'TikTok',
  subscription: 'Suscripciones',
  curated_channel: 'Canales curados'
}

export interface YouTubePlaylist {
  id: string
  title: string
  description: string
  videoCount: number
  thumbnail: string
}

export interface YouTubeVideo {
  id: string
  title: string
  author: string
  description: string
  duration: number
  likes: number
  views: number
  url: string
  thumbnail: string
  publishedAt: string
}

export interface Stats {
  totalVideos: number
  totalCategories: number
  totalAuthors: number
  videosByCategory: Record<number, number>
  videosByAuthor: Record<string, number>
}
