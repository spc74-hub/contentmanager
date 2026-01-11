import { useState, useEffect, useMemo } from 'react'
import {
  Search, Filter, Youtube, ExternalLink,
  Grid, List, ChevronDown, ChevronUp, Check, X,
  Zap, BookOpen, Coffee, Heart, Loader2, FileSpreadsheet, Download, Video,
  Edit2, Trash2, Plus, Link, Star, Users, Tag, Settings
} from 'lucide-react'

interface ChannelTheme {
  id: number
  name: string
  color: string | null
  sort_order: number
}

interface CuratedChannel {
  id: number
  name: string
  youtube_url: string | null
  youtube_channel_id: string | null
  youtube_channel_url: string | null
  thumbnail: string | null
  theme_id: number | null
  theme_name: string | null
  level: string
  energy: string
  use_type: string
  is_active: boolean
  is_resolved: boolean
  is_favorite: boolean
  subscriber_count: number | null
  last_import_at: string | null
  total_videos_imported: number
  created_at: string | null
}

interface ChannelsResponse {
  channels: CuratedChannel[]
  total: number
  themes: ChannelTheme[]
}

interface ChannelStats {
  total_channels: number
  resolved_channels: number
  by_theme: Record<string, number>
  by_level: Record<string, number>
  by_energy: Record<string, number>
  by_use_type: Record<string, number>
}

interface ChannelTagType {
  id: number
  name: string
  color: string
  created_at?: string
}

type ViewMode = 'grid' | 'list'

const LEVEL_LABELS: Record<string, string> = {
  intro: 'Intro',
  medio: 'Medio',
  avanzado: 'Avanzado'
}

const ENERGY_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta'
}

const USE_TYPE_LABELS: Record<string, string> = {
  estudio: 'Estudio',
  inspiracion: 'Inspiración',
  ocio: 'Ocio',
  espiritual: 'Espiritual'
}

const USE_TYPE_ICONS: Record<string, typeof BookOpen> = {
  estudio: BookOpen,
  inspiracion: Zap,
  ocio: Coffee,
  espiritual: Heart
}

const LEVEL_COLORS: Record<string, string> = {
  intro: 'bg-green-100 text-green-700',
  medio: 'bg-yellow-100 text-yellow-700',
  avanzado: 'bg-red-100 text-red-700'
}

const ENERGY_COLORS: Record<string, string> = {
  baja: 'bg-blue-100 text-blue-700',
  media: 'bg-orange-100 text-orange-700',
  alta: 'bg-red-100 text-red-700'
}

// Format subscriber count (e.g., 1.2M, 500K, 1.5K)
const formatSubscribers = (count: number | null): string => {
  if (!count) return ''
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  return count.toString()
}

