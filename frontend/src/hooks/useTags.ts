import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Tag {
  id: number
  name: string
  video_count: number
}

export function useTags(limit?: number) {
  return useQuery({
    queryKey: ['tags', limit],
    queryFn: async () => {
      let query = supabase
        .from('tags')
        .select('*')
        .order('video_count', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Tag[]
    },
  })
}

// useSearchTags is exported from useTaxonomy.ts (includes tag_group info)

export function useVideoTags(videoId: number) {
  return useQuery({
    queryKey: ['video-tags', videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_tags')
        .select('tags(*)')
        .eq('video_id', videoId)

      if (error) throw error
      return data.map(vt => (vt as unknown as { tags: Tag }).tags)
    },
    enabled: !!videoId,
  })
}

export interface Subcategory {
  id: number
  name: string
  category_id: number
  video_count: number
}

export function useSubcategories(categoryId?: number) {
  return useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('subcategories')
        .select('*')
        .order('video_count', { ascending: false })

      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Subcategory[]
    },
  })
}

export function useVideoSubcategories(videoId: number) {
  return useQuery({
    queryKey: ['video-subcategories', videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_subcategories')
        .select('subcategories(*)')
        .eq('video_id', videoId)

      if (error) throw error
      return data.map(vs => (vs as unknown as { subcategories: Subcategory }).subcategories)
    },
    enabled: !!videoId,
  })
}
