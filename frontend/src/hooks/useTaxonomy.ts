import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============================================================================
// TYPES
// ============================================================================

export interface TagGroup {
  id: number
  name: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number
  tag_count: number
  video_count: number
  created_at: string
}

export interface TaxonomyVideoPreviewWithTags {
  id: number
  title: string
  author: string
  url: string
  thumbnail: string | null
  is_archived: boolean
  is_validated: boolean
  validated_at: string | null
  area_id: number | null
  upload_date: string | null
  like_count: number
  view_count: number
  duration: number | null
  source: string
  created_at: string
  tags: { id: number; name: string }[]
}

export interface TaxonomyStats {
  videos: {
    total: number
    archived: number
    validated: number
    pending: number
    no_area: number
  }
  taxonomy: {
    areas: number
    topics: number
  }
}

// ============================================================================
// TAG GROUPS HOOKS
// ============================================================================

export function useTagGroups() {
  return useQuery({
    queryKey: ['tag-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag_groups')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as TagGroup[]
    },
  })
}

export function useTagsByGroup(groupId: number | null, limit: number = 100) {
  return useQuery({
    queryKey: ['tags-by-group', groupId, limit],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, video_count')
        .eq('group_id', groupId)
        .order('video_count', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as { id: number; name: string; video_count: number }[]
    },
    enabled: !!groupId,
  })
}

// Search tags with their group info
export interface TagWithGroup {
  id: number
  name: string
  video_count: number
  group_id: number | null
  tag_group: { id: number; name: string; icon: string | null } | null
}

export function useSearchTags(searchTerm: string, limit: number = 30) {
  return useQuery({
    queryKey: ['search-tags', searchTerm, limit],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return []

      const { data, error } = await supabase
        .from('tags')
        .select('id, name, video_count, group_id, tag_group:tag_groups(id, name, icon)')
        .ilike('name', `%${searchTerm}%`)
        .order('video_count', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as TagWithGroup[]
    },
    enabled: searchTerm.length >= 2,
  })
}

// ============================================================================
// TAXONOMY VIDEOS WITH INFINITE SCROLL
// ============================================================================

export type VideoSortField = 'created_at' | 'upload_date' | 'like_count' | 'view_count' | 'title'
export type VideoSortOrder = 'asc' | 'desc'
export type SourceFilterMode = 'include' | 'exclude'
export interface SourceFilter {
  mode: SourceFilterMode
  sources: string[] // empty = all sources
}

interface VideoFilters {
  areaId?: number | null
  topicId?: number | null
  tagId?: number | null
  tagGroupId?: number | null
  status?: 'all' | 'pending' | 'validated' | 'archived'
  search?: string
  sortBy?: VideoSortField
  sortOrder?: VideoSortOrder
  sourceFilter?: SourceFilter
}

const PAGE_SIZE = 50

