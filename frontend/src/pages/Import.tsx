import { useState, useEffect, useRef, useMemo } from 'react'
import { Download, RefreshCw, Check, AlertCircle, Clock, Eye, ThumbsUp, User, ExternalLink, Sparkles, Tag, FileText, ChevronDown, ChevronUp, Save, Timer, Users, Youtube, Upload, ToggleLeft, ToggleRight, Database, Trash2, Plus, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Link, Square, LinkIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCategories, useSubscribedChannels, useImportChannelsFromCSV, useToggleChannelActive, useImportVideosFromChannels, useDeleteSubscribedChannel, useAddChannelByURL, useActiveJobs, useCancelJob, type ImportMode } from '@/hooks'

interface ChannelInfo {
  channel_id: string
  channel_name: string
  channel_url: string
  thumbnail: string | null
  video_count: number
}

interface VideoMetadata {
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
  transcript?: string | null
  has_transcript?: boolean
  ai_category?: string
  ai_subcategories?: string[]
  ai_summary?: string
  ai_key_points?: string[]
  ai_processing_time?: number
}

interface PlaylistInfo {
  id: string
  title: string
  channel: string
  video_count: number
  videos: VideoMetadata[]
}

interface CategorizedVideo {
  title: string
  category: string
  subcategories?: string[]
  summary?: string
  key_points?: string[]
  processing_time_seconds?: number
}

// Bulk URLs response types
interface BulkVideoResult {
  url: string
  success: boolean
  video: VideoMetadata | null
  error: string | null
  source: 'youtube' | 'tiktok' | 'unknown'
}

interface BulkVideosResponse {
  results: BulkVideoResult[]
  total: number
  success_count: number
  failed_count: number
  processing_time_seconds: number
}

