import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
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
      const params = new URLSearchParams()
      if (filters?.categoryId) params.append('category_id', String(filters.categoryId))
      if (filters?.author) params.append('author', filters.author)
      const qs = params.toString()
      const data = await apiFetch<VideoWithArea[]>(`/api/videos${qs ? '?' + qs : ''}`)

      // Client-side pagination
      const start = pageParam * PAGE_SIZE
      const paged = data.slice(start, start + PAGE_SIZE)
      const hasMore = start + PAGE_SIZE < data.length

      return {
        data: paged,
        count: data.length,
        nextPage: hasMore ? pageParam + 1 : undefined,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  })
}

export function useVideo(id: number) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: () => apiFetch<VideoWithArea>(`/api/videos/${id}`),
    enabled: !!id,
  })
}

export function useCreateVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (video: VideoInsert) =>
      apiFetch<Video>('/api/videos', { method: 'POST', body: JSON.stringify(video) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  })
}

export function useUpdateVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Video> & { id: number }) =>
      apiFetch<Video>(`/api/videos/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  })
}

export function useDeleteVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/api/videos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  })
}

export function useAuthors() {
  return useQuery({
    queryKey: ['authors'],
    queryFn: () => apiFetch<string[]>('/api/videos/authors/list'),
  })
}