export function useTaxonomyVideosInfinite(filters: VideoFilters) {
  return useInfiniteQuery({
    queryKey: ['taxonomy-videos-infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('videos')
        .select(`
          id, title, author, url, thumbnail,
          is_archived, is_validated, validated_at, area_id,
          upload_date, like_count, view_count, duration, source, created_at,
          video_tags(tag_id, tags(id, name))
        `, { count: 'exact' })

      // Status filters
      if (filters.status === 'archived') {
        query = query.eq('is_archived', true)
      } else if (filters.status === 'validated') {
        query = query.eq('is_validated', true).eq('is_archived', false)
      } else if (filters.status === 'pending') {
        query = query.eq('is_validated', false).eq('is_archived', false)
      } else {
        // 'all' - exclude archived by default
        query = query.eq('is_archived', false)
      }

      // Area filter
      if (filters.areaId) {
        query = query.eq('area_id', filters.areaId)
      }

      // Search filter
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`)
      }

      // Source filter
      if (filters.sourceFilter && filters.sourceFilter.sources.length > 0) {
        if (filters.sourceFilter.mode === 'include') {
          query = query.in('source', filters.sourceFilter.sources)
        } else {
          // exclude mode - use not.in
          for (const source of filters.sourceFilter.sources) {
            query = query.neq('source', source)
          }
        }
      }

      // Sorting
      const sortBy = filters.sortBy || 'created_at'
      const sortOrder = filters.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })

      // Pagination
      query = query.range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query

      if (error) throw error

      // Transform data to flatten tags
      const videos = (data || []).map((video: Record<string, unknown>) => ({
        ...video,
        tags: ((video.video_tags as Array<{ tags: { id: number; name: string } | null }>) || [])
          .filter((vt) => vt.tags)
          .map((vt) => vt.tags)
          .slice(0, 5), // Limit to 5 tags per video
      })) as TaxonomyVideoPreviewWithTags[]

      return {
        videos,
        nextPage: videos.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 30000, // 30 seconds - prevent unnecessary refetches
  })
}

// Filter by topic (requires joining video_topics)
export function useTaxonomyVideosByTopic(
  topicId: number | null,
  status?: 'all' | 'pending' | 'validated' | 'archived',
  sortBy?: VideoSortField,
  sortOrder?: VideoSortOrder,
  sourceFilter?: SourceFilter
) {
  return useInfiniteQuery({
    queryKey: ['taxonomy-videos-topic-infinite', topicId, status, sortBy, sortOrder, sourceFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!topicId) return { videos: [], nextPage: undefined, totalCount: 0 }

      // First get video IDs from video_topics
      const { data: videoTopics, error: vtError } = await supabase
        .from('video_topics')
        .select('video_id')
        .eq('topic_id', topicId)

      if (vtError) throw vtError
      if (!videoTopics || videoTopics.length === 0) {
        return { videos: [], nextPage: undefined, totalCount: 0 }
      }

      const videoIds = (videoTopics as { video_id: number }[]).map((vt) => vt.video_id)

      let query = supabase
        .from('videos')
        .select(`
          id, title, author, url, thumbnail,
          is_archived, is_validated, validated_at, area_id,
          upload_date, like_count, view_count, duration, source, created_at,
          video_tags(tag_id, tags(id, name))
        `, { count: 'exact' })
        .in('id', videoIds)

      // Status filters
      if (status === 'archived') {
        query = query.eq('is_archived', true)
      } else if (status === 'validated') {
        query = query.eq('is_validated', true).eq('is_archived', false)
      } else if (status === 'pending') {
        query = query.eq('is_validated', false).eq('is_archived', false)
      } else {
        query = query.eq('is_archived', false)
      }

      // Source filter
      if (sourceFilter && sourceFilter.sources.length > 0) {
        if (sourceFilter.mode === 'include') {
          query = query.in('source', sourceFilter.sources)
        } else {
          for (const source of sourceFilter.sources) {
            query = query.neq('source', source)
          }
        }
      }

      // Sorting
      const sort = sortBy || 'created_at'
      const order = sortOrder || 'desc'
      query = query
        .order(sort, { ascending: order === 'asc', nullsFirst: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      const videos = (data || []).map((video: Record<string, unknown>) => ({
        ...video,
        tags: ((video.video_tags as Array<{ tags: { id: number; name: string } | null }>) || [])
          .filter((vt) => vt.tags)
          .map((vt) => vt.tags)
          .slice(0, 5),
      })) as TaxonomyVideoPreviewWithTags[]

      return {
        videos,
        nextPage: videos.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!topicId,
    staleTime: 30000,
  })
}

// Filter by tag group
export function useTaxonomyVideosByTagGroup(
  tagGroupId: number | null,
  status?: 'all' | 'pending' | 'validated' | 'archived',
  sortBy?: VideoSortField,
  sortOrder?: VideoSortOrder,
  sourceFilter?: SourceFilter
) {
  return useInfiniteQuery({
    queryKey: ['taxonomy-videos-taggroup-infinite', tagGroupId, status, sortBy, sortOrder, sourceFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!tagGroupId) return { videos: [], nextPage: undefined, totalCount: 0 }

      // Get tags in this group
      const { data: tagsInGroup, error: tError } = await supabase
        .from('tags')
        .select('id')
        .eq('group_id', tagGroupId)

      if (tError) throw tError
      if (!tagsInGroup || tagsInGroup.length === 0) {
        return { videos: [], nextPage: undefined, totalCount: 0 }
      }

      const tagIds = (tagsInGroup as { id: number }[]).map((t) => t.id)

      // Get video IDs from video_tags
      const { data: videoTags, error: vtError } = await supabase
        .from('video_tags')
        .select('video_id')
        .in('tag_id', tagIds)

      if (vtError) throw vtError
      if (!videoTags || videoTags.length === 0) {
        return { videos: [], nextPage: undefined, totalCount: 0 }
      }

      const videoIds = [...new Set((videoTags as { video_id: number }[]).map((vt) => vt.video_id))]

      let query = supabase
        .from('videos')
        .select(`
          id, title, author, url, thumbnail,
          is_archived, is_validated, validated_at, area_id,
          upload_date, like_count, view_count, duration, source, created_at,
          video_tags(tag_id, tags(id, name))
        `, { count: 'exact' })
        .in('id', videoIds)

      // Status filters
      if (status === 'archived') {
        query = query.eq('is_archived', true)
      } else if (status === 'validated') {
        query = query.eq('is_validated', true).eq('is_archived', false)
      } else if (status === 'pending') {
        query = query.eq('is_validated', false).eq('is_archived', false)
      } else {
        query = query.eq('is_archived', false)
      }

      // Source filter
      if (sourceFilter && sourceFilter.sources.length > 0) {
        if (sourceFilter.mode === 'include') {
          query = query.in('source', sourceFilter.sources)
        } else {
          for (const source of sourceFilter.sources) {
            query = query.neq('source', source)
          }
        }
      }

      // Sorting
      const sort = sortBy || 'created_at'
      const order = sortOrder || 'desc'
      query = query
        .order(sort, { ascending: order === 'asc', nullsFirst: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      const videos = (data || []).map((video: Record<string, unknown>) => ({
        ...video,
        tags: ((video.video_tags as Array<{ tags: { id: number; name: string } | null }>) || [])
          .filter((vt) => vt.tags)
          .map((vt) => vt.tags)
          .slice(0, 5),
      })) as TaxonomyVideoPreviewWithTags[]

      return {
        videos,
        nextPage: videos.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!tagGroupId,
    staleTime: 30000,
  })
}

// Filter by single tag
export function useTaxonomyVideosByTag(
  tagId: number | null,
  status?: 'all' | 'pending' | 'validated' | 'archived',
  sortBy?: VideoSortField,
  sortOrder?: VideoSortOrder,
  sourceFilter?: SourceFilter
) {
  return useInfiniteQuery({
    queryKey: ['taxonomy-videos-tag-infinite', tagId, status, sortBy, sortOrder, sourceFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!tagId) return { videos: [], nextPage: undefined, totalCount: 0 }

      // Get video IDs from video_tags
      const { data: videoTags, error: vtError } = await supabase
        .from('video_tags')
        .select('video_id')
        .eq('tag_id', tagId)

      if (vtError) throw vtError
      if (!videoTags || videoTags.length === 0) {
        return { videos: [], nextPage: undefined, totalCount: 0 }
      }

      const videoIds = (videoTags as { video_id: number }[]).map((vt) => vt.video_id)

      let query = supabase
        .from('videos')
        .select(`
          id, title, author, url, thumbnail,
          is_archived, is_validated, validated_at, area_id,
          upload_date, like_count, view_count, duration, source, created_at,
          video_tags(tag_id, tags(id, name))
        `, { count: 'exact' })
        .in('id', videoIds)

      // Status filters
      if (status === 'archived') {
        query = query.eq('is_archived', true)
      } else if (status === 'validated') {
        query = query.eq('is_validated', true).eq('is_archived', false)
      } else if (status === 'pending') {
        query = query.eq('is_validated', false).eq('is_archived', false)
      } else {
        query = query.eq('is_archived', false)
      }

      // Source filter
      if (sourceFilter && sourceFilter.sources.length > 0) {
        if (sourceFilter.mode === 'include') {
          query = query.in('source', sourceFilter.sources)
        } else {
          for (const source of sourceFilter.sources) {
            query = query.neq('source', source)
          }
        }
      }

      // Sorting
      const sort = sortBy || 'created_at'
      const order = sortOrder || 'desc'
      query = query
        .order(sort, { ascending: order === 'asc', nullsFirst: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      const videos = (data || []).map((video: Record<string, unknown>) => ({
        ...video,
        tags: ((video.video_tags as Array<{ tags: { id: number; name: string } | null }>) || [])
          .filter((vt) => vt.tags)
          .map((vt) => vt.tags)
          .slice(0, 5),
      })) as TaxonomyVideoPreviewWithTags[]

      return {
        videos,
        nextPage: videos.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!tagId,
    staleTime: 30000,
  })
}

// Filter by multiple tags (OR - videos that have ANY of these tags)
export function useTaxonomyVideosByMultipleTags(
  tagIds: number[],
  status?: 'all' | 'pending' | 'validated' | 'archived',
  sortBy?: VideoSortField,
  sortOrder?: VideoSortOrder,
  sourceFilter?: SourceFilter
) {
  return useInfiniteQuery({
    queryKey: ['taxonomy-videos-multitags-infinite', tagIds, status, sortBy, sortOrder, sourceFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!tagIds || tagIds.length === 0) return { videos: [], nextPage: undefined, totalCount: 0 }

      // Get video IDs from video_tags for any of these tags
      const { data: videoTags, error: vtError } = await supabase
        .from('video_tags')
        .select('video_id')
        .in('tag_id', tagIds)

      if (vtError) throw vtError
      if (!videoTags || videoTags.length === 0) {
        return { videos: [], nextPage: undefined, totalCount: 0 }
      }

      // Get unique video IDs
      const videoIds = [...new Set((videoTags as { video_id: number }[]).map((vt) => vt.video_id))]

      let query = supabase
        .from('videos')
        .select(`
          id, title, author, url, thumbnail,
          is_archived, is_validated, validated_at, area_id,
          upload_date, like_count, view_count, duration, source, created_at,
          video_tags(tag_id, tags(id, name))
        `, { count: 'exact' })
        .in('id', videoIds)

      // Status filters
      if (status === 'archived') {
        query = query.eq('is_archived', true)
      } else if (status === 'validated') {
        query = query.eq('is_validated', true).eq('is_archived', false)
      } else if (status === 'pending') {
        query = query.eq('is_validated', false).eq('is_archived', false)
      } else {
        query = query.eq('is_archived', false)
      }

      // Source filter
      if (sourceFilter && sourceFilter.sources.length > 0) {
        if (sourceFilter.mode === 'include') {
          query = query.in('source', sourceFilter.sources)
        } else {
          for (const source of sourceFilter.sources) {
            query = query.neq('source', source)
          }
        }
      }

      // Sorting
      const sort = sortBy || 'created_at'
      const order = sortOrder || 'desc'
      query = query
        .order(sort, { ascending: order === 'asc', nullsFirst: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      const videos = (data || []).map((video: Record<string, unknown>) => ({
        ...video,
        tags: ((video.video_tags as Array<{ tags: { id: number; name: string } | null }>) || [])
          .filter((vt) => vt.tags)
          .map((vt) => vt.tags)
          .slice(0, 5),
      })) as TaxonomyVideoPreviewWithTags[]

      return {
        videos,
        nextPage: videos.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: tagIds.length > 0,
    staleTime: 30000,
  })
}

// ============================================================================
// BULK MUTATIONS (via Backend API)
// ============================================================================

export function useBulkArchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoIds: number[]) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/bulk/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds }),
      })
      if (!response.ok) throw new Error('Failed to archive videos')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

export function useBulkUnarchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoIds: number[]) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/bulk/unarchive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds }),
      })
      if (!response.ok) throw new Error('Failed to unarchive videos')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

export function useBulkValidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoIds: number[]) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/bulk/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds }),
      })
      if (!response.ok) throw new Error('Failed to validate videos')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useBulkAssignArea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoIds, areaId }: { videoIds: number[]; areaId: number | null }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/bulk/assign-area`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds, area_id: areaId }),
      })
      if (!response.ok) throw new Error('Failed to assign area')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

