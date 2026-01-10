import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types
export interface SubscribedChannel {
  id: number
  channel_id: string
  channel_name: string
  channel_url: string
  thumbnail: string | null
  is_active: boolean
  first_import_at: string | null
  last_video_date: string | null
  last_import_at: string | null
  total_videos_imported: number
  created_at: string
  updated_at: string
}

export interface SubscribedChannelsListResponse {
  channels: SubscribedChannel[]
  total: number
  active: number
}

export interface ImportCSVResponse {
  channels_imported: number
  channels_updated: number
  channels_skipped: number
  total_in_csv: number
}

export interface VideoMetadata {
  id: string
  title: string
  author: string
  channel_id: string
  description: string
  duration_seconds: number
  duration_formatted: string
  view_count: number
  like_count: number
  comment_count: number | null
  upload_date: string
  thumbnail: string
  url: string
  tags: string[]
  categories: string[]
  transcript: string | null
  has_transcript: boolean
}

export interface ImportVideosResponse {
  videos: VideoMetadata[]
  total_videos: number
  new_videos: number
  channels_processed: number
  channels_failed: string[]
  processing_time_seconds: number
}

export type ImportMode = 'incremental' | 'historical' | 'fixed'

// Fetch all subscribed channels
export function useSubscribedChannels() {
  return useQuery({
    queryKey: ['subscribed-channels'],
    queryFn: async (): Promise<SubscribedChannelsListResponse> => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels`)
      if (!response.ok) {
        throw new Error('Failed to fetch subscribed channels')
      }
      return response.json()
    },
  })
}

// Import channels from CSV
export function useImportChannelsFromCSV() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (csvContent: string): Promise<ImportCSVResponse> => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvContent }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to import CSV')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribed-channels'] })
    },
  })
}

// Toggle channel active status
export function useToggleChannelActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ channelId, isActive }: { channelId: string; isActive: boolean }) => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, is_active: isActive }),
      })
      if (!response.ok) {
        throw new Error('Failed to toggle channel')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribed-channels'] })
    },
  })
}

// Delete a subscribed channel
export function useDeleteSubscribedChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (channelId: string) => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels/${channelId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete channel')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribed-channels'] })
    },
  })
}

// Add a channel by URL
export interface AddChannelByURLResponse {
  success: boolean
  message: string
  channel?: {
    channel_id: string
    channel_name: string
    channel_url: string
    thumbnail: string | null
  }
  already_exists?: boolean
}

export function useAddChannelByURL() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (url: string): Promise<AddChannelByURLResponse> => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels/add-by-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to add channel')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribed-channels'] })
    },
  })
}

// Job management types
export interface ActiveJob {
  id: string
  status: 'running' | 'cancelled' | 'completed'
  type: string
  progress: string
  started_at: string
}

export interface JobsResponse {
  jobs: ActiveJob[]
  total: number
  running: number
}

// Fetch active jobs
export function useActiveJobs(enabled = true) {
  return useQuery({
    queryKey: ['active-jobs'],
    queryFn: async (): Promise<JobsResponse> => {
      const response = await fetch(`${API_BASE}/api/scraper/jobs`)
      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }
      return response.json()
    },
    refetchInterval: enabled ? 2000 : false, // Poll every 2 seconds when enabled
    enabled,
  })
}

// Cancel a job
export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`${API_BASE}/api/scraper/jobs/${jobId}/cancel`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to cancel job')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-jobs'] })
    },
  })
}

// Import videos from subscribed channels
export function useImportVideosFromChannels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      channelIds,
      videosPerChannel = 5,
      mode = 'incremental',
      extractFullMetadata = false,
      extractTranscript = false,
    }: {
      channelIds?: string[]
      videosPerChannel?: number
      mode?: ImportMode
      extractFullMetadata?: boolean
      extractTranscript?: boolean
    }): Promise<ImportVideosResponse> => {
      const response = await fetch(`${API_BASE}/api/scraper/subscribed-channels/import-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_ids: channelIds,
          videos_per_channel: videosPerChannel,
          mode,
          use_cookies: true,
          browser: 'chrome',
          extract_full_metadata: extractFullMetadata,
          extract_transcript: extractTranscript,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to import videos')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribed-channels'] })
    },
  })
}
