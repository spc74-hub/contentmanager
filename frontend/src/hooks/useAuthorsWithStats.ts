import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AuthorWithStats, Area, FavoriteAuthor } from '@/types'

interface VideoWithArea {
  id: number
  author: string
  view_count: number
  area_id: number | null
  areas: Area | null
}

interface AuthorsFilters {
  areaId?: number
  topicId?: number
}

export function useAuthorsWithStats(filters?: AuthorsFilters) {
  const { areaId, topicId } = filters || {}

  return useQuery({
    queryKey: ['authors-with-stats', areaId, topicId],
    queryFn: async () => {
      // Get all videos with their areas
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, author, view_count, area_id, areas(id, name_es, icon, color)')

      if (videosError) throw videosError

      // Get favorite authors
      const { data: favorites, error: favError } = await supabase
        .from('favorite_authors')
        .select('author_name')

      if (favError) throw favError

      const favoriteSet = new Set(favorites?.map((f: FavoriteAuthor) => f.author_name) || [])

      // If filtering by topic, get video IDs that have that topic
      let videoIdsWithTopic: Set<number> | null = null
      if (topicId) {
        const { data: videoTopics, error: topicsError } = await supabase
          .from('video_topics')
          .select('video_id')
          .eq('topic_id', topicId)

        if (topicsError) throw topicsError
        videoIdsWithTopic = new Set(videoTopics?.map((vt: { video_id: number }) => vt.video_id) || [])
      }

      // Group by author
      const authorMap = new Map<string, {
        video_count: number
        total_views: number
        areas: Map<number, { id: number; name_es: string; icon: string; color: string; count: number }>
      }>()

      for (const video of videos as VideoWithArea[]) {
        // If filtering by topic, skip videos that don't have the topic
        if (videoIdsWithTopic && !videoIdsWithTopic.has(video.id)) {
          continue
        }

        const existing = authorMap.get(video.author) || {
          video_count: 0,
          total_views: 0,
          areas: new Map()
        }

        existing.video_count += 1
        existing.total_views += video.view_count || 0

        if (video.area_id && video.areas) {
          const area = video.areas as Area
          const areaStats = existing.areas.get(area.id) || {
            id: area.id,
            name_es: area.name_es,
            icon: area.icon,
            color: area.color,
            count: 0
          }
          areaStats.count += 1
          existing.areas.set(area.id, areaStats)
        }

        authorMap.set(video.author, existing)
      }

      // Convert to array and sort by video count
      let authors: AuthorWithStats[] = Array.from(authorMap.entries()).map(([author, stats]) => {
        const areasArray = Array.from(stats.areas.values()).sort((a, b) => b.count - a.count)
        const mainArea = areasArray.length > 0 ? areasArray[0] as unknown as Area : null

        return {
          author,
          video_count: stats.video_count,
          total_views: stats.total_views,
          areas: areasArray,
          main_area: mainArea,
          is_favorite: favoriteSet.has(author)
        }
      })

      // Filter by area if specified
      if (areaId) {
        authors = authors.filter(a => a.areas.some(area => area.id === areaId))
      }

      // Sort by video count descending
      authors.sort((a, b) => b.video_count - a.video_count)

      return authors
    },
  })
}