export function useBulkAssignTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoIds, topicId, remove = false }: { videoIds: number[]; topicId: number; remove?: boolean }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/bulk/assign-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds, topic_id: topicId, remove }),
      })
      if (!response.ok) throw new Error('Failed to assign topic')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

// ============================================================================
// AREA MUTATIONS
// ============================================================================

export function useCreateArea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (area: { name: string; name_es?: string; icon?: string; color?: string; sort_order?: number }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(area),
      })
      if (!response.ok) throw new Error('Failed to create area')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

export function useUpdateArea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...area }: { id: number; name?: string; name_es?: string; icon?: string; color?: string; sort_order?: number }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/areas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(area),
      })
      if (!response.ok) throw new Error('Failed to update area')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

export function useDeleteArea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, reassignTo }: { id: number; reassignTo?: number }) => {
      const url = reassignTo
        ? `${API_URL}/api/taxonomy/areas/${id}?reassign_to=${reassignTo}`
        : `${API_URL}/api/taxonomy/areas/${id}`
      const response = await fetch(url, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete area')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

// ============================================================================
// TOPIC MUTATIONS
// ============================================================================

export function useCreateTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (topic: { area_id: number; name: string; name_es?: string; description?: string }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic),
      })
      if (!response.ok) throw new Error('Failed to create topic')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })
}