export function Channels() {
  const [channels, setChannels] = useState<CuratedChannel[]>([])
  const [themes, setThemes] = useState<ChannelTheme[]>([])
  const [stats, setStats] = useState<ChannelStats | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  // Video import state
  const [importingChannelId, setImportingChannelId] = useState<number | null>(null)
  const [videoImportResult, setVideoImportResult] = useState<{
    channelName: string
    imported: number
    skipped: number
    transcripts_found: number
    success: boolean
  } | null>(null)
  const [showImportMenu, setShowImportMenu] = useState<number | null>(null)

  // Bulk import state
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set())
  const [showBulkImportMenu, setShowBulkImportMenu] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkImportProgress, setBulkImportProgress] = useState<{ current: number; total: number; results: { name: string; imported: number; transcripts: number }[] } | null>(null)

  // Bulk import favorites state
  const [bulkFavoritesJobId, setBulkFavoritesJobId] = useState<string | null>(null)
  const [bulkFavoritesProgress, setBulkFavoritesProgress] = useState<{
    status: string
    total_channels: number
    processed_channels: number
    current_channel: string | null
    results: { channel: string; imported: number; transcripts: number; success: boolean }[]
    errors: string[]
  } | null>(null)
  const [showBulkFavoritesModal, setShowBulkFavoritesModal] = useState(false)

  // Update subscribers state
  const [updateSubsJobId, setUpdateSubsJobId] = useState<string | null>(null)
  const [updateSubsProgress, setUpdateSubsProgress] = useState<{
    status: string
    total_channels: number
    processed_channels: number
    current_channel: string | null
    results: { channel: string; subscribers: number; success: boolean }[]
    errors: string[]
  } | null>(null)
  const [showUpdateSubsModal, setShowUpdateSubsModal] = useState(false)

  // Resolve search URLs state
  const [resolveUrlsJobId, setResolveUrlsJobId] = useState<string | null>(null)
  const [resolveUrlsProgress, setResolveUrlsProgress] = useState<{
    status: string
    total_channels: number
    processed_channels: number
    current_channel: string | null
    results: { channel: string; resolved_to: string | null; success: boolean }[]
    errors: string[]
  } | null>(null)
  const [showResolveUrlsModal, setShowResolveUrlsModal] = useState(false)

  // Edit/Delete/Add modals
  const [editingChannel, setEditingChannel] = useState<CuratedChannel | null>(null)
  const [deletingChannel, setDeletingChannel] = useState<CuratedChannel | null>(null)
  const [showAddUrlModal, setShowAddUrlModal] = useState(false)
  const [addUrlInput, setAddUrlInput] = useState('')
  const [addUrlLoading, setAddUrlLoading] = useState(false)

  const VIDEO_IMPORT_OPTIONS = [5, 10, 20, 50, 100, 200]

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(true)
  const [showStats, setShowStats] = useState(true)
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(new Set())
  const [allCollapsed, setAllCollapsed] = useState(true)

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null)
  const [selectedUseType, setSelectedUseType] = useState<string | null>(null)
  const [onlyResolved, setOnlyResolved] = useState<boolean | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState<boolean | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)

  // Tags state
  const [availableTags, setAvailableTags] = useState<ChannelTagType[]>([])
  const [channelTags, setChannelTags] = useState<Record<number, ChannelTagType[]>>({})
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [editingTagsForChannel, setEditingTagsForChannel] = useState<CuratedChannel | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6B7280')

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Fetch channels
  const fetchChannels = async () => {
    setIsLoading(true)
    try {
      let data: ChannelsResponse

      if (selectedTagId) {
        // Fetch channels by tag first, then apply other filters client-side
        const tagResponse = await fetch(`${apiUrl}/api/channels/by-tag/${selectedTagId}`)
        const tagChannels: CuratedChannel[] = await tagResponse.json()

        // Apply other filters client-side
        let filtered = tagChannels
        if (selectedTheme) filtered = filtered.filter(ch => ch.theme_id === selectedTheme)
        if (selectedLevel) filtered = filtered.filter(ch => ch.level === selectedLevel)
        if (selectedEnergy) filtered = filtered.filter(ch => ch.energy === selectedEnergy)
        if (selectedUseType) filtered = filtered.filter(ch => ch.use_type === selectedUseType)
        if (onlyResolved !== null) filtered = filtered.filter(ch => ch.is_resolved === onlyResolved)
        if (onlyFavorites !== null) filtered = filtered.filter(ch => ch.is_favorite === onlyFavorites)
        if (searchInput) {
          const search = searchInput.toLowerCase()
          filtered = filtered.filter(ch => ch.name.toLowerCase().includes(search))
        }

        // Get themes from regular endpoint
        const themesResponse = await fetch(`${apiUrl}/api/channels?limit=1`)
        const themesData: ChannelsResponse = await themesResponse.json()

        data = {
          channels: filtered,
          total: filtered.length,
          themes: themesData.themes
        }
      } else {
        const params = new URLSearchParams()
        if (selectedTheme) params.append('theme_id', selectedTheme.toString())
        if (selectedLevel) params.append('level', selectedLevel)
        if (selectedEnergy) params.append('energy', selectedEnergy)
        if (selectedUseType) params.append('use_type', selectedUseType)
        if (onlyResolved !== null) params.append('is_resolved', onlyResolved.toString())
        if (onlyFavorites !== null) params.append('is_favorite', onlyFavorites.toString())
        if (searchInput) params.append('search', searchInput)
        params.append('limit', '1000')

        const response = await fetch(`${apiUrl}/api/channels?${params}`)
        data = await response.json()
      }

      setChannels(data.channels)
      setThemes(data.themes)
      setTotal(data.total)
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/stats`)
      const data: ChannelStats = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // Fetch available tags
  const fetchTags = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/tags`)
      const data: ChannelTagType[] = await response.json()
      setAvailableTags(data)
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  // Fetch tags for a specific channel
  const fetchChannelTags = async (channelId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/${channelId}/tags`)
      const data: ChannelTagType[] = await response.json()
      setChannelTags(prev => ({ ...prev, [channelId]: data }))
    } catch (error) {
      console.error('Error fetching channel tags:', error)
    }
  }


  // Create a new tag
  const createTag = async () => {
    if (!newTagName.trim()) return
    try {
      const response = await fetch(`${apiUrl}/api/channels/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor })
      })
      if (response.ok) {
        setNewTagName('')
        setNewTagColor('#6B7280')
        fetchTags()
      }
    } catch (error) {
      console.error('Error creating tag:', error)
    }
  }

  // Delete a tag
  const deleteTag = async (tagId: number) => {
    try {
      await fetch(`${apiUrl}/api/channels/tags/${tagId}`, { method: 'DELETE' })
      fetchTags()
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  // Assign tag to channel
  const assignTagToChannel = async (channelId: number, tagId: number) => {
    try {
      await fetch(`${apiUrl}/api/channels/${channelId}/tags/${tagId}`, { method: 'POST' })
      fetchChannelTags(channelId)
    } catch (error) {
      console.error('Error assigning tag:', error)
    }
  }

  // Remove tag from channel
  const removeTagFromChannel = async (channelId: number, tagId: number) => {
    try {
      await fetch(`${apiUrl}/api/channels/${channelId}/tags/${tagId}`, { method: 'DELETE' })
      fetchChannelTags(channelId)
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  useEffect(() => {
    fetchChannels()
    fetchStats()
    fetchTags()
  }, [selectedTheme, selectedLevel, selectedEnergy, selectedUseType, onlyResolved, onlyFavorites, selectedTagId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(fetchChannels, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Don't auto-fetch tags for all channels - too many requests
  // Tags are fetched on-demand when opening the tag assignment modal

  // Close import menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowImportMenu(null)
    if (showImportMenu !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showImportMenu])

  // Import from Excel
  const handleImport = async () => {
    setIsImporting(true)
    setImportResult(null)
    try {
      const response = await fetch(`${apiUrl}/api/channels/import-excel`, {
        method: 'POST'
      })
      const result = await response.json()
      setImportResult({ imported: result.imported, skipped: result.skipped })
      fetchChannels()
      fetchStats()
    } catch (error) {
      console.error('Error importing:', error)
    } finally {
      setIsImporting(false)
    }
  }

  // Import videos from a channel
  const handleImportVideos = async (channel: CuratedChannel, maxVideos: number = 20) => {
    setImportingChannelId(channel.id)
    setVideoImportResult(null)
    try {
      const response = await fetch(`${apiUrl}/api/channels/${channel.id}/import-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_videos: maxVideos })
      })
      const result = await response.json()
      setVideoImportResult({
        channelName: channel.name,
        imported: result.imported,
        skipped: result.skipped,
        transcripts_found: result.transcripts_found || 0,
        success: result.success
      })
      // Refresh to update stats
      fetchChannels()
      fetchStats()
    } catch (error) {
      console.error('Error importing videos:', error)
      setVideoImportResult({
        channelName: channel.name,
        imported: 0,
        skipped: 0,
        transcripts_found: 0,
        success: false
      })
    } finally {
      setImportingChannelId(null)
    }
  }

  // Bulk import for selected channels
  const handleBulkImport = async (maxVideos: number) => {
    if (selectedChannelIds.size === 0) return

    setBulkImporting(true)
    setShowBulkImportMenu(false)
    setBulkImportProgress({ current: 0, total: selectedChannelIds.size, results: [] })

    const selectedChannels = channels.filter(ch => selectedChannelIds.has(ch.id))
    const results: { name: string; imported: number; transcripts: number }[] = []

    for (let i = 0; i < selectedChannels.length; i++) {
      const channel = selectedChannels[i]
      setBulkImportProgress(prev => prev ? { ...prev, current: i + 1 } : null)

      try {
        const response = await fetch(`${apiUrl}/api/channels/${channel.id}/import-videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_videos: maxVideos })
        })
        const result = await response.json()
        results.push({
          name: channel.name,
          imported: result.imported || 0,
          transcripts: result.transcripts_found || 0
        })
      } catch (error) {
        results.push({ name: channel.name, imported: 0, transcripts: 0 })
      }

      setBulkImportProgress(prev => prev ? { ...prev, results: [...results] } : null)
    }

    setBulkImporting(false)
    setSelectedChannelIds(new Set())
    fetchChannels()
    fetchStats()
  }

  // Select all visible channels
  const handleSelectAll = () => {
    if (selectedChannelIds.size === channels.length) {
      setSelectedChannelIds(new Set())
    } else {
      setSelectedChannelIds(new Set(channels.map(ch => ch.id)))
    }
  }

  // Select all channels of a theme
  const handleSelectTheme = (themeName: string) => {
    const themeChannels = channels.filter(ch => (ch.theme_name || 'Sin tema') === themeName)
    const themeIds = new Set(themeChannels.map(ch => ch.id))

    // If all are selected, deselect them; otherwise select all
    const allSelected = themeChannels.every(ch => selectedChannelIds.has(ch.id))
    if (allSelected) {
      setSelectedChannelIds(prev => {
        const next = new Set(prev)
        themeIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedChannelIds(prev => new Set([...prev, ...themeIds]))
    }
  }

  // Clear filters
  const clearFilters = () => {
    setSearchInput('')
    setSelectedTheme(null)
    setSelectedLevel(null)
    setSelectedEnergy(null)
    setSelectedUseType(null)
    setOnlyResolved(null)
    setOnlyFavorites(null)
    setSelectedTagId(null)
  }

  const hasActiveFilters = selectedTheme || selectedLevel || selectedEnergy || selectedUseType || onlyResolved !== null || onlyFavorites !== null || searchInput || selectedTagId

  // Toggle favorite
  const handleToggleFavorite = async (channelId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/${channelId}/toggle-favorite`, {
        method: 'POST'
      })
      if (response.ok) {
        // Update local state
        setChannels(prev => prev.map(ch =>
          ch.id === channelId ? { ...ch, is_favorite: !ch.is_favorite } : ch
        ))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // Update channel theme
  const handleUpdateTheme = async (channelId: number, newThemeId: number | null) => {
    try {
      await fetch(`${apiUrl}/api/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: newThemeId })
      })
      setEditingChannel(null)
      fetchChannels()
    } catch (error) {
      console.error('Error updating channel:', error)
    }
  }

  // Delete channel
  const handleDeleteChannel = async (channelId: number) => {
    try {
      await fetch(`${apiUrl}/api/channels/${channelId}`, {
        method: 'DELETE'
      })
      setDeletingChannel(null)
      fetchChannels()
      fetchStats()
    } catch (error) {
      console.error('Error deleting channel:', error)
    }
  }

  // Delete selected channels
  const handleBulkDelete = async () => {
    if (selectedChannelIds.size === 0) return
    if (!confirm(`¿Eliminar ${selectedChannelIds.size} canales seleccionados?`)) return

    for (const channelId of selectedChannelIds) {
      try {
        await fetch(`${apiUrl}/api/channels/${channelId}`, { method: 'DELETE' })
      } catch (error) {
        console.error('Error deleting channel:', channelId, error)
      }
    }
    setSelectedChannelIds(new Set())
    fetchChannels()
    fetchStats()
  }

  // Add channel by URL
  const handleAddByUrl = async () => {
    if (!addUrlInput.trim()) return
    setAddUrlLoading(true)

    try {
      const response = await fetch(`${apiUrl}/api/channels/add-by-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrlInput.trim() })
      })
      const result = await response.json()
      if (result.success) {
        setShowAddUrlModal(false)
        setAddUrlInput('')
        fetchChannels()
        fetchStats()
      } else {
        alert(result.error || 'Error al añadir canal')
      }
    } catch (error) {
      console.error('Error adding channel:', error)
      alert('Error al añadir canal')
    } finally {
      setAddUrlLoading(false)
    }
  }

  // Start bulk import of favorites
  const startBulkFavoritesImport = async (videosPerChannel: number = 10, delaySeconds: number = 30) => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/bulk-import/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_ids: null, // null = all favorites
          max_videos_per_channel: videosPerChannel,
          delay_seconds: delaySeconds
        })
      })
      const result = await response.json()
      if (result.success) {
        setBulkFavoritesJobId(result.job_id)
        setShowBulkFavoritesModal(true)
        // Start polling for progress
        pollBulkFavoritesProgress(result.job_id)
      } else {
        alert(result.error || 'Error al iniciar importación')
      }
    } catch (error) {
      console.error('Error starting bulk import:', error)
      alert('Error al iniciar importación masiva')
    }
  }

  // Poll for bulk import progress
  const pollBulkFavoritesProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/channels/bulk-import/${jobId}`)
        const progress = await response.json()
        setBulkFavoritesProgress(progress)

        if (progress.status === 'running') {
          setTimeout(poll, 3000) // Poll every 3 seconds
        } else {
          // Completed or cancelled - refresh data
          fetchChannels()
          fetchStats()
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }
    poll()
  }

  // Cancel bulk import
  const cancelBulkFavoritesImport = async () => {
    if (!bulkFavoritesJobId) return
    try {
      await fetch(`${apiUrl}/api/channels/bulk-import/${bulkFavoritesJobId}/cancel`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error cancelling:', error)
    }
  }

  // Close bulk favorites modal
  const closeBulkFavoritesModal = () => {
    setShowBulkFavoritesModal(false)
    setBulkFavoritesJobId(null)
    setBulkFavoritesProgress(null)
  }

  // Start update subscribers
  const startUpdateSubscribers = async (onlyMissing: boolean = true) => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/update-subscribers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          only_missing: onlyMissing,
          only_favorites: false,
          delay_seconds: 5
        })
      })
      const result = await response.json()
      if (result.success) {
        setUpdateSubsJobId(result.job_id)
        setShowUpdateSubsModal(true)
        pollUpdateSubsProgress(result.job_id)
      } else {
        alert(result.error || 'Error al iniciar actualización')
      }
    } catch (error) {
      console.error('Error starting subscriber update:', error)
      alert('Error al iniciar actualización de suscriptores')
    }
  }

  // Poll for update subscribers progress
  const pollUpdateSubsProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/channels/bulk-import/${jobId}`)
        const progress = await response.json()
        setUpdateSubsProgress(progress)

        if (progress.status === 'running') {
          setTimeout(poll, 2000)
        } else {
          fetchChannels()
          fetchStats()
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }
    poll()
  }

  // Cancel update subscribers
  const cancelUpdateSubs = async () => {
    if (!updateSubsJobId) return
    try {
      await fetch(`${apiUrl}/api/channels/bulk-import/${updateSubsJobId}/cancel`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error cancelling:', error)
    }
  }

  // Close update subs modal
  const closeUpdateSubsModal = () => {
    setShowUpdateSubsModal(false)
    setUpdateSubsJobId(null)
    setUpdateSubsProgress(null)
  }

  // Start resolve search URLs
  const startResolveUrls = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/channels/resolve-search-urls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay_seconds: 3 })
      })
      const result = await response.json()
      if (result.success) {
        setResolveUrlsJobId(result.job_id)
        setShowResolveUrlsModal(true)
        pollResolveUrlsProgress(result.job_id)
      } else {
        alert(result.error || 'Error al iniciar resolución de URLs')
      }
    } catch (error) {
      console.error('Error starting URL resolution:', error)
      alert('Error al iniciar resolución de URLs')
    }
  }

  // Poll for resolve URLs progress
  const pollResolveUrlsProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/channels/bulk-import/${jobId}`)
        const progress = await response.json()
        setResolveUrlsProgress(progress)

        if (progress.status === 'running') {
          setTimeout(poll, 2000)
        } else {
          fetchChannels()
          fetchStats()
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }
    poll()
  }

  // Cancel resolve URLs
  const cancelResolveUrls = async () => {
    if (!resolveUrlsJobId) return
    try {
      await fetch(`${apiUrl}/api/channels/bulk-import/${resolveUrlsJobId}/cancel`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error cancelling:', error)
    }
  }

  // Close resolve URLs modal
  const closeResolveUrlsModal = () => {
    setShowResolveUrlsModal(false)
    setResolveUrlsJobId(null)
    setResolveUrlsProgress(null)
  }

  // Group channels by theme for grid view
  const channelsByTheme = useMemo(() => {
    const grouped: Record<string, CuratedChannel[]> = {}
    channels.forEach(ch => {
      const theme = ch.theme_name || 'Sin tema'
      if (!grouped[theme]) grouped[theme] = []
      grouped[theme].push(ch)
    })
    return grouped
  }, [channels])

  // Calculate total subscribers per theme
  const subscribersByTheme = useMemo(() => {
    const result: Record<string, number> = {}
    channels.forEach(ch => {
      const theme = ch.theme_name || 'Sin tema'
      if (!result[theme]) result[theme] = 0
      result[theme] += ch.subscriber_count || 0
    })
    return result
  }, [channels])

  // Total subscribers across all channels
  const totalSubscribers = useMemo(() => {
    return channels.reduce((sum, ch) => sum + (ch.subscriber_count || 0), 0)
  }, [channels])

  // Initialize collapsed state when themes change
  useEffect(() => {
    if (allCollapsed) {
      setCollapsedThemes(new Set(Object.keys(channelsByTheme)))
    }
  }, [Object.keys(channelsByTheme).join(',')])

  const toggleThemeCollapse = (themeName: string) => {
    setCollapsedThemes(prev => {
      const next = new Set(prev)
      if (next.has(themeName)) {
        next.delete(themeName)
      } else {
        next.add(themeName)
      }
      return next
    })
  }

  const toggleAllCollapsed = () => {
    if (allCollapsed) {
      // Expand all
      setCollapsedThemes(new Set())
      setAllCollapsed(false)
    } else {
      // Collapse all
      setCollapsedThemes(new Set(Object.keys(channelsByTheme)))
      setAllCollapsed(true)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canales Curados</h1>
          <p className="text-gray-500 mt-1">
            {total} canales organizados por temática y clasificación
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddUrlModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Añadir canal
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Importar Excel
          </button>
          <button
            onClick={() => startBulkFavoritesImport(10, 30)}
            disabled={bulkFavoritesJobId !== null}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            title="Importa 10 videos de cada canal favorito con 30s de delay"
          >
            <Star className="w-4 h-4" />
            Importar Favoritos
          </button>
          <button
            onClick={() => startUpdateSubscribers(true)}
            disabled={updateSubsJobId !== null}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            title="Actualiza el número de suscriptores de canales sin datos"
          >
            <Users className="w-4 h-4" />
            Actualizar Subs
          </button>
          <button
            onClick={startResolveUrls}
            disabled={resolveUrlsJobId !== null}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            title="Resuelve URLs de búsqueda a URLs reales de canal"
          >
            <Link className="w-4 h-4" />
            Resolver URLs
          </button>
          <a
            href={`${apiUrl}/api/channels/export`}
            download="canales_curados.csv"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </a>
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-lg border hover:bg-gray-50"
          >
            {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {(selectedChannelIds.size > 0 || bulkImporting || bulkImportProgress) && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          {bulkImporting || bulkImportProgress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-indigo-800">
                    Importando... {bulkImportProgress?.current}/{bulkImportProgress?.total} canales
                  </span>
                </div>
                {!bulkImporting && (
                  <button
                    onClick={() => setBulkImportProgress(null)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {bulkImportProgress && bulkImportProgress.results.length > 0 && (
                <div className="text-sm text-indigo-700 max-h-32 overflow-y-auto">
                  {bulkImportProgress.results.map((r, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{r.name}</span>
                      <span>{r.imported} videos {r.transcripts > 0 && `(${r.transcripts} transcripts)`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-indigo-800 font-medium">
                  {selectedChannelIds.size} canal{selectedChannelIds.size !== 1 ? 'es' : ''} seleccionado{selectedChannelIds.size !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {selectedChannelIds.size === channels.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
                <button
                  onClick={() => setSelectedChannelIds(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Limpiar selección
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowBulkImportMenu(!showBulkImportMenu)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Download className="w-4 h-4" />
                    Importar videos
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showBulkImportMenu && (
                    <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                      {VIDEO_IMPORT_OPTIONS.map(num => (
                        <button
                          key={num}
                          onClick={() => handleBulkImport(num)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 text-gray-700"
                        >
                          {num} videos c/u
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-800">
              Importados: <strong>{importResult.imported}</strong> canales
              {importResult.skipped > 0 && ` (${importResult.skipped} omitidos)`}
            </span>
          </div>
          <button onClick={() => setImportResult(null)}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Video Import Result */}
      {videoImportResult && (
        <div className={`p-4 border rounded-lg flex items-center justify-between ${
          videoImportResult.success ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <Video className={`w-5 h-5 ${videoImportResult.success ? 'text-blue-600' : 'text-red-600'}`} />
            <span className={videoImportResult.success ? 'text-blue-800' : 'text-red-800'}>
              <strong>{videoImportResult.channelName}</strong>: {videoImportResult.imported} videos importados
              {videoImportResult.transcripts_found > 0 && ` (${videoImportResult.transcripts_found} con transcript)`}
              {videoImportResult.skipped > 0 && `, ${videoImportResult.skipped} ya existían`}
            </span>
          </div>
          <button onClick={() => setVideoImportResult(null)}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Stats Panel */}
      {stats && (
        <div className="bg-white rounded-lg border shadow-sm">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Estadísticas</span>
            </div>
            {showStats ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showStats && (
            <div className="p-4 pt-0 border-t">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.total_channels}</p>
                  <p className="text-xs text-gray-500">Total Canales</p>
                </div>
                <div className="text-center p-3 bg-teal-50 rounded-lg">
                  <p className="text-2xl font-bold text-teal-600">{formatSubscribers(totalSubscribers)}</p>
                  <p className="text-xs text-gray-500">Total Suscriptores</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.resolved_channels}</p>
                  <p className="text-xs text-gray-500">Resueltos</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.total_channels - stats.resolved_channels}
                  </p>
                  <p className="text-xs text-gray-500">Pendientes</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {Object.keys(stats.by_theme).length}
                  </p>
                  <p className="text-xs text-gray-500">Temas</p>
                </div>
              </div>

              {/* By Level */}
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs text-gray-500 w-16">Nivel:</span>
                {Object.entries(stats.by_level).map(([level, count]) => (
                  <span
                    key={level}
                    className={`text-xs px-2 py-1 rounded ${LEVEL_COLORS[level]}`}
                  >
                    {LEVEL_LABELS[level]}: {count}
                  </span>
                ))}
              </div>

              {/* By Energy */}
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs text-gray-500 w-16">Energía:</span>
                {Object.entries(stats.by_energy).map(([energy, count]) => (
                  <span
                    key={energy}
                    className={`text-xs px-2 py-1 rounded ${ENERGY_COLORS[energy]}`}
                  >
                    {ENERGY_LABELS[energy]}: {count}
                  </span>
                ))}
              </div>

              {/* By Use Type */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 w-16">Uso:</span>
                {Object.entries(stats.by_use_type).map(([useType, count]) => {
                  const Icon = USE_TYPE_ICONS[useType] || BookOpen
                  return (
                    <span
                      key={useType}
                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3" />
                      {USE_TYPE_LABELS[useType]}: {count}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium">Filtros</span>
            {hasActiveFilters && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Activos
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showFilters && (
          <div className="p-4 pt-0 border-t space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar canal..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Theme filter */}
              <select
                value={selectedTheme || ''}
                onChange={(e) => setSelectedTheme(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los temas</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>

              {/* Level filter */}
              <select
                value={selectedLevel || ''}
                onChange={(e) => setSelectedLevel(e.target.value || null)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los niveles</option>
                <option value="intro">Intro</option>
                <option value="medio">Medio</option>
                <option value="avanzado">Avanzado</option>
              </select>

              {/* Energy filter */}
              <select
                value={selectedEnergy || ''}
                onChange={(e) => setSelectedEnergy(e.target.value || null)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las energías</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>

              {/* Use Type filter */}
              <select
                value={selectedUseType || ''}
                onChange={(e) => setSelectedUseType(e.target.value || null)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los usos</option>
                <option value="estudio">Estudio</option>
                <option value="inspiracion">Inspiración</option>
                <option value="ocio">Ocio</option>
                <option value="espiritual">Espiritual</option>
              </select>

              {/* Resolved filter */}
              <select
                value={onlyResolved === null ? '' : onlyResolved.toString()}
                onChange={(e) => setOnlyResolved(e.target.value === '' ? null : e.target.value === 'true')}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Solo resueltos</option>
                <option value="false">Solo pendientes</option>
              </select>

              {/* Favorites filter */}
              <button
                onClick={() => setOnlyFavorites(onlyFavorites === true ? null : true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  onlyFavorites === true
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : 'bg-white hover:bg-yellow-50 border-gray-300'
                }`}
              >
                <Star className={`w-4 h-4 ${onlyFavorites === true ? 'fill-yellow-500' : ''}`} />
                Favoritos
              </button>

              {/* Tag filter */}
              {availableTags.length > 0 && (
                <select
                  value={selectedTagId || ''}
                  onChange={(e) => setSelectedTagId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Todas las etiquetas</option>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              )}

              {/* Manage tags button */}
              <button
                onClick={() => setShowTagsModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                title="Gestionar etiquetas"
              >
                <Tag className="w-4 h-4" />
                Etiquetas
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Channels Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Youtube className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay canales</h3>
          <p className="text-gray-500 mb-4">
            Importa canales desde el Excel para comenzar
          </p>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Importar Excel
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tema</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Subs</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nivel</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Energía</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Uso</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channels.map(channel => {
                const UseIcon = USE_TYPE_ICONS[channel.use_type] || BookOpen
                return (
                  <tr key={channel.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleFavorite(channel.id)}
                          className="p-1 hover:bg-yellow-100 rounded transition-colors"
                        >
                          <Star className={`w-4 h-4 ${channel.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`} />
                        </button>
                        <Youtube className="w-4 h-4 text-red-600" />
                        <span className="font-medium">{channel.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {channel.theme_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {channel.subscriber_count ? formatSubscribers(channel.subscriber_count) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${LEVEL_COLORS[channel.level]}`}>
                        {LEVEL_LABELS[channel.level]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${ENERGY_COLORS[channel.energy]}`}>
                        {ENERGY_LABELS[channel.energy]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                        <UseIcon className="w-3 h-3" />
                        {USE_TYPE_LABELS[channel.use_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {channel.is_resolved ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-xs text-gray-400">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setShowImportMenu(showImportMenu === channel.id ? null : channel.id)}
                            disabled={importingChannelId === channel.id}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            {importingChannelId === channel.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            {channel.total_videos_imported > 0 ? `${channel.total_videos_imported}` : 'Importar'}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {showImportMenu === channel.id && (
                            <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                              {VIDEO_IMPORT_OPTIONS.map(num => (
                                <button
                                  key={num}
                                  onClick={() => {
                                    setShowImportMenu(null)
                                    handleImportVideos(channel, num)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700"
                                >
                                  {num} videos
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {(channel.youtube_channel_url || channel.youtube_url || channel.youtube_channel_id) && (
                          <a
                            href={channel.youtube_channel_url || channel.youtube_url || `https://www.youtube.com/channel/${channel.youtube_channel_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View - Grouped by Theme */
        <div className="space-y-4">
          {/* Expand/Collapse All Button */}
          <div className="flex justify-end">
            <button
              onClick={toggleAllCollapsed}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {allCollapsed ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expandir todos
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Colapsar todos
                </>
              )}
            </button>
          </div>
          {Object.entries(channelsByTheme)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([themeName, themeChannels]) => {
              const isCollapsed = collapsedThemes.has(themeName)
              return (
              <div key={themeName} className="bg-white rounded-lg border shadow-sm">
                <div
                  className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleThemeCollapse(themeName)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectTheme(themeName)
                      }}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        themeChannels.every(ch => selectedChannelIds.has(ch.id))
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : themeChannels.some(ch => selectedChannelIds.has(ch.id))
                          ? 'bg-indigo-200 border-indigo-400'
                          : 'border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {themeChannels.every(ch => selectedChannelIds.has(ch.id)) && (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    )}
                    <h3 className="font-medium text-gray-900">{themeName}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {subscribersByTheme[themeName] > 0 && (
                      <span className="flex items-center gap-1 text-teal-600">
                        <Users className="w-3 h-3" />
                        {formatSubscribers(subscribersByTheme[themeName])}
                      </span>
                    )}
                    <span>{themeChannels.length} canales</span>
                  </div>
                </div>
                {!isCollapsed && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-visible">
                  {themeChannels.map(channel => {
                    const UseIcon = USE_TYPE_ICONS[channel.use_type] || BookOpen
                    const isSelected = selectedChannelIds.has(channel.id)
                    return (
                      <div
                        key={channel.id}
                        className={`p-3 border rounded-lg hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden ${
                          isSelected ? 'border-indigo-400 bg-indigo-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <button
                            onClick={() => setSelectedChannelIds(prev => {
                              const next = new Set(prev)
                              if (next.has(channel.id)) next.delete(channel.id)
                              else next.add(channel.id)
                              return next
                            })}
                            className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-gray-300 hover:border-indigo-400'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </button>
                          <Youtube className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium text-sm truncate block" title={channel.name}>
                                {channel.name}
                              </span>
                              {(channel.youtube_channel_url || channel.youtube_url || channel.youtube_channel_id) && (
                                <a
                                  href={channel.youtube_channel_url || channel.youtube_url || `https://www.youtube.com/channel/${channel.youtube_channel_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {channel.subscriber_count && (
                              <span className="text-xs text-gray-500">{formatSubscribers(channel.subscriber_count)} subs</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_COLORS[channel.level]}`}>
                            {LEVEL_LABELS[channel.level]}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ENERGY_COLORS[channel.energy]}`}>
                            {ENERGY_LABELS[channel.energy]}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex items-center gap-0.5">
                            <UseIcon className="w-2.5 h-2.5" />
                            {USE_TYPE_LABELS[channel.use_type]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          {channel.is_resolved ? (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <Check className="w-3 h-3" />
                              Resuelto
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">Pendiente</div>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleFavorite(channel.id)}
                              className="p-1 hover:bg-yellow-100 rounded transition-colors"
                              title="Favorito"
                            >
                              <Star className={`w-3 h-3 ${channel.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingTagsForChannel(channel)
                                fetchChannelTags(channel.id)
                              }}
                              className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Gestionar etiquetas"
                            >
                              <Tag className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingChannel(channel)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Cambiar tema"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeletingChannel(channel)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar canal"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setShowImportMenu(showImportMenu === channel.id ? null : channel.id)}
                                disabled={importingChannelId === channel.id}
                                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                              >
                                {importingChannelId === channel.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                {channel.total_videos_imported > 0 ? channel.total_videos_imported : 'Importar'}
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              {showImportMenu === channel.id && (
                                <div className="fixed bg-white border rounded-lg shadow-xl z-[100] py-1 min-w-[100px]" style={{ marginTop: '-120px' }}>
                                  {VIDEO_IMPORT_OPTIONS.map(num => (
                                    <button
                                      key={num}
                                      onClick={() => {
                                        setShowImportMenu(null)
                                        handleImportVideos(channel, num)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700"
                                    >
                                      {num} videos
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )})}
        </div>
      )}

      {/* Modal: Add Channel by URL */}
      {showAddUrlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Link className="w-5 h-5 text-blue-600" />
                Añadir canal por URL
              </h3>
              <button onClick={() => setShowAddUrlModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Introduce la URL del canal de YouTube. Se añadirá a la temática "Suscripciones".
            </p>
            <input
              type="text"
              value={addUrlInput}
              onChange={(e) => setAddUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/@canal o /channel/..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleAddByUrl()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddUrlModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddByUrl}
                disabled={addUrlLoading || !addUrlInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Channel Theme */}
      {editingChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Cambiar temática
              </h3>
              <button onClick={() => setEditingChannel(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Canal: <strong>{editingChannel.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Temática actual: {editingChannel.theme_name || 'Sin tema'}
            </p>
            <select
              defaultValue={editingChannel.theme_id || ''}
              onChange={(e) => handleUpdateTheme(editingChannel.id, e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="">Sin tema</option>
              {themes.map(theme => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingChannel(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Channel Confirmation */}
      {deletingChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Eliminar canal
              </h3>
              <button onClick={() => setDeletingChannel(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-2">
              ¿Estás seguro de que quieres eliminar el canal?
            </p>
            <p className="text-lg font-medium mb-4">{deletingChannel.name}</p>
            {deletingChannel.total_videos_imported > 0 && (
              <p className="text-sm text-orange-600 mb-4">
                Este canal tiene {deletingChannel.total_videos_imported} videos importados.
                Los videos no se eliminarán.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingChannel(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteChannel(deletingChannel.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import Favorites Progress */}
      {showBulkFavoritesModal && bulkFavoritesProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-600" />
                Importando Favoritos
              </h3>
              {bulkFavoritesProgress.status === 'completed' || bulkFavoritesProgress.status === 'cancelled' ? (
                <button onClick={closeBulkFavoritesModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>
                  {bulkFavoritesProgress.status === 'running' ? (
                    <>Procesando: {bulkFavoritesProgress.current_channel || '...'}</>
                  ) : bulkFavoritesProgress.status === 'completed' ? (
                    'Completado'
                  ) : (
                    'Cancelado'
                  )}
                </span>
                <span>{bulkFavoritesProgress.processed_channels} / {bulkFavoritesProgress.total_channels}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    bulkFavoritesProgress.status === 'completed' ? 'bg-green-500' :
                    bulkFavoritesProgress.status === 'cancelled' ? 'bg-orange-500' :
                    'bg-purple-500'
                  }`}
                  style={{ width: `${(bulkFavoritesProgress.processed_channels / bulkFavoritesProgress.total_channels) * 100}%` }}
                />
              </div>
            </div>

            {/* Results list */}
            {bulkFavoritesProgress.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto mb-4 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Canal</th>
                      <th className="text-center px-2 py-2">Videos</th>
                      <th className="text-center px-2 py-2">Transcr.</th>
                      <th className="text-center px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bulkFavoritesProgress.results.map((r, i) => (
                      <tr key={i} className={r.success ? '' : 'bg-red-50'}>
                        <td className="px-3 py-1.5 truncate max-w-[180px]" title={r.channel}>{r.channel}</td>
                        <td className="text-center px-2 py-1.5">{r.imported}</td>
                        <td className="text-center px-2 py-1.5">{r.transcripts}</td>
                        <td className="text-center px-2 py-1.5">
                          {r.success ? (
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-red-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Errors */}
            {bulkFavoritesProgress.errors.length > 0 && (
              <div className="text-sm text-red-600 mb-4 max-h-20 overflow-y-auto">
                {bulkFavoritesProgress.errors.slice(0, 5).map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {/* Summary */}
            {bulkFavoritesProgress.status !== 'running' && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {bulkFavoritesProgress.results.reduce((sum, r) => sum + r.imported, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Videos importados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {bulkFavoritesProgress.results.reduce((sum, r) => sum + r.transcripts, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Transcripciones</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {bulkFavoritesProgress.results.filter(r => r.success).length}
                    </div>
                    <div className="text-xs text-gray-500">Canales OK</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {bulkFavoritesProgress.status === 'running' ? (
                <button
                  onClick={cancelBulkFavoritesImport}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={closeBulkFavoritesModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Subscribers Progress */}
      {showUpdateSubsModal && updateSubsProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Actualizando Suscriptores
              </h3>
              {updateSubsProgress.status === 'completed' || updateSubsProgress.status === 'cancelled' ? (
                <button onClick={closeUpdateSubsModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>
                  {updateSubsProgress.status === 'running' ? (
                    <>Procesando: {updateSubsProgress.current_channel || '...'}</>
                  ) : updateSubsProgress.status === 'completed' ? (
                    'Completado'
                  ) : (
                    'Cancelado'
                  )}
                </span>
                <span>{updateSubsProgress.processed_channels} / {updateSubsProgress.total_channels}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    updateSubsProgress.status === 'completed' ? 'bg-green-500' :
                    updateSubsProgress.status === 'cancelled' ? 'bg-orange-500' :
                    'bg-teal-500'
                  }`}
                  style={{ width: `${(updateSubsProgress.processed_channels / updateSubsProgress.total_channels) * 100}%` }}
                />
              </div>
            </div>

            {/* Results list */}
            {updateSubsProgress.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto mb-4 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Canal</th>
                      <th className="text-center px-2 py-2">Suscriptores</th>
                      <th className="text-center px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {updateSubsProgress.results.map((r, i) => (
                      <tr key={i} className={r.success ? '' : 'bg-red-50'}>
                        <td className="px-3 py-1.5 truncate max-w-[200px]" title={r.channel}>{r.channel}</td>
                        <td className="text-center px-2 py-1.5">
                          {r.success ? formatSubscribers(r.subscribers) : '-'}
                        </td>
                        <td className="text-center px-2 py-1.5">
                          {r.success ? (
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-red-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {updateSubsProgress.status !== 'running' && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-teal-600">
                      {formatSubscribers(updateSubsProgress.results.filter(r => r.success).reduce((sum, r) => sum + r.subscribers, 0))}
                    </div>
                    <div className="text-xs text-gray-500">Total Suscriptores</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {updateSubsProgress.results.filter(r => r.success).length}
                    </div>
                    <div className="text-xs text-gray-500">Canales Actualizados</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {updateSubsProgress.status === 'running' ? (
                <button
                  onClick={cancelUpdateSubs}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={closeUpdateSubsModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manage Tags */}
      {showTagsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                Gestionar Etiquetas
              </h3>
              <button onClick={() => setShowTagsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create new tag */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nombre de etiqueta..."
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-10 h-10 rounded-lg border cursor-pointer"
                title="Color de etiqueta"
              />
              <button
                onClick={createTag}
                disabled={!newTagName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tags list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay etiquetas creadas</p>
              ) : (
                availableTags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar etiqueta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTagsModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Tags to Channel */}
      {editingTagsForChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                Etiquetas del canal
              </h3>
              <button onClick={() => setEditingTagsForChannel(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Canal: <strong>{editingTagsForChannel.name}</strong>
            </p>

            {/* Current tags */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Etiquetas asignadas:</p>
              <div className="flex flex-wrap gap-2">
                {(channelTags[editingTagsForChannel.id] || []).length === 0 ? (
                  <span className="text-gray-400 text-sm">Sin etiquetas</span>
                ) : (
                  (channelTags[editingTagsForChannel.id] || []).map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => removeTagFromChannel(editingTagsForChannel.id, tag.id)}
                        className="hover:bg-black/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Available tags to add */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Añadir etiqueta:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter(tag => !(channelTags[editingTagsForChannel.id] || []).some(ct => ct.id === tag.id))
                  .map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => assignTagToChannel(editingTagsForChannel.id, tag.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border-2 hover:opacity-80"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      <Plus className="w-3 h-3" />
                      {tag.name}
                    </button>
                  ))}
                {availableTags.filter(tag => !(channelTags[editingTagsForChannel.id] || []).some(ct => ct.id === tag.id)).length === 0 && (
                  <span className="text-gray-400 text-sm">Todas las etiquetas ya asignadas</span>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setEditingTagsForChannel(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resolve Search URLs Progress */}
      {showResolveUrlsModal && resolveUrlsProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Link className="w-5 h-5 text-purple-600" />
                Resolviendo URLs de Búsqueda
              </h3>
              {resolveUrlsProgress.status === 'completed' || resolveUrlsProgress.status === 'cancelled' ? (
                <button onClick={closeResolveUrlsModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>
                  {resolveUrlsProgress.status === 'running' ? (
                    <>Procesando: {resolveUrlsProgress.current_channel || '...'}</>
                  ) : resolveUrlsProgress.status === 'completed' ? (
                    'Completado'
                  ) : (
                    'Cancelado'
                  )}
                </span>
                <span>{resolveUrlsProgress.processed_channels} / {resolveUrlsProgress.total_channels}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    resolveUrlsProgress.status === 'completed' ? 'bg-green-500' :
                    resolveUrlsProgress.status === 'cancelled' ? 'bg-orange-500' :
                    'bg-purple-500'
                  }`}
                  style={{ width: `${(resolveUrlsProgress.processed_channels / resolveUrlsProgress.total_channels) * 100}%` }}
                />
              </div>
            </div>

            {/* Results list */}
            {resolveUrlsProgress.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto mb-4 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Canal</th>
                      <th className="text-left px-2 py-2">Resuelto a</th>
                      <th className="text-center px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resolveUrlsProgress.results.map((r, i) => (
                      <tr key={i} className={r.success ? '' : 'bg-red-50'}>
                        <td className="px-3 py-1.5 truncate max-w-[150px]" title={r.channel}>{r.channel}</td>
                        <td className="px-2 py-1.5 truncate max-w-[150px] text-gray-600" title={r.resolved_to || ''}>
                          {r.success ? r.resolved_to : '-'}
                        </td>
                        <td className="text-center px-2 py-1.5">
                          {r.success ? (
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-red-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {resolveUrlsProgress.status !== 'running' && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {resolveUrlsProgress.results.filter(r => r.success).length}
                    </div>
                    <div className="text-xs text-gray-500">URLs Resueltas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {resolveUrlsProgress.results.filter(r => !r.success).length}
                    </div>
                    <div className="text-xs text-gray-500">Fallidas</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {resolveUrlsProgress.status === 'running' ? (
                <button
                  onClick={cancelResolveUrls}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={closeResolveUrlsModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
