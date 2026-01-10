import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Video, VideoInsert, VideoFilters, Area } from '@/types'

const PAGE_SIZE = 50

export type VideoWithCategory = Video & { categories: { name: string; icon: string; color: string } }
export type VideoWithArea = Video & {
  categories: { name: string; icon: string; color: string }
  areas: Area | null
}

export function useVideos(filters?: VideoFilters) {
  return useInfiniteQuery({
    queryKey: ['videos', filters],
    queryFn: async ({ pageParam = 0 }) => {
      // If filtering by tag, we need to get video IDs first from the junction table
      let videoIdsFromTag: number[] | null = null
      if (filters?.tagId) {
        const { data: taggedVideos } = await supabase
          .from('video_tags')
          .select('video_id')
          .eq('tag_id', filters.tagId)

        if (taggedVideos) {
          videoIdsFromTag = taggedVideos.map((v: { video_id: number }) => v.video_id)
        }
      }

      // If filtering by subcategory, get video IDs from that junction table
      let videoIdsFromSubcat: number[] | null = null
      if (filters?.subcategoryId) {
        const { data: subcatVideos } = await supabase
          .from('video_subcategories')
          .select('video_id')
          .eq('subcategory_id', filters.subcategoryId)

        if (subcatVideos) {
          videoIdsFromSubcat = subcatVideos.map((v: { video_id: number }) => v.video_id)
        }
      }

      // If filtering by topic, get video IDs from video_topics junction table
      let videoIdsFromTopic: number[] | null = null
      if (filters?.topicId) {
        const { data: topicVideos } = await supabase
          .from('video_topics')
          .select('video_id')
          .eq('topic_id', filters.topicId)

        if (topicVideos) {
          videoIdsFromTopic = topicVideos.map((v: { video_id: number }) => v.video_id)
        }
      }

      let query = supabase
        .from('videos')
        .select('*, categories(*), areas(*)', { count: 'exact' })

      // Apply sorting based on sortBy filter
      const sortOrder = filters?.sortOrder === 'asc'
      switch (filters?.sortBy) {
        case 'published':
          query = query.order('upload_date', { ascending: sortOrder, nullsFirst: false })
          break
        case 'views':
          query = query.order('view_count', { ascending: sortOrder })
          break
        case 'duration':
          query = query.order('duration', { ascending: sortOrder })
          break
        case 'title':
          query = query.order('title', { ascending: true })
          break
        case 'recent':
        default:
          query = query.order('created_at', { ascending: sortOrder })
          break
      }

      query = query.range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters?.author) {
        query = query.eq('author', filters.author)
      }
      if (filters?.source) {
        query = query.eq('source', filters.source)
      }
      if (filters?.searchTerm) {
        query = query.or(`title.ilike.%${filters.searchTerm}%,summary.ilike.%${filters.searchTerm}%,author.ilike.%${filters.searchTerm}%`)
      }

      // AI processing status filter
      if (filters?.aiStatus === 'processed') {
        query = query.eq('has_transcript', true)
      } else if (filters?.aiStatus === 'pending') {
        query = query.eq('has_transcript', false)
      }

      // Apply tag filter
      if (videoIdsFromTag !== null) {
        if (videoIdsFromTag.length === 0) {
          return { data: [], count: 0, nextPage: undefined }
        }
        query = query.in('id', videoIdsFromTag)
      }

      // Apply subcategory filter
      if (videoIdsFromSubcat !== null) {
        if (videoIdsFromSubcat.length === 0) {
          return { data: [], count: 0, nextPage: undefined }
        }
        query = query.in('id', videoIdsFromSubcat)
      }

      // Apply topic filter
      if (videoIdsFromTopic !== null) {
        if (videoIdsFromTopic.length === 0) {
          return { data: [], count: 0, nextPage: undefined }
        }
        query = query.in('id', videoIdsFromTopic)
      }

      // Apply area filter
      if (filters?.areaId) {
        query = query.eq('area_id', filters.areaId)
      }

      // Apply favorite filter
      if (filters?.isFavorite === true) {
        query = query.eq('is_favorite', true)
      }

      // Apply curated channel filter
      if (filters?.curatedChannelId) {
        query = query.eq('curated_channel_id', filters.curatedChannelId)
      }

      // Apply channel theme filter - get all channels with that theme and filter by their IDs
      if (filters?.channelTheme && !filters?.curatedChannelId) {
        const { data: channelsWithTheme } = await supabase
          .from('curated_channels')
          .select('id, channel_themes!inner(name)')
          .eq('channel_themes.name', filters.channelTheme)

        if (channelsWithTheme && channelsWithTheme.length > 0) {
          const channelIds = channelsWithTheme.map((ch: { id: number }) => ch.id)
          query = query.in('curated_channel_id', channelIds)
        } else {
          return { data: [], count: 0, nextPage: undefined }
        }
      }

      const { data, error, count } = await query
      if (error) throw error

      const videos = data as VideoWithArea[]
      const totalCount = count || 0
      const hasMore = (pageParam + 1) * PAGE_SIZE < totalCount

      return {
        data: videos,
        count: totalCount,
        nextPage: hasMore ? pageParam + 1 : undefined
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  })
}

export function useVideo(id: number) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos')
        .select('*, categories(*), areas(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as VideoWithArea
    },
    enabled: !!id,
  })
}

export function useCreateVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (video: VideoInsert) => {
      const { data, error } = await supabase
        .from('videos')
        .insert(video as never)
        .select()
        .single()
      if (error) throw error
      return data as Video
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useUpdateVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Video> & { id: number }) => {
      const { data, error } = await supabase
        .from('videos')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Video
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useDeleteVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useAuthors() {
  return useQuery({
    queryKey: ['authors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos')
        .select('author')
      if (error) throw error
      const authors = [...new Set(data.map((v: { author: string }) => v.author))].sort()
      return authors as string[]
    },
  })
}