export function useUpdateTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...topic }: { id: number; area_id?: number; name?: string; name_es?: string; description?: string }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic),
      })
      if (!response.ok) throw new Error('Failed to update topic')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_URL}/api/taxonomy/topics/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete topic')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

// ============================================================================
// STATISTICS
// ============================================================================

export function useTaxonomyStats() {
  return useQuery({
    queryKey: ['taxonomy-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/taxonomy/stats`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json() as Promise<TaxonomyStats>
    },
  })
}

// ============================================================================
// SINGLE VIDEO ACTIONS
// ============================================================================

export function useArchiveVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: number) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/${videoId}/archive`, {
        method: 'PUT',
      })
      if (!response.ok) throw new Error('Failed to archive video')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useValidateVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: number) => {
      const response = await fetch(`${API_URL}/api/taxonomy/videos/${videoId}/validate`, {
        method: 'PUT',
      })
      if (!response.ok) throw new Error('Failed to validate video')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useTaxonomyUpdateVideoArea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, areaId }: { videoId: number; areaId: number | null }) => {
      const url = areaId
        ? `${API_URL}/api/taxonomy/videos/${videoId}/area?area_id=${areaId}`
        : `${API_URL}/api/taxonomy/videos/${videoId}/area`
      const response = await fetch(url, { method: 'PUT' })
      if (!response.ok) throw new Error('Failed to update video area')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-videos'] })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })
}

// ============================================================================
// MERGE TAGS
// ============================================================================

export function useMergeTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sourceTagIds, targetTagId }: { sourceTagIds: number[]; targetTagId: number }) => {
      const response = await fetch(`${API_URL}/api/taxonomy/tags/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_tag_ids: sourceTagIds, target_tag_id: targetTagId }),
      })
      if (!response.ok) throw new Error('Failed to merge tags')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['tag-groups'] })
    },
  })
}


