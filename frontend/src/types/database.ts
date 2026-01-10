export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number
          name: string
          icon: string
          color: string
          video_count: number
          created_at: string
        }
        Insert: {
          name: string
          icon: string
          color: string
        }
        Update: {
          name?: string
          icon?: string
          color?: string
        }
      }
      videos: {
        Row: {
          id: number
          youtube_id: string | null
          title: string
          author: string
          channel_id: string | null
          description: string
          summary: string
          key_points: string[]
          duration: number
          view_count: number
          like_count: number
          url: string
          thumbnail: string | null
          upload_date: string | null
          category_id: number
          area_id: number | null
          is_favorite: boolean
          source: string
          has_transcript: boolean
          transcript: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          youtube_id?: string | null
          title: string
          author: string
          channel_id?: string | null
          description?: string
          summary?: string
          key_points?: string[]
          duration: number
          view_count?: number
          like_count?: number
          url: string
          thumbnail?: string | null
          upload_date?: string | null
          category_id: number
          area_id?: number | null
          is_favorite?: boolean
          source?: string
          has_transcript?: boolean
          transcript?: string | null
        }
        Update: {
          youtube_id?: string | null
          title?: string
          author?: string
          channel_id?: string | null
          description?: string
          summary?: string
          key_points?: string[]
          duration?: number
          view_count?: number
          like_count?: number
          url?: string
          thumbnail?: string | null
          upload_date?: string | null
          category_id?: number
          area_id?: number | null
          is_favorite?: boolean
          source?: string
          has_transcript?: boolean
          transcript?: string | null
        }
      }
      tags: {
        Row: {
          id: number
          name: string
          video_count: number
          created_at: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
      }
      subcategories: {
        Row: {
          id: number
          name: string
          category_id: number
          video_count: number
          created_at: string
        }
        Insert: {
          name: string
          category_id: number
        }
        Update: {
          name?: string
          category_id?: number
        }
      }
      video_tags: {
        Row: {
          video_id: number
          tag_id: number
        }
        Insert: {
          video_id: number
          tag_id: number
        }
        Update: {
          video_id?: number
          tag_id?: number
        }
      }
      video_subcategories: {
        Row: {
          video_id: number
          subcategory_id: number
        }
        Insert: {
          video_id: number
          subcategory_id: number
        }
        Update: {
          video_id?: number
          subcategory_id?: number
        }
      }
      // New taxonomy tables
      areas: {
        Row: {
          id: number
          name_es: string
          name_en: string
          icon: string
          color: string
          sort_order: number
          video_count: number
          created_at: string
        }
        Insert: {
          name_es: string
          name_en: string
          icon: string
          color: string
          sort_order?: number
        }
        Update: {
          name_es?: string
          name_en?: string
          icon?: string
          color?: string
          sort_order?: number
        }
      }
      topics: {
        Row: {
          id: number
          area_id: number
          name_es: string
          name_en: string
          description: string | null
          video_count: number
          created_at: string
        }
        Insert: {
          area_id: number
          name_es: string
          name_en: string
          description?: string | null
        }
        Update: {
          area_id?: number
          name_es?: string
          name_en?: string
          description?: string | null
        }
      }
      video_topics: {
        Row: {
          video_id: number
          topic_id: number
          confidence: number | null
          needs_review: boolean
        }
        Insert: {
          video_id: number
          topic_id: number
          confidence?: number | null
          needs_review?: boolean
        }
        Update: {
          confidence?: number | null
          needs_review?: boolean
        }
      }
      favorite_authors: {
        Row: {
          id: number
          author_name: string
          notes: string | null
          created_at: string
        }
        Insert: {
          author_name: string
          notes?: string | null
        }
        Update: {
          author_name?: string
          notes?: string | null
        }
      }
    }
  }
}

export type Category = Database['public']['Tables']['categories']['Row']
export type Video = Database['public']['Tables']['videos']['Row']
export type VideoInsert = Database['public']['Tables']['videos']['Insert']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type Tag = Database['public']['Tables']['tags']['Row']
export type Subcategory = Database['public']['Tables']['subcategories']['Row']

// New taxonomy types
export type Area = Database['public']['Tables']['areas']['Row']
export type AreaInsert = Database['public']['Tables']['areas']['Insert']
export type Topic = Database['public']['Tables']['topics']['Row']
export type TopicInsert = Database['public']['Tables']['topics']['Insert']
export type VideoTopic = Database['public']['Tables']['video_topics']['Row']
export type FavoriteAuthor = Database['public']['Tables']['favorite_authors']['Row']
export type FavoriteAuthorInsert = Database['public']['Tables']['favorite_authors']['Insert']

// Extended types with relations
export type TopicWithArea = Topic & { area: Area }
export type VideoWithArea = Video & { area: Area | null }
export type VideoWithTopics = Video & { topics: Topic[] }

// Author stats type
export interface AuthorWithStats {
  author: string
  video_count: number
  total_views: number
  areas: { id: number; name_es: string; icon: string; color: string; count: number }[]
  main_area: Area | null
  is_favorite: boolean
}
