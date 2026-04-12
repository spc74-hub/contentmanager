import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { AuthorWithStats } from '@/types'

interface AuthorsFilters {
  areaId?: number
  topicId?: number
}

export function useAuthorsWithStats(filters?: AuthorsFilters) {
  const { areaId, topicId } = filters || {}

  return useQuery({
    queryKey: ['authors-with-stats', areaId, topicId],
    queryFn: async () => {
      // Get all videos with their areas from the API
      const videos = await apiFetch<{
        id: number; author: string; view_count: number;
        area_id: number | null; areas: { id: number; name_es: string; icon: string; color: string } | null
      }[]>('/api/videos')

      // Group by author
      const authorMap = new Map<string, {
        video_count: number; total_views: number;
        areas: Map<number, { id: number; name_es: string; icon: string; color: string; count: number }>
      }>()

      for (const video of videos) {
        const existing = authorMap.get(video.author) || { video_count: 0, total_views: 0, areas: new Map() }
        existing.video_count += 1
        existing.total_views += video.view_count || 0
        if (video.area_id && video.areas) {
          const area = video.areas
          const areaStats = existing.areas.get(area.id) || { ...area, count: 0 }
          areaStats.count += 1
          existing.areas.set(area.id, areaStats)
        }
        authorMap.set(video.author, existing)
      }

      let authors: AuthorWithStats[] = Array.from(authorMap.entries()).map(([author, stats]) => {
        const areasArray = Array.from(stats.areas.values()).sort((a, b) => b.count - a.count)
        return {
          author,
          video_count: stats.video_count,
          total_views: stats.total_views,
          areas: areasArray,
          main_area: areasArray.length > 0 ? areasArray[0] as never : null,
          is_favorite: false,
        }
      })

      if (areaId) {
        authors = authors.filter(a => a.areas.some(area => area.id === areaId))
      }
      authors.sort((a, b) => b.video_count - a.video_count)
      return authors
    },
  })
}