// ============================================================================
// FILTERED COUNTS
// ============================================================================

export interface FilteredCounts {
  total_videos: number
  area_counts: Record<string, number>  // area_id -> count (null key for no area)
  tag_group_counts: Record<string, number>  // tag_group_id -> count
  tag_counts: Record<string, number>  // tag_id -> count
}

export interface CountsFilterParams {
  status?: 'all' | 'pending' | 'validated' | 'archived'
  sources?: string[]
  exclude_sources?: string[]
  search?: string
  area_id?: number
}

export function useFilteredCounts(filters: CountsFilterParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['filtered-counts', filters],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/taxonomy/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })
      if (!response.ok) throw new Error('Failed to fetch filtered counts')
      return response.json() as Promise<FilteredCounts>
    },
    enabled,
    staleTime: 30000, // 30 seconds cache
  })
}


// ============================================================================
// ANALYZE SELECTION
// ============================================================================

export interface AnalysisResult {
  analysis: string
  mode: 'light' | 'extended'
  video_count: number
  videos_with_summary: number | null
  processing_time_seconds: number
}

export function useAnalyzeSelection() {
  return useMutation({
    mutationFn: async ({ videoIds, mode }: { videoIds: number[]; mode: 'light' | 'extended' }) => {
      const response = await fetch(`${API_URL}/api/ai-process/analyze-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds, mode }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to analyze selection')
      }
      return response.json() as Promise<AnalysisResult>
    },
  })
}
