import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { FavoriteAuthor, FavoriteAuthorInsert } from '@/types'

// ============================================================================
// FAVORITE AUTHORS HOOKS
// ============================================================================

export function useFavoriteAuthors() {
  return useQuery({
    queryKey: ['favorite-authors'],
    // TODO: add dedicated endpoint; for now return empty
    queryFn: async () => [] as FavoriteAuthor[],
  })
}

export function useIsFavoriteAuthor(_authorName: string) {
  const { data: favorites } = useFavoriteAuthors()
  return favorites?.some(f => f.author_name === _authorName) ?? false
}

export function useAddFavoriteAuthor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (_data: FavoriteAuthorInsert) => ({} as FavoriteAuthor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorite-authors'] }),
  })
}

export function useRemoveFavoriteAuthor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (_authorName: string) => {},
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorite-authors'] }),
  })
}

export function useUpdateFavoriteAuthorNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (_: { authorName: string; notes: string }) => {},
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorite-authors'] }),
  })
}

export function useToggleFavoriteAuthor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (_: { authorName: string; isFavorite: boolean }) => {},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-authors'] })
      queryClient.invalidateQueries({ queryKey: ['authors-with-stats'] })
    },
  })
}

// ============================================================================
// FAVORITE VIDEOS HOOKS
// ============================================================================

export function useToggleFavoriteVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ videoId, isFavorite }: { videoId: number; isFavorite: boolean }) => {
      await apiFetch(`/api/videos/${videoId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_favorite: !isFavorite }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  })
}