export function Import() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'playlist' | 'subscriptions' | 'urls'>('playlist')
  const [subscriptionSubTab, setSubscriptionSubTab] = useState<'feed' | 'saved'>('saved')

  // Common state
  const [isLoading, setIsLoading] = useState(false)
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; inserted: number; errors?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playlistData, setPlaylistData] = useState<PlaylistInfo | null>(null)
  const [extractFullMetadata, setExtractFullMetadata] = useState(true)
  const [extractTranscript, setExtractTranscript] = useState(false)
  const [includeSubcategories, setIncludeSubcategories] = useState(false)
  const [includeSummary, setIncludeSummary] = useState(false)
  const [extendedSummary, setExtendedSummary] = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const [categorizeTime, setCategorizeTime] = useState<number | null>(null)
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Playlist tab state
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [useCookies, setUseCookies] = useState(false)

  // Subscriptions tab state (feed mode)
  const [subscriptionChannels, setSubscriptionChannels] = useState<ChannelInfo[]>([])
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [videosPerChannel, setVideosPerChannel] = useState(10)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [channelsElapsedTime, setChannelsElapsedTime] = useState(0)
  const channelsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Subscriptions tab state (saved channels mode)
  const [csvContent, setCsvContent] = useState('')
  const [selectedSavedChannels, setSelectedSavedChannels] = useState<Set<string>>(new Set())
  const [savedVideosPerChannel, setSavedVideosPerChannel] = useState(5)
  const [importMode, setImportMode] = useState<ImportMode>('fixed')
  const [showImportResult, setShowImportResult] = useState(false)

  // URLs tab state
  const [urlsInput, setUrlsInput] = useState('')
  const [urlsExtractTranscript, setUrlsExtractTranscript] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkVideosResponse | null>(null)
  const [urlsLoadTime, setUrlsLoadTime] = useState<number | null>(null)

  const queryClient = useQueryClient()
  const { data: categories } = useCategories()

  // Saved channels hooks
  const { data: savedChannelsData, isLoading: isLoadingSavedChannels, refetch: refetchSavedChannels } = useSubscribedChannels()
  const importCSV = useImportChannelsFromCSV()
  const toggleChannelActive = useToggleChannelActive()
  const importVideosFromChannels = useImportVideosFromChannels()
  const deleteChannel = useDeleteSubscribedChannel()
  const addChannelByURL = useAddChannelByURL()

  // Job management hooks
  const { data: activeJobsData } = useActiveJobs(true)
  const cancelJob = useCancelJob()

  // Channel management state
  const [channelSortBy, setChannelSortBy] = useState<'name' | 'videos' | 'first_import' | 'last_import' | 'last_video'>('name')
  const [channelSortDir, setChannelSortDir] = useState<'asc' | 'desc'>('asc')
  const [channelFilter, setChannelFilter] = useState<'all' | 'with_videos' | 'no_videos' | 'new'>('all')
  const [newChannelUrl, setNewChannelUrl] = useState('')
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [batchSize, setBatchSize] = useState(20)
  const [currentBatchStart, setCurrentBatchStart] = useState(0)

  // Timer effect for loading state
  useEffect(() => {
    if (isLoading) {
      setElapsedTime(0)
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isLoading])

  // Timer effect for channels loading
  useEffect(() => {
    if (isLoadingChannels) {
      setChannelsElapsedTime(0)
      channelsTimerRef.current = setInterval(() => {
        setChannelsElapsedTime(prev => prev + 1)
      }, 1000)
    } else {
      if (channelsTimerRef.current) {
        clearInterval(channelsTimerRef.current)
        channelsTimerRef.current = null
      }
    }
    return () => {
      if (channelsTimerRef.current) {
        clearInterval(channelsTimerRef.current)
      }
    }
  }, [isLoadingChannels])

  // Filtered and sorted channels
  const filteredAndSortedChannels = useMemo(() => {
    if (!savedChannelsData?.channels) return []

    let channels = [...savedChannelsData.channels]

    // Apply filter
    switch (channelFilter) {
      case 'with_videos':
        channels = channels.filter(c => c.total_videos_imported > 0)
        break
      case 'no_videos':
        channels = channels.filter(c => c.total_videos_imported === 0)
        break
      case 'new':
        // Channels added in the last 7 days
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        channels = channels.filter(c => c.created_at && new Date(c.created_at) > weekAgo)
        break
    }

    // Apply sort
    channels.sort((a, b) => {
      let comparison = 0
      switch (channelSortBy) {
        case 'name':
          comparison = a.channel_name.localeCompare(b.channel_name)
          break
        case 'videos':
          comparison = a.total_videos_imported - b.total_videos_imported
          break
        case 'first_import':
          const aFirst = a.first_import_at || ''
          const bFirst = b.first_import_at || ''
          comparison = aFirst.localeCompare(bFirst)
          break
        case 'last_import':
          const aLast = a.last_import_at || ''
          const bLast = b.last_import_at || ''
          comparison = aLast.localeCompare(bLast)
          break
        case 'last_video':
          const aVideo = a.last_video_date || ''
          const bVideo = b.last_video_date || ''
          comparison = aVideo.localeCompare(bVideo)
          break
      }
      return channelSortDir === 'asc' ? comparison : -comparison
    })

    return channels
  }, [savedChannelsData?.channels, channelFilter, channelSortBy, channelSortDir])

  // Current batch for import
  const currentBatchChannels = useMemo(() => {
    const activeChannels = filteredAndSortedChannels.filter(c => c.is_active)
    return activeChannels.slice(currentBatchStart, currentBatchStart + batchSize)
  }, [filteredAndSortedChannels, currentBatchStart, batchSize])

  const totalBatches = useMemo(() => {
    const activeChannels = filteredAndSortedChannels.filter(c => c.is_active)
    return Math.ceil(activeChannels.length / batchSize)
  }, [filteredAndSortedChannels, batchSize])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const handleScrapePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlistUrl.trim()) return

    setIsLoading(true)
    setError(null)
    setPlaylistData(null)
    setCategorizeTime(null)
    setElapsedTime(0)
    const startTime = Date.now()

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/scraper/playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: playlistUrl,
          extract_full_metadata: extractFullMetadata,
          use_cookies: useCookies,
          browser: 'chrome',
          extract_transcript: extractTranscript,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al obtener la playlist')
      }

      const data: PlaylistInfo = await response.json()
      setPlaylistData(data)
      setLoadTime((Date.now() - startTime) / 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  // === BULK URLS HANDLER ===

  const handleScrapeBulkUrls = async (e: React.FormEvent) => {
    e.preventDefault()
    const urls = urlsInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)

    if (urls.length === 0) return

    setIsLoading(true)
    setError(null)
    setBulkResults(null)
    setUrlsLoadTime(null)
    setElapsedTime(0)
    const startTime = Date.now()

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/scraper/videos/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls,
          extract_transcript: urlsExtractTranscript,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al obtener los videos')
      }

      const data: BulkVideosResponse = await response.json()
      setBulkResults(data)
      setUrlsLoadTime((Date.now() - startTime) / 1000)

      // Convert successful results to playlistData format for reusing existing video preview/save UI
      if (data.success_count > 0) {
        const videos = data.results
          .filter(r => r.success && r.video)
          .map(r => r.video!)
        setPlaylistData({
          id: 'bulk-import',
          title: `Importación de ${urls.length} URLs`,
          channel: 'Múltiples fuentes',
          video_count: videos.length,
          videos,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  // === SUBSCRIPTION HANDLERS ===

  const handleLoadChannels = async () => {
    setIsLoadingChannels(true)
    setError(null)
    setSubscriptionChannels([])
    setSelectedChannels(new Set())

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/scraper/subscriptions/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_cookies: true, browser: 'chrome' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al cargar suscripciones')
      }

      const data = await response.json()
      setSubscriptionChannels(data.channels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoadingChannels(false)
    }
  }

  const handleLoadVideosFromChannels = async () => {
    if (selectedChannels.size === 0) return

    setIsLoading(true)
    setError(null)
    setPlaylistData(null)
    setCategorizeTime(null)
    setElapsedTime(0)
    const startTime = Date.now()

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/scraper/subscriptions/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_ids: Array.from(selectedChannels),
          videos_per_channel: videosPerChannel,
          use_cookies: true,
          browser: 'chrome',
          extract_full_metadata: extractFullMetadata,
          extract_transcript: extractTranscript,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al cargar videos')
      }

      const data = await response.json()

      // Get selected channel names for the title
      const selectedChannelNames = subscriptionChannels
        .filter(c => selectedChannels.has(c.channel_id))
        .map(c => c.channel_name)
        .slice(0, 3)
        .join(', ')
      const moreCount = selectedChannels.size - 3

      setPlaylistData({
        id: 'subscriptions',
        title: `Videos de ${selectedChannelNames}${moreCount > 0 ? ` y ${moreCount} más` : ''}`,
        channel: 'Suscripciones',
        video_count: data.total_videos,
        videos: data.videos,
      })
      setLoadTime((Date.now() - startTime) / 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelId)) {
        newSet.delete(channelId)
      } else {
        newSet.add(channelId)
      }
      return newSet
    })
  }

  const selectAllChannels = () => {
    setSelectedChannels(new Set(subscriptionChannels.map(c => c.channel_id)))
  }

  const deselectAllChannels = () => {
    setSelectedChannels(new Set())
  }

  // === SAVED CHANNELS HANDLERS ===

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return
    try {
      await importCSV.mutateAsync(csvContent)
      setShowImportResult(true)
      setCsvContent('')
      setTimeout(() => setShowImportResult(false), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar CSV')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCsvContent(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const toggleSavedChannel = (channelId: string) => {
    setSelectedSavedChannels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelId)) {
        newSet.delete(channelId)
      } else {
        newSet.add(channelId)
      }
      return newSet
    })
  }

  const selectAllSavedChannels = () => {
    if (savedChannelsData?.channels) {
      setSelectedSavedChannels(new Set(
        savedChannelsData.channels.filter(c => c.is_active).map(c => c.channel_id)
      ))
    }
  }

  const deselectAllSavedChannels = () => {
    setSelectedSavedChannels(new Set())
  }

  const handleToggleChannelActive = async (channelId: string, isActive: boolean) => {
    try {
      await toggleChannelActive.mutateAsync({ channelId, isActive })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar canal')
    }
  }

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (!confirm(`¿Eliminar el canal "${channelName}"? Los videos ya importados no se eliminarán.`)) return
    try {
      await deleteChannel.mutateAsync(channelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar canal')
    }
  }

  const handleAddChannelByURL = async () => {
    if (!newChannelUrl.trim()) return
    try {
      const result = await addChannelByURL.mutateAsync(newChannelUrl)
      if (result.success) {
        setNewChannelUrl('')
        setShowAddChannel(false)
      } else if (result.already_exists) {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al añadir canal')
    }
  }

  const toggleSort = (column: typeof channelSortBy) => {
    if (channelSortBy === column) {
      setChannelSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setChannelSortBy(column)
      setChannelSortDir('asc')
    }
  }

  const handleSelectBatch = () => {
    const batchIds = currentBatchChannels.map(c => c.channel_id)
    setSelectedSavedChannels(new Set(batchIds))
  }

  const handleNextBatch = () => {
    const activeCount = filteredAndSortedChannels.filter(c => c.is_active).length
    if (currentBatchStart + batchSize < activeCount) {
      setCurrentBatchStart(prev => prev + batchSize)
      setSelectedSavedChannels(new Set())
    }
  }

  const handlePrevBatch = () => {
    if (currentBatchStart > 0) {
      setCurrentBatchStart(prev => Math.max(0, prev - batchSize))
      setSelectedSavedChannels(new Set())
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  const getSortIcon = (column: typeof channelSortBy) => {
    if (channelSortBy !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return channelSortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600" />
      : <ArrowDown className="w-3 h-3 text-blue-600" />
  }

  // Helper function to save videos to Supabase (used by auto-save and manual save)
  const saveVideosToSupabase = async (videos: VideoMetadata[], source: 'subscription' | 'playlist'): Promise<{ inserted: number; errors: string[] }> => {
    // Build category name -> id map
    const categoryMap: Record<string, number> = {}
    if (categories) {
      for (const cat of categories) {
        categoryMap[cat.name] = cat.id
      }
    }
    const otrosId = categoryMap['Otros'] || Object.values(categoryMap)[0] || 1

    // Get existing tags
    const { data: existingTags } = await supabase.from('tags').select('id, name')
    const tagMap: Record<string, number> = {}
    if (existingTags) {
      for (const tag of existingTags as { id: number; name: string }[]) {
        tagMap[tag.name.toLowerCase()] = tag.id
      }
    }

    let inserted = 0
    const errors: string[] = []

    for (const video of videos) {
      const categoryId = video.ai_category ? (categoryMap[video.ai_category] || otrosId) : otrosId

      let uploadDateFormatted: string | null = null
      if (video.upload_date && video.upload_date.length === 8) {
        uploadDateFormatted = `${video.upload_date.slice(0, 4)}-${video.upload_date.slice(4, 6)}-${video.upload_date.slice(6, 8)}`
      }

      const videoData = {
        youtube_id: video.id,
        title: video.title,
        author: video.author,
        description: video.description || '',
        summary: video.ai_summary || '',
        key_points: video.ai_key_points || [],
        duration: video.duration_seconds,
        view_count: video.view_count,
        like_count: video.like_count,
        url: video.url,
        thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
        upload_date: uploadDateFormatted,
        category_id: categoryId,
        source: source,
        transcript: video.transcript || null,
        has_transcript: !!video.transcript,
      }

      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert(videoData as never)
        .select('id')
        .single()

      if (insertError) {
        // Skip duplicates silently
        if (!insertError.message.includes('duplicate')) {
          errors.push(`${video.title}: ${insertError.message}`)
        }
        continue
      }

      inserted++
      const videoId = (insertedVideo as { id: number }).id

      // Save tags
      if (video.tags && video.tags.length > 0) {
        const tagsToSave = video.tags.slice(0, 15)
        const tagIdsToLink: number[] = []

        const newTagsToCreate = tagsToSave
          .map(t => t.toLowerCase().trim())
          .filter(t => t && t.length <= 100 && !tagMap[t])

        if (newTagsToCreate.length > 0) {
          const { data: upsertedTags } = await supabase
            .from('tags')
            .upsert(
              newTagsToCreate.map(name => ({ name })) as never[],
              { onConflict: 'name', ignoreDuplicates: false }
            )
            .select('id, name')

          if (upsertedTags) {
            for (const tag of upsertedTags as { id: number; name: string }[]) {
              tagMap[tag.name.toLowerCase()] = tag.id
            }
          }
        }

        for (const tagName of tagsToSave) {
          const normalizedTag = tagName.toLowerCase().trim()
          const tagId = tagMap[normalizedTag]
          if (tagId) tagIdsToLink.push(tagId)
        }

        if (tagIdsToLink.length > 0) {
          await supabase
            .from('video_tags')
            .upsert(
              tagIdsToLink.map(tag_id => ({ video_id: videoId, tag_id })) as never[],
              { onConflict: 'video_id,tag_id', ignoreDuplicates: true }
            )
        }
      }
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['videos'] })
    queryClient.invalidateQueries({ queryKey: ['tags'] })

    return { inserted, errors }
  }

  const handleImportVideosFromSaved = async () => {
    if (selectedSavedChannels.size === 0) return

    setIsLoading(true)
    setError(null)
    setPlaylistData(null)
    setCategorizeTime(null)
    setSaveResult(null)
    setElapsedTime(0)
    const startTime = Date.now()

    try {
      const result = await importVideosFromChannels.mutateAsync({
        channelIds: Array.from(selectedSavedChannels),
        videosPerChannel: savedVideosPerChannel,
        mode: importMode,
        extractFullMetadata: extractFullMetadata,
        extractTranscript: extractTranscript,
      })

      // Get selected channel names for the title
      const selectedChannelNames = savedChannelsData?.channels
        .filter(c => selectedSavedChannels.has(c.channel_id))
        .map(c => c.channel_name)
        .slice(0, 3)
        .join(', ') || 'Canales guardados'
      const moreCount = selectedSavedChannels.size - 3

      const videosWithComments = result.videos.map(v => ({
        ...v,
        comment_count: v.comment_count ?? null,
      }))

      setPlaylistData({
        id: 'saved-channels',
        title: `Videos de ${selectedChannelNames}${moreCount > 0 ? ` y ${moreCount} más` : ''}`,
        channel: 'Canales Guardados',
        video_count: result.total_videos,
        videos: videosWithComments,
      })
      setLoadTime((Date.now() - startTime) / 1000)

      // AUTO-SAVE: Automatically save subscription videos to database
      if (result.videos.length > 0) {
        setIsSaving(true)
        const saveResult = await saveVideosToSupabase(videosWithComments, 'subscription')
        setSaveResult({
          success: true,
          inserted: saveResult.inserted,
          errors: saveResult.errors.length > 0 ? saveResult.errors : undefined
        })
        setIsSaving(false)
      }

      // Refetch saved channels to update stats
      refetchSavedChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar videos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCategorize = async () => {
    if (!playlistData) return

    setIsCategorizing(true)
    setError(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/ai/categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videos: playlistData.videos.map(v => ({
            title: v.title,
            author: v.author,
            tags: v.tags || [],
            description: v.description || '',
            transcript: v.transcript || null,
          })),
          include_subcategories: includeSubcategories,
          include_summary: includeSummary,
          extended_summary: extendedSummary,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al categorizar')
      }

      const data = await response.json()
      setCategorizeTime(data.processing_time_seconds)

      // Update videos with AI categories, subcategories, and summaries
      const categorizedMap = new Map(
        data.results.map((r: CategorizedVideo) => [r.title, r])
      )

      setPlaylistData({
        ...playlistData,
        videos: playlistData.videos.map(v => {
          const result = categorizedMap.get(v.title) as CategorizedVideo | undefined
          return {
            ...v,
            ai_category: result?.category || 'Otros',
            ai_subcategories: result?.subcategories || [],
            ai_summary: result?.summary || undefined,
            ai_key_points: result?.key_points || [],
            ai_processing_time: result?.processing_time_seconds,
          }
        }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al categorizar')
    } finally {
      setIsCategorizing(false)
    }
  }

  const handleSaveToSupabase = async () => {
    if (!playlistData) return

    setIsSaving(true)
    setError(null)
    setSaveResult(null)

    try {
      // Build category name -> id map
      const categoryMap: Record<string, number> = {}
      if (categories) {
        for (const cat of categories) {
          categoryMap[cat.name] = cat.id
        }
      }

      // Find "Otros" category id as fallback
      const otrosId = categoryMap['Otros'] || Object.values(categoryMap)[0] || 1

      // Get existing tags to avoid duplicates
      const { data: existingTags } = await supabase.from('tags').select('id, name')
      const tagMap: Record<string, number> = {}
      if (existingTags) {
        for (const tag of existingTags as { id: number; name: string }[]) {
          tagMap[tag.name.toLowerCase()] = tag.id
        }
      }

      // Get existing subcategories
      const { data: existingSubcats } = await supabase.from('subcategories').select('id, name, category_id')
      const subcatMap: Record<string, number> = {}
      if (existingSubcats) {
        for (const subcat of existingSubcats as { id: number; name: string; category_id: number }[]) {
          subcatMap[`${subcat.name.toLowerCase()}-${subcat.category_id}`] = subcat.id
        }
      }

      let inserted = 0
      let tagsLinked = 0
      let subcatsLinked = 0
      const errors: string[] = []

      for (const video of playlistData.videos) {
        // Find category id from AI category or default to "Otros"
        const categoryId = video.ai_category ? (categoryMap[video.ai_category] || otrosId) : otrosId

        // Convert upload_date from YYYYMMDD to YYYY-MM-DD for PostgreSQL
        let uploadDateFormatted: string | null = null
        if (video.upload_date && video.upload_date.length === 8) {
          uploadDateFormatted = `${video.upload_date.slice(0, 4)}-${video.upload_date.slice(4, 6)}-${video.upload_date.slice(6, 8)}`
        }

        const videoData = {
          youtube_id: video.id,
          title: video.title,
          author: video.author,
          description: video.description || '',
          summary: video.ai_summary || '',
          key_points: video.ai_key_points || [],
          duration: video.duration_seconds,
          view_count: video.view_count,
          like_count: video.like_count,
          url: video.url,
          thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
          upload_date: uploadDateFormatted,
          category_id: categoryId,
          source: activeTab === 'subscriptions' ? 'subscription' : 'playlist',
          transcript: video.transcript || null,
          has_transcript: !!video.transcript,
        }

        const { data: insertedVideo, error: insertError } = await supabase
          .from('videos')
          .insert(videoData as never)
          .select('id')
          .single()

        if (insertError) {
          errors.push(`${video.title}: ${insertError.message}`)
          continue
        }

        inserted++
        const videoId = (insertedVideo as { id: number }).id

        // Save YouTube tags (limit to 15 most relevant) - optimized with upsert and batch insert
        if (video.tags && video.tags.length > 0) {
          const tagsToSave = video.tags.slice(0, 15)
          const tagIdsToLink: number[] = []

          // First, ensure all tags exist using upsert (avoids 409 conflicts)
          const newTagsToCreate = tagsToSave
            .map(t => t.toLowerCase().trim())
            .filter(t => t && t.length <= 100 && !tagMap[t])

          if (newTagsToCreate.length > 0) {
            // Batch upsert all new tags at once
            const { data: upsertedTags } = await supabase
              .from('tags')
              .upsert(
                newTagsToCreate.map(name => ({ name })) as never[],
                { onConflict: 'name', ignoreDuplicates: false }
              )
              .select('id, name')

            if (upsertedTags) {
              for (const tag of upsertedTags as { id: number; name: string }[]) {
                tagMap[tag.name.toLowerCase()] = tag.id
              }
            }
          }

          // Collect tag IDs for linking
          for (const tagName of tagsToSave) {
            const normalizedTag = tagName.toLowerCase().trim()
            if (!normalizedTag || normalizedTag.length > 100) continue
            const tagId = tagMap[normalizedTag]
            if (tagId) tagIdsToLink.push(tagId)
          }

          // Batch insert all video_tags at once with upsert to avoid duplicates
          if (tagIdsToLink.length > 0) {
            const { error: linkError } = await supabase
              .from('video_tags')
              .upsert(
                tagIdsToLink.map(tag_id => ({ video_id: videoId, tag_id })) as never[],
                { onConflict: 'video_id,tag_id', ignoreDuplicates: true }
              )

            if (!linkError) tagsLinked += tagIdsToLink.length
          }
        }

        // Save AI subcategories - optimized with upsert and batch insert
        if (video.ai_subcategories && video.ai_subcategories.length > 0) {
          const subcatIdsToLink: number[] = []

          // Find subcategories that need to be created
          const newSubcatsToCreate = video.ai_subcategories
            .map(name => ({ name, normalized: name.toLowerCase().trim() }))
            .filter(s => s.normalized && !subcatMap[`${s.normalized}-${categoryId}`])

          if (newSubcatsToCreate.length > 0) {
            // Batch upsert all new subcategories at once
            const { data: upsertedSubcats } = await supabase
              .from('subcategories')
              .upsert(
                newSubcatsToCreate.map(s => ({ name: s.name, category_id: categoryId })) as never[],
                { onConflict: 'name,category_id', ignoreDuplicates: false }
              )
              .select('id, name, category_id')

            if (upsertedSubcats) {
              for (const subcat of upsertedSubcats as { id: number; name: string; category_id: number }[]) {
                subcatMap[`${subcat.name.toLowerCase()}-${subcat.category_id}`] = subcat.id
              }
            }
          }

          // Collect subcategory IDs for linking
          for (const subcatName of video.ai_subcategories) {
            const normalizedSubcat = subcatName.toLowerCase().trim()
            const subcatKey = `${normalizedSubcat}-${categoryId}`
            const subcatId = subcatMap[subcatKey]
            if (subcatId) subcatIdsToLink.push(subcatId)
          }

          // Batch insert all video_subcategories at once with upsert
          if (subcatIdsToLink.length > 0) {
            const { error: linkError } = await supabase
              .from('video_subcategories')
              .upsert(
                subcatIdsToLink.map(subcategory_id => ({ video_id: videoId, subcategory_id })) as never[],
                { onConflict: 'video_id,subcategory_id', ignoreDuplicates: true }
              )

            if (!linkError) subcatsLinked += subcatIdsToLink.length
          }
        }
      }

      setSaveResult({
        success: true,
        inserted,
        errors: errors.length > 0 ? errors : undefined
      })

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['authors'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['subcategories'] })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaveResult({ success: false, inserted: 0, errors: [String(err)] })
    } finally {
      setIsSaving(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Finanzas': 'bg-green-100 text-green-800',
      'Tecnología': 'bg-blue-100 text-blue-800',
      'Educación': 'bg-purple-100 text-purple-800',
      'Productividad': 'bg-yellow-100 text-yellow-800',
      'Salud': 'bg-red-100 text-red-800',
      'Negocios': 'bg-indigo-100 text-indigo-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Desarrollo Personal': 'bg-orange-100 text-orange-800',
      'Entretenimiento': 'bg-cyan-100 text-cyan-800',
      'Otros': 'bg-gray-100 text-gray-800',
    }
    return colors[category] || colors['Otros']
  }

  const hasCategorizedVideos = playlistData?.videos.some(v => v.ai_category)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Videos</h1>
        <p className="text-gray-500">Importa videos desde playlists, suscripciones o URLs individuales</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('playlist'); setPlaylistData(null); setError(null); setBulkResults(null) }}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'playlist'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Youtube className="w-4 h-4" />
          Playlist
        </button>
        <button
          onClick={() => { setActiveTab('subscriptions'); setPlaylistData(null); setError(null); setBulkResults(null) }}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Suscripciones
        </button>
        <button
          onClick={() => { setActiveTab('urls'); setPlaylistData(null); setError(null); setBulkResults(null) }}
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'urls'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          URLs
        </button>
      </div>

      {/* Tab Content: Playlist */}
      {activeTab === 'playlist' && (
      <form onSubmit={handleScrapePlaylist} className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="playlistUrl" className="block text-sm font-medium text-gray-700 mb-1">
              URL de la Playlist
            </label>
            <input
              id="playlistUrl"
              type="url"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=PLxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extractFullMetadata}
                  onChange={(e) => setExtractFullMetadata(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-700">Metadatos completos</span>
                <span className="text-gray-400">(más lento)</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useCookies}
                  onChange={(e) => setUseCookies(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-700">Cookies de Chrome</span>
                <span className="text-gray-400">(privadas)</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extractTranscript}
                  onChange={(e) => setExtractTranscript(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  disabled={isLoading}
                />
                <span className="text-gray-700">Extraer transcripción</span>
                <span className="text-gray-400">(subtítulos YouTube)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!isLoading ? (
            <button
              type="submit"
              disabled={!playlistUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              Extraer Playlist
            </button>
          ) : (
            <div className="w-full space-y-3">
              {/* Progress indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="font-medium">Extrayendo datos de la playlist...</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Timer className="w-4 h-4" />
                    <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                  </div>
                </div>

                {/* Animated progress bar */}
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full animate-pulse"
                    style={{
                      width: '100%',
                      animation: 'progress-indeterminate 1.5s ease-in-out infinite'
                    }}
                  />
                </div>

                <div className="mt-2 text-xs text-blue-600">
                  {extractFullMetadata ? (
                    <span>Extrayendo metadatos completos (~3-5s por video)</span>
                  ) : (
                    <span>Extracción rápida (~0.5s por video)</span>
                  )}
                  {extractTranscript && <span> + subtítulos</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
      )}

      {/* Tab Content: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {/* Sub-tabs for subscriptions */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setSubscriptionSubTab('saved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                subscriptionSubTab === 'saved'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Database className="w-4 h-4" />
              Canales Guardados
              {savedChannelsData && savedChannelsData.total > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {savedChannelsData.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubscriptionSubTab('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                subscriptionSubTab === 'feed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Feed en Vivo
            </button>
          </div>

          {/* Sub-tab: Saved Channels */}
          {subscriptionSubTab === 'saved' && (
            <div className="space-y-4">
              {/* Active Jobs Indicator */}
              {activeJobsData && activeJobsData.running > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                      <div>
                        <h4 className="font-medium text-amber-800">
                          {activeJobsData.running} job{activeJobsData.running > 1 ? 's' : ''} en ejecución
                        </h4>
                        <div className="text-sm text-amber-600 space-y-1 mt-1">
                          {activeJobsData.jobs.filter(j => j.status === 'running').map(job => (
                            <div key={job.id} className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-amber-100 px-2 py-0.5 rounded">
                                {job.id}
                              </span>
                              <span>{job.type === 'channel_import' ? 'Importando canales' : job.type}</span>
                              <span className="font-medium">{job.progress}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {activeJobsData.jobs.filter(j => j.status === 'running').map(job => (
                        <button
                          key={job.id}
                          onClick={() => cancelJob.mutate(job.id)}
                          disabled={cancelJob.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                        >
                          <Square className="w-3 h-3" />
                          Cancelar
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Import CSV Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Importar canales desde CSV</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Sube tu archivo de suscripciones de Google Takeout (YouTube → suscripciones.csv)
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Seleccionar archivo CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {csvContent && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Archivo cargado
                      </span>
                    )}
                  </div>

                  {csvContent && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleImportCSV}
                        disabled={importCSV.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {importCSV.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Importar canales
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {showImportResult && importCSV.data && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <Check className="w-4 h-4 inline mr-2" />
                      {importCSV.data.channels_imported} nuevos, {importCSV.data.channels_updated} actualizados
                      (de {importCSV.data.total_in_csv} en CSV)
                    </div>
                  )}
                </div>
              </div>

              {/* Add Channel by URL Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Añadir canal manualmente</h3>
                    <p className="text-sm text-gray-500">Pega la URL de un canal de YouTube</p>
                  </div>
                  <button
                    onClick={() => setShowAddChannel(!showAddChannel)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      showAddChannel ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {showAddChannel ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddChannel ? 'Cerrar' : 'Añadir canal'}
                  </button>
                </div>

                {showAddChannel && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={newChannelUrl}
                        onChange={(e) => setNewChannelUrl(e.target.value)}
                        placeholder="https://youtube.com/@ChannelName"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddChannelByURL()}
                      />
                    </div>
                    <button
                      onClick={handleAddChannelByURL}
                      disabled={addChannelByURL.isPending || !newChannelUrl.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addChannelByURL.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Añadir
                    </button>
                  </div>
                )}
              </div>

              {/* Saved Channels List */}
              {savedChannelsData && savedChannelsData.total > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {/* Header with stats and actions */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Canales guardados ({savedChannelsData.active} activos de {savedChannelsData.total})
                      </h3>
                      <p className="text-sm text-gray-500">
                        {filteredAndSortedChannels.length} mostrados • {selectedSavedChannels.size} seleccionados
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllSavedChannels}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Seleccionar activos
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={deselectAllSavedChannels}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Deseleccionar
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Filter className="w-4 h-4" />
                      <span>Filtrar:</span>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'with_videos', label: 'Con videos' },
                        { value: 'no_videos', label: 'Sin videos' },
                        { value: 'new', label: 'Nuevos (7d)' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setChannelFilter(value as typeof channelFilter)}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            channelFilter === value
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-10"></th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">
                            <button
                              onClick={() => toggleSort('name')}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Canal {getSortIcon('name')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">
                            <button
                              onClick={() => toggleSort('videos')}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Videos {getSortIcon('videos')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                            <button
                              onClick={() => toggleSort('first_import')}
                              className="flex items-center gap-1 hover:text-blue-600"
                              title="Fecha de primer import"
                            >
                              1ª Imp. {getSortIcon('first_import')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                            <button
                              onClick={() => toggleSort('last_import')}
                              className="flex items-center gap-1 hover:text-blue-600"
                              title="Fecha de última sincronización"
                            >
                              Últ. Sync {getSortIcon('last_import')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                            <button
                              onClick={() => toggleSort('last_video')}
                              className="flex items-center gap-1 hover:text-blue-600"
                              title="Fecha del último video importado"
                            >
                              Últ. Video {getSortIcon('last_video')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600 w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAndSortedChannels.map(channel => (
                          <tr
                            key={channel.channel_id}
                            className={`hover:bg-gray-50 ${!channel.is_active ? 'opacity-50 bg-gray-50' : ''}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedSavedChannels.has(channel.channel_id)}
                                onChange={() => toggleSavedChannel(channel.channel_id)}
                                disabled={!channel.is_active}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <a
                                href={channel.channel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
                              >
                                {channel.channel_name}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                              </a>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-medium ${channel.total_videos_imported === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                {channel.total_videos_imported}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {formatDate(channel.first_import_at)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {formatDate(channel.last_import_at)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {formatDate(channel.last_video_date)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleToggleChannelActive(channel.channel_id, !channel.is_active)}
                                  className={`p-1 rounded transition-colors ${
                                    channel.is_active
                                      ? 'text-green-600 hover:bg-green-50'
                                      : 'text-gray-400 hover:bg-gray-100'
                                  }`}
                                  title={channel.is_active ? 'Desactivar' : 'Activar'}
                                >
                                  {channel.is_active ? (
                                    <ToggleRight className="w-5 h-5" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteChannel(channel.channel_id, channel.channel_name)}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Eliminar canal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Batch selection for import */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Importar por lotes:</span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Tamaño:</label>
                          <select
                            value={batchSize}
                            onChange={(e) => { setBatchSize(Number(e.target.value)); setCurrentBatchStart(0) }}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrevBatch}
                          disabled={currentBatchStart === 0}
                          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ← Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Lote {Math.floor(currentBatchStart / batchSize) + 1} de {totalBatches || 1}
                        </span>
                        <button
                          onClick={handleNextBatch}
                          disabled={currentBatchStart + batchSize >= filteredAndSortedChannels.filter(c => c.is_active).length}
                          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Siguiente →
                        </button>
                        <button
                          onClick={handleSelectBatch}
                          className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Seleccionar lote actual ({currentBatchChannels.length})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Videos Section */}
              {selectedSavedChannels.size > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Importar videos</h3>

                  <div className="space-y-4">
                    {/* Import mode */}
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-sm text-gray-700">Modo:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImportMode('fixed')}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            importMode === 'fixed'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Fijo
                        </button>
                        <button
                          onClick={() => setImportMode('incremental')}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            importMode === 'incremental'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Incremental
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        {importMode === 'fixed'
                          ? '(últimos N videos, ignora duplicados)'
                          : '(solo videos nuevos desde última importación)'}
                      </span>
                    </div>

                    {/* Configuration */}
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-gray-700">Videos/canal:</span>
                        <input
                          type="number"
                          value={savedVideosPerChannel}
                          onChange={(e) => setSavedVideosPerChannel(Math.max(1, Math.min(50, Number(e.target.value))))}
                          min={1}
                          max={50}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={extractFullMetadata}
                          onChange={(e) => setExtractFullMetadata(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Metadatos completos</span>
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={extractTranscript}
                          onChange={(e) => setExtractTranscript(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-700">Transcripción</span>
                      </label>
                    </div>

                    {/* Action */}
                    <div className="pt-2">
                      <p className="text-sm text-gray-500 mb-3">
                        Se importarán hasta <strong>{savedVideosPerChannel * selectedSavedChannels.size}</strong> videos
                        ({savedVideosPerChannel} x {selectedSavedChannels.size} canales)
                      </p>

                      {!isLoading ? (
                        <button
                          onClick={handleImportVideosFromSaved}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Importar videos de {selectedSavedChannels.size} canal{selectedSavedChannels.size > 1 ? 'es' : ''}
                        </button>
                      ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-700">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span className="font-medium">Importando videos...</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-600">
                              <Timer className="w-4 h-4" />
                              <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full animate-pulse"
                              style={{ width: '100%', animation: 'progress-indeterminate 1.5s ease-in-out infinite' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!savedChannelsData || savedChannelsData.total === 0) && !isLoadingSavedChannels && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                  <Database className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-yellow-900 mb-2">No hay canales guardados</h3>
                  <p className="text-sm text-yellow-700">
                    Importa tu archivo de suscripciones de Google Takeout para empezar
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab: Feed (existing functionality) */}
          {subscriptionSubTab === 'feed' && (
            <div className="space-y-4">
          {/* Step 1: Load Channels */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Paso 1: Cargar canales suscritos</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se usarán las cookies de Chrome para acceder a tus suscripciones de YouTube
            </p>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {!isLoadingChannels ? (
              <button
                onClick={handleLoadChannels}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Cargar mis suscripciones
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="font-medium">Cargando suscripciones...</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Timer className="w-4 h-4" />
                    <span className="font-mono font-medium">{formatTime(channelsElapsedTime)}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600">Esto puede tardar unos segundos...</p>
              </div>
            )}

            {subscriptionChannels.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">{subscriptionChannels.length} canales encontrados</span>
              </div>
            )}
          </div>

          {/* Step 2: Select Channels */}
          {subscriptionChannels.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  Paso 2: Seleccionar canales ({selectedChannels.size} seleccionados)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllChannels}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAllChannels}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
                {subscriptionChannels.map(channel => (
                  <button
                    key={channel.channel_id}
                    onClick={() => toggleChannel(channel.channel_id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      selectedChannels.has(channel.channel_id)
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {channel.thumbnail ? (
                      <img
                        src={channel.thumbnail}
                        alt={channel.channel_name}
                        className="w-10 h-10 rounded-full object-cover bg-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {channel.channel_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {channel.video_count} videos en feed
                      </p>
                    </div>
                    {selectedChannels.has(channel.channel_id) && (
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Configure and Load */}
          {selectedChannels.size > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Paso 3: Configurar importación</h3>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-gray-700">Videos por canal:</span>
                    <input
                      type="number"
                      value={videosPerChannel}
                      onChange={(e) => setVideosPerChannel(Math.max(1, Math.min(50, Number(e.target.value))))}
                      min={1}
                      max={50}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={extractFullMetadata}
                      onChange={(e) => setExtractFullMetadata(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Metadatos completos</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={extractTranscript}
                      onChange={(e) => setExtractTranscript(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700">Extraer transcripción</span>
                  </label>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-gray-500 mb-3">
                    Se importarán hasta <strong>{videosPerChannel * selectedChannels.size}</strong> videos
                    ({videosPerChannel} x {selectedChannels.size} canales)
                  </p>

                  {!isLoading ? (
                    <button
                      onClick={handleLoadVideosFromChannels}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Cargar videos de {selectedChannels.size} canal{selectedChannels.size > 1 ? 'es' : ''}
                    </button>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-blue-700">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="font-medium">Cargando videos de {selectedChannels.size} canales...</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-600">
                          <Timer className="w-4 h-4" />
                          <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full animate-pulse"
                          style={{ width: '100%', animation: 'progress-indeterminate 1.5s ease-in-out infinite' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* CSS for indeterminate progress animation */}
      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Results (shared between tabs) */}
      {playlistData && (
        <div className="space-y-4">
          {/* Playlist Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{playlistData.title}</h2>
                <p className="text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {playlistData.channel}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{playlistData.video_count} videos extraídos</span>
                </div>
                {loadTime && (
                  <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-green-700">{formatTime(Math.round(loadTime))}</p>
                        <p className="text-xs text-green-600">Tiempo total</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-green-700">{(loadTime / playlistData.video_count).toFixed(1)}s</p>
                        <p className="text-xs text-green-600">Por video</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-green-700">{Math.round(playlistData.video_count / loadTime * 60)}</p>
                        <p className="text-xs text-green-600">Videos/min</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Categorize Options & Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeSubcategories}
                    onChange={(e) => setIncludeSubcategories(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    disabled={isCategorizing}
                  />
                  <span className="text-gray-700">Subcategorías</span>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => {
                      setIncludeSummary(e.target.checked)
                      if (!e.target.checked) setExtendedSummary(false)
                    }}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    disabled={isCategorizing || !playlistData?.videos.some(v => v.transcript)}
                  />
                  <span className="text-gray-700">Resumen</span>
                  {!playlistData?.videos.some(v => v.transcript) && (
                    <span className="text-gray-400">(requiere transcripción)</span>
                  )}
                </label>

                {includeSummary && playlistData?.videos.some(v => v.transcript) && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={extendedSummary}
                      onChange={(e) => setExtendedSummary(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      disabled={isCategorizing}
                    />
                    <span className="text-gray-700">Extendido</span>
                    <span className="text-gray-400">(+ puntos clave)</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCategorize}
                  disabled={isCategorizing}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCategorizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Categorizando con IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {hasCategorizedVideos ? 'Re-categorizar' : 'Categorizar con IA'}
                    </>
                  )}
                </button>
                {hasCategorizedVideos && categorizeTime && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    Categorizado en {categorizeTime.toFixed(1)}s
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {hasCategorizedVideos
                  ? 'Puedes re-categorizar con diferentes opciones (subcategorías, resumen)'
                  : 'Usa IA local para asignar categorías automáticamente a cada video'
                }
              </p>

              {/* Save to Supabase Button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveToSupabase}
                    disabled={isSaving || !playlistData}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar en Base de Datos
                      </>
                    )}
                  </button>
                  {saveResult && saveResult.success && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      {saveResult.inserted} videos guardados
                    </span>
                  )}
                </div>
                {saveResult?.errors && saveResult.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700 font-medium">
                      {saveResult.errors.length} errores (posibles duplicados):
                    </p>
                    <ul className="text-xs text-yellow-600 mt-1 max-h-20 overflow-y-auto">
                      {saveResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="truncate">• {err}</li>
                      ))}
                      {saveResult.errors.length > 5 && (
                        <li>...y {saveResult.errors.length - 5} más</li>
                      )}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Los videos se guardarán con la categoría asignada por la IA (o "Otros" si no se ha categorizado)
                </p>
              </div>
            </div>
          </div>

          {/* Videos List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Videos ({playlistData.videos.length})</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {playlistData.videos.map((video, index) => (
                <div key={video.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <img
                          src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                          alt={video.title}
                          className="w-40 h-24 object-cover rounded-lg bg-gray-200"
                          onError={(e) => {
                            e.currentTarget.src = `https://img.youtube.com/vi/${video.id}/default.jpg`
                          }}
                        />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                          {video.duration_formatted}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-gray-900 line-clamp-2">
                            {index + 1}. {video.title}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">{video.author}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {video.has_transcript && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              <FileText className="w-3 h-3" />
                            </span>
                          )}
                          {video.ai_category && (
                            <span className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(video.ai_category)}`}>
                              <Tag className="w-3 h-3" />
                              {video.ai_category}
                              {video.ai_processing_time && (
                                <span className="text-gray-400 font-normal ml-1">
                                  ({video.ai_processing_time.toFixed(1)}s)
                                </span>
                              )}
                            </span>
                          )}
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          {(video.ai_summary || video.ai_subcategories?.length || video.transcript) && (
                            <button
                              onClick={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}
                              className="flex-shrink-0 p-2 text-gray-400 hover:text-purple-600 transition-colors"
                            >
                              {expandedVideo === video.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {formatNumber(video.view_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-4 h-4" />
                          {formatNumber(video.like_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {video.duration_formatted}
                        </span>
                      </div>

                      {/* Subcategories */}
                      {video.ai_subcategories && video.ai_subcategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {video.ai_subcategories.map((subcat, subIndex) => (
                            <span
                              key={subIndex}
                              className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200"
                            >
                              {subcat}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Tags */}
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {video.tags.slice(0, 5).map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {video.tags.length > 5 && (
                            <span className="px-2 py-0.5 text-gray-400 text-xs">
                              +{video.tags.length - 5} más
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expanded Details */}
                      {expandedVideo === video.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                          {/* AI Summary */}
                          {video.ai_summary && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 mb-1">Resumen IA</h5>
                              <p className="text-sm text-gray-600 bg-purple-50 p-2 rounded-lg whitespace-pre-wrap">
                                {video.ai_summary}
                              </p>
                            </div>
                          )}

                          {/* Key Points */}
                          {video.ai_key_points && video.ai_key_points.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 mb-1">Puntos clave</h5>
                              <ul className="text-sm text-gray-600 bg-purple-50 p-2 rounded-lg space-y-1">
                                {video.ai_key_points.map((point, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-purple-500">•</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Transcript */}
                          {video.transcript && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <h5 className="text-xs font-semibold text-gray-700">Transcripción</h5>
                                <span className="text-xs text-gray-400">
                                  {video.transcript.length.toLocaleString()} caracteres
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {video.transcript}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: URLs */}
      {activeTab === 'urls' && (
        <form onSubmit={handleScrapeBulkUrls} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="urlsInput" className="block text-sm font-medium text-gray-700 mb-1">
                URLs de videos (una por línea)
              </label>
              <textarea
                id="urlsInput"
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                placeholder={`https://www.youtube.com/watch?v=XXXXX\nhttps://www.tiktok.com/@user/video/XXXXX\nhttps://youtu.be/XXXXX`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={6}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {urlsInput.split('\n').filter(u => u.trim()).length} URLs detectadas
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={urlsExtractTranscript}
                    onChange={(e) => setUrlsExtractTranscript(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span className="text-gray-700">Extraer transcripciones</span>
                  <span className="text-gray-400">(solo YouTube)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading || !urlsInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Importar Videos
                  </>
                )}
              </button>

              {urlsLoadTime && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  {urlsLoadTime.toFixed(1)}s
                </span>
              )}
            </div>

            {/* Loading Progress */}
            {isLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="font-medium text-blue-900">
                    Importando videos...
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-sm text-blue-700">
                    <Timer className="w-4 h-4" />
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: '100%',
                      animation: 'progress-indeterminate 1.5s ease-in-out infinite'
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  <span>~3-5 segundos por video</span>
                  {urlsExtractTranscript && <span> + transcripción</span>}
                </div>
              </div>
            )}

            {/* Import Results Summary */}
            {bulkResults && (
              <div className={`rounded-lg p-4 ${bulkResults.failed_count > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {bulkResults.failed_count > 0 ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <Check className="w-5 h-5 text-green-600" />
                  )}
                  <span className={`font-medium ${bulkResults.failed_count > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                    {bulkResults.success_count} de {bulkResults.total} videos importados
                    {bulkResults.failed_count > 0 && ` (${bulkResults.failed_count} errores)`}
                  </span>
                </div>

                {/* Show failed URLs */}
                {bulkResults.failed_count > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-yellow-800">URLs con error:</p>
                    {bulkResults.results.filter(r => !r.success).map((r, i) => (
                      <div key={i} className="text-xs text-yellow-700 flex items-start gap-2">
                        <X className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-mono break-all">{r.url}</span>
                          <span className="text-yellow-600 ml-1">- {r.error}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show source breakdown */}
                <div className="mt-2 flex gap-3 text-xs">
                  {bulkResults.results.filter(r => r.success && r.source === 'youtube').length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <Youtube className="w-3 h-3" />
                      {bulkResults.results.filter(r => r.success && r.source === 'youtube').length} YouTube
                    </span>
                  )}
                  {bulkResults.results.filter(r => r.success && r.source === 'tiktok').length > 0 && (
                    <span className="flex items-center gap-1 text-gray-700">
                      <span className="text-sm">📱</span>
                      {bulkResults.results.filter(r => r.success && r.source === 'tiktok').length} TikTok
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Instructions - Playlist Tab */}
      {activeTab === 'playlist' && !playlistData && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Tips</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Puedes usar URLs de playlist o de video individual</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Para playlists privadas, activa "Usar cookies de Chrome" (debes estar logueado en YouTube)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Desactiva "Metadatos completos" para cargas más rápidas (menos información por video)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Después de importar, usa "Categorizar con IA" para asignar categorías automáticamente</span>
            </li>
          </ul>
        </div>
      )}

      {/* Instructions - URLs Tab */}
      {activeTab === 'urls' && !bulkResults && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Tips - Importar URLs</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Pega una URL por línea - puedes mezclar YouTube y TikTok</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>URLs válidas: youtube.com/watch, youtu.be, tiktok.com/@user/video</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Las transcripciones solo están disponibles para videos de YouTube con subtítulos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Después de importar, puedes categorizar y guardar como con playlists</span>
            </li>
          </ul>
        </div>
      )}

      {/* Instructions - Subscriptions Tab */}
      {activeTab === 'subscriptions' && subscriptionChannels.length === 0 && !isLoadingChannels && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Tips - Suscripciones</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Debes estar logueado en YouTube en Chrome para que funcione</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Se cargarán los canales que tienen videos recientes en tu feed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>Los canales se ordenan por cantidad de videos en el feed (más activos primero)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span>La primera carga puede tardar ~30 segundos en procesar tu feed completo</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
