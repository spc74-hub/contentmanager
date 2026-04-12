import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Tag {
  id: number
  name: string
  video_count: number
}

export function useTags(limit?: number) {
  return useQuery({
    queryKey: ['tags', limit],
    queryFn: async () => {
      const data = await apiFetch<Tag[]>('/api/taxonomy/tag-groups')
      return limit ? data.slice(0, limit) : data
    },
  })
}

export function useVideoTags(_videoId: number) {
  return useQuery({
    queryKey: ['video-tags', _videoId],
    queryFn: async () => [] as Tag[],
    enabled: !!_videoId,
  })
}

export interface Subcategory {
  id: number
  name: string
  category_id: number
  video_count: number
}

export function useSubcategories(_categoryId?: number) {
  return useQuery({
    queryKey: ['subcategories', _categoryId],
    queryFn: async () => [] as Subcategory[],
  })
}

export function useVideoSubcategories(_videoId: number) {
  return useQuery({
    queryKey: ['video-subcategories', _videoId],
    queryFn: async () => [] as Subcategory[],
    enabled: !!_videoId,
  })
}
