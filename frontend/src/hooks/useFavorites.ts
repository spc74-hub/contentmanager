import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FavoriteAuthor, FavoriteAuthorInsert } from '@/types'

// ============================================================================
// FAVORITE AUTHORS HOOKS
// ============================================================================

export function useFavoriteAuthors() {
  return useQuery({
    queryKey: ['favorite-authors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorite_authors')
        .select('*')
        .order('author_name', { ascending: true })
      if (error) throw error
      return data as FavoriteAuthor[]
    },
  })
}

export function useIsFavoriteAuthor(authorName: string) {
  const { data: favorites } = useFavoriteAuthors()
  return favorites?.some(f => f.author_name === authorName) ?? false
}

export function useAddFavoriteAuthor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FavoriteAuthorInsert) => {
      const { data: result, error } = await supabase
        .from('favorite_authors')
        .insert(data as never)
        .select()
        .single()
      if (error) throw error
      return result as FavoriteAuthor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-authors'] })
    },
  })
}

export function useRemoveFavoriteAuthor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (authorName: string) => {
      const { error } = await supabase
        .from('favorite_authors')
        .delete()
        .eq('author_name', authorName)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-authors'] })
    },
  })
}

export function useUpdateFavoriteAuthorNotes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ authorName, notes }: { authorName: string; notes: string }) => {
      const { error } = await supabase
        .from('favorite_authors')
        .update({ notes } as never)
        .eq('author_name', authorName)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-authors'] })
    },
  })
}

// Toggle favorite author (add or remove)
export function useToggleFavoriteAuthor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ authorName, isFavorite }: { authorName: string; isFavorite: boolean }) => {
      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorite_authors')
          .delete()
          .eq('author_name', authorName)
        if (error) throw error
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorite_authors')
          .insert({ author_name: authorName } as never)
        if (error) throw error
      }
    },
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
      const { error } = await supabase
        .from('videos')
        .update({ is_favorite: !isFavorite } as never)
        .eq('id', videoId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}
