import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Area, TopicWithArea } from '@/types'

// ============================================================================
// AREAS HOOKS
// ============================================================================

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as Area[]
    },
  })
}

export function useArea(id: number) {
  return useQuery({
    queryKey: ['area', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Area
    },
    enabled: !!id,
  })
}

// ============================================================================
// TOPICS HOOKS
// ============================================================================

export function useTopics(areaId?: number) {
  return useQuery({
    queryKey: ['topics', areaId],
    queryFn: async () => {
      let query = supabase
        .from('topics')
        .select('*, area:areas(*)')
        .order('name_es', { ascending: true })

      if (areaId) {
        query = query.eq('area_id', areaId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as TopicWithArea[]
    },
  })
}

export function useTopic(id: number) {
  return useQuery({
    queryKey: ['topic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('*, area:areas(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as TopicWithArea
    },
    enabled: !!id,
  })
}

// Get topics grouped by area (for dropdown menus)
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_topics')
        .select('*, topic:topics(*, area:areas(*))')
        .eq('video_id', videoId)
      if (error) throw error
      return data
    },
    enabled: !!videoId,
  })
}

export function useAddVideoTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, topicId }: { videoId: number; topicId: number }) => {
      const { error } = await supabase
        .from('video_topics')
        .insert({ video_id: videoId, topic_id: topicId } as never)
      if (error) throw error
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['video-topics', videoId] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })
}

export function useRemoveVideoTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, topicId }: { videoId: number; topicId: number }) => {
      const { error } = await supabase
        .from('video_topics')
        .delete()
        .eq('video_id', videoId)
        .eq('topic_id', topicId)
      if (error) throw error
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['video-topics', videoId] })
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
    mutationFn: async ({ videoId, areaId }: { videoId: number; areaId: number | null }) => {
      const { error } = await supabase
        .from('videos')
        .update({ area_id: areaId } as never)
        .eq('id', videoId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

// ============================================================================
// TAXONOMY VIDEO PREVIEW HOOKS (lightweight for taxonomy page)
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
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, author, url, thumbnail')
        .eq('area_id', areaId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as TaxonomyVideoPreview[]
    },
    enabled: !!areaId,
  })
}

export function useVideosByTopic(topicId: number | null, limit: number = 20) {
  return useQuery({
    queryKey: ['taxonomy-videos-topic', topicId, limit],
    queryFn: async () => {
      if (!topicId) return []
      // Get video IDs from video_topics junction
      const { data: videoTopics, error: jtError } = await supabase
        .from('video_topics')
        .select('video_id')
        .eq('topic_id', topicId)
        .limit(limit)

      if (jtError) throw jtError
      if (!videoTopics || videoTopics.length === 0) return []

      const videoIds = videoTopics.map((vt: { video_id: number }) => vt.video_id)

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, author, url, thumbnail')
        .in('id', videoIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TaxonomyVideoPreview[]
    },
    enabled: !!topicId,
  })
}

export function useVideosByTag(tagId: number | null, limit: number = 20) {
  return useQuery({
    queryKey: ['taxonomy-videos-tag', tagId, limit],
    queryFn: async () => {
      if (!tagId) return []
      // Get video IDs from video_tags junction
      const { data: videoTags, error: jtError } = await supabase
        .from('video_tags')
        .select('video_id')
        .eq('tag_id', tagId)
        .limit(limit)

      if (jtError) throw jtError
      if (!videoTags || videoTags.length === 0) return []

      const videoIds = videoTags.map((vt: { video_id: number }) => vt.video_id)

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, author, url, thumbnail')
        .in('id', videoIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TaxonomyVideoPreview[]
    },
    enabled: !!tagId,
  })
}
