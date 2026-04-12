import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Area, TopicWithArea } from '@/types'

// ============================================================================
// AREAS HOOKS
// ============================================================================

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: () => apiFetch<Area[]>('/api/taxonomy/areas'),
  })
}

export function useArea(id: number) {
  return useQuery({
    queryKey: ['area', id],
    queryFn: () => apiFetch<Area>(`/api/taxonomy/areas/${id}`),
    enabled: !!id,
  })
}

// ============================================================================
// TOPICS HOOKS
// ============================================================================

export function useTopics(areaId?: number) {
  return useQuery({
    queryKey: ['topics', areaId],
    queryFn: () => {
      const qs = areaId ? `?area_id=${areaId}` : ''
      return apiFetch<TopicWithArea[]>(`/api/taxonomy/topics${qs}`)
    },
  })
}

export function useTopic(id: number) {
  return useQuery({
    queryKey: ['topic', id],
    queryFn: () => apiFetch<TopicWithArea>(`/api/taxonomy/topics/${id}`),
    enabled: !!id,
  })
}

export function useTopicsGroupedByArea() {
  const { data: areas } = useAreas()
  const { data: topics } = useTopics()

  if (!areas || !topics) return { data: null, isLoading: true }

  const grouped = areas.map(area => ({
    area,
    topics: topics.filter(t => t.area_id === area.id)
  }))

  return { data: grouped, isLoading: false }
}

// ============================================================================
// VIDEO TOPICS HOOKS
// ============================================================================

export function useVideoTopics(videoId: number) {
  return useQuery({
    queryKey: ['video-topics', videoId],
    // This would need a dedicated endpoint; for now return empty
    queryFn: async () => [] as unknown[],
    enabled: !!videoId,
  })
}

export function useAddVideoTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ videoIds, topicId }: { videoIds?: number[]; videoId?: number; topicId: number }) => {
      const ids = videoIds || (arguments[0] as { videoId: number }).videoId ? [(arguments[0] as { videoId: number }).videoId] : []
      return apiFetch('/api/taxonomy/videos/bulk/assign-topic', {
        method: 'POST',
        body: JSON.stringify({ video_ids: ids, topic_id: topicId }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-topics'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })
}

export function useRemoveVideoTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ videoId, topicId }: { videoId: number; topicId: number }) =>
      apiFetch('/api/taxonomy/videos/bulk/assign-topic', {
        method: 'POST',
        body: JSON.stringify({ video_ids: [videoId], topic_id: topicId, remove: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-topics'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })
}

// ============================================================================
// VIDEO AREA UPDATE
// ============================================================================

export function useUpdateVideoArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ videoId, areaId }: { videoId: number; areaId: number | null }) => {
      const qs = areaId ? `?area_id=${areaId}` : ''
      return apiFetch(`/api/taxonomy/videos/${videoId}/area${qs}`, { method: 'PUT' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

// ============================================================================
// TAXONOMY VIDEO PREVIEW HOOKS
// ============================================================================

export interface TaxonomyVideoPreview {
  id: number
  title: string
  author: string
  url: string
  thumbnail: string | null
}

export function useVideosByArea(areaId: number | null, limit: number = 20) {
  return useQuery({
    queryKey: ['taxonomy-videos-area', areaId, limit],
    queryFn: async () => {
      if (!areaId) return []
      const data = await apiFetch<{ id: number; title: string; author: string; url: string; thumbnail: string | null }[]>(`/api/videos?area_id=${areaId}`)
      return data.slice(0, limit) as TaxonomyVideoPreview[]
    },
    enabled: !!areaId,
  })
}

export function useVideosByTopic(_topicId: number | null, _limit: number = 20) {
  return useQuery({
    queryKey: ['taxonomy-videos-topic', _topicId, _limit],
    queryFn: async () => [] as TaxonomyVideoPreview[],
    enabled: !!_topicId,
  })
}

export function useVideosByTag(_tagId: number | null, _limit: number = 20) {
  return useQuery({
    queryKey: ['taxonomy-videos-tag', _tagId, _limit],
    queryFn: async () => [] as TaxonomyVideoPreview[],
    enabled: !!_tagId,
  })
}
