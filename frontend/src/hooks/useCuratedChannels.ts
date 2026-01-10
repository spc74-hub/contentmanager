import { useQuery } from '@tanstack/react-query'

interface CuratedChannel {
  id: number
  name: string
  theme_name: string | null
  total_videos_imported: number
}

interface ChannelsResponse {
  channels: CuratedChannel[]
  total: number
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useCuratedChannels(onlyWithVideos = true) {
  return useQuery({
    queryKey: ['curated-channels', onlyWithVideos],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/channels?limit=500`)
      const data: ChannelsResponse = await response.json()

      // Optionally filter to only channels that have imported videos
      if (onlyWithVideos) {
        return data.channels.filter(ch => ch.total_videos_imported > 0)
      }
      return data.channels
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
