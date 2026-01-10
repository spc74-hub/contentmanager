import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVideos, useCategories, useAuthors, useTags, useSearchTags, useSubcategories, useAreas, useTopics, useToggleFavoriteVideo, useCuratedChannels, type VideoWithArea } from '@/hooks'
import { Search, Filter, Eye, User, Grid, List, SortAsc, SortDesc, X, Play, Inbox, Tag, Hash, Loader2, Sparkles, Star, Heart, Clock, Calendar, Tv, Trash2, CheckSquare, Square } from 'lucide-react'
import type { VideoFilters, Category, Area, Topic } from '@/types'
import { VIDEO_SOURCES } from '@/types'
import type { Tag as TagType, Subcategory } from '@/hooks/useTags'
import { VideoDetailModal } from '@/components/VideoDetailModal'

type ViewMode = 'grid' | 'list'

export function Videos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const authorFromUrl = searchParams.get('author')

  const [filters, setFilters] = useState<VideoFilters>(() => ({
    author: authorFromUrl || undefined
  }))
  const [searchInput, setSearchInput] = useState('')

  // Sync URL params to filters
  useEffect(() => {
    if (authorFromUrl && filters.author !== authorFromUrl) {
      setFilters(f => ({ ...f, author: authorFromUrl }))
    }
  }, [authorFromUrl])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(true)
  const [showTags, setShowTags] = useState(false)
  const [tagSearchInput, setTagSearchInput] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<VideoWithArea | null>(null)
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, searchTerm: searchInput || undefined }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useVideos(filters)

  // Flatten paginated data
  const videos = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? []
  }, [data])

  const totalCount = data?.pages[0]?.count ?? 0

  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px'
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [handleObserver])
  const { data: categories } = useCategories()
  const { data: authors } = useAuthors()
  const { data: tags } = useTags(50) // Top 50 tags
  const { data: searchedTags, isLoading: isSearchingTags } = useSearchTags(tagSearchInput)
  const { data: subcategories } = useSubcategories(filters.categoryId)
  const { data: areas } = useAreas()
  const { data: topics } = useTopics(filters.areaId)
  const { data: curatedChannels } = useCuratedChannels(false) // Get all channels
  const toggleFavorite = useToggleFavoriteVideo()

  const filteredAndSortedVideos = useMemo(() => {
    if (!videos) return []
    let result = [...videos]

    // Duration filter (in seconds)
    if (filters.durationRange) {
      result = result.filter(v => {
        const mins = v.duration / 60
        switch (filters.durationRange) {
          case '0-5': return mins < 5
          case '5-15': return mins >= 5 && mins < 15
          case '15-30': return mins >= 15 && mins < 30
          case '30-60': return mins >= 30 && mins < 60
          case '60+': return mins >= 60
          default: return true
        }
      })
    }

    // Views filter
    if (filters.viewsRange) {
      result = result.filter(v => {
        switch (filters.viewsRange) {
          case '0-10k': return v.view_count < 10000
          case '10k-100k': return v.view_count >= 10000 && v.view_count < 100000
          case '100k-1m': return v.view_count >= 100000 && v.view_count < 1000000
          case '1m+': return v.view_count >= 1000000
          default: return true
        }
      })
    }

    // Sorting
    if (filters.sortBy) {
      const order = filters.sortOrder === 'asc' ? 1 : -1
      result.sort((a, b) => {
        switch (filters.sortBy) {
          case 'views': return (a.view_count - b.view_count) * order
          case 'duration': return (a.duration - b.duration) * order
          case 'title': return a.title.localeCompare(b.title) * order
          case 'published': {
            // Handle null upload_date - push to end
            const dateA = a.upload_date ? new Date(a.upload_date).getTime() : 0
            const dateB = b.upload_date ? new Date(b.upload_date).getTime() : 0
            if (!a.upload_date && !b.upload_date) return 0
            if (!a.upload_date) return 1  // a goes to end
            if (!b.upload_date) return -1 // b goes to end
            return (dateB - dateA) * order
          }
          case 'recent':
          default: return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) * order
        }
      })
    }

    return result
  }, [videos, filters.durationRange, filters.viewsRange, filters.sortBy, filters.sortOrder])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) return `${mins}:${secs.toString().padStart(2, '0')}`
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hours}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const clearFilters = () => {
    setFilters({})
    setSearchInput('')
    setShowTags(false)
    // Clear URL params
    setSearchParams({})
  }

  // Selection functions
  const toggleVideoSelection = (videoId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedVideoIds(prev => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedVideoIds(new Set(filteredAndSortedVideos.map(v => v.id)))
  }

  const clearSelection = () => {
    setSelectedVideoIds(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedVideoIds.size === 0) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${apiUrl}/api/videos/delete-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(selectedVideoIds))
      })
      if (response.ok) {
        // Refresh the page to reload videos
        window.location.reload()
      }
    } catch (error) {
      console.error('Error deleting videos:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setSelectedVideoIds(new Set())
    }
  }

  const getTagById = (id: number) => tags?.find((t: TagType) => t.id === id)
  const getSubcategoryById = (id: number) => subcategories?.find((s: Subcategory) => s.id === id)
  const getAreaById = (id: number) => areas?.find((a: Area) => a.id === id)
  const getTopicById = (id: number) => topics?.find((t: Topic) => t.id === id)

  // Count active filters (exclude searchTerm since we track searchInput separately)
  const activeFiltersCount = Object.entries(filters)
    .filter(([key, val]) => key !== 'searchTerm' && Boolean(val))
    .length + (searchInput ? 1 : 0)

  const getCategoryById = (id: number) => categories?.find((c: Category) => c.id === id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Videos</h1>
          <p className="text-gray-500">
            {filteredAndSortedVideos.length} de {totalCount} videos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              title="Vista de cuadrícula"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              title="Vista de lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedVideoIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-blue-800 font-medium">
              {selectedVideoIds.size} video{selectedVideoIds.size > 1 ? 's' : ''} seleccionado{selectedVideoIds.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={selectAllVisible}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Seleccionar todos ({filteredAndSortedVideos.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Deseleccionar
            </button>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar seleccionados
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que quieres eliminar {selectedVideoIds.size} video{selectedVideoIds.size > 1 ? 's' : ''}? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título, autor..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>

            {/* Area (new taxonomy) */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.areaId || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, areaId: e.target.value ? Number(e.target.value) : undefined, topicId: undefined }))}
            >
              <option value="">Todas las áreas</option>
              {areas?.map((area: Area) => (
                <option key={area.id} value={area.id}>{area.icon} {area.name_es} ({area.video_count})</option>
              ))}
            </select>

            {/* Topic (new taxonomy - filtered by selected area) */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.topicId || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, topicId: e.target.value ? Number(e.target.value) : undefined }))}
              disabled={!filters.areaId}
            >
              <option value="">{filters.areaId ? 'Todos los topics' : 'Selecciona área primero'}</option>
              {topics?.map((topic: Topic) => (
                <option key={topic.id} value={topic.id}>{topic.name_es} ({topic.video_count})</option>
              ))}
            </select>

            {/* Author */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.author || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, author: e.target.value || undefined }))}
            >
              <option value="">Todos los autores</option>
              {authors?.map((author: string) => (
                <option key={author} value={author}>{author}</option>
              ))}
            </select>

            {/* Source */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.source || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, source: e.target.value || undefined }))}
            >
              <option value="">Todas las fuentes</option>
              {Object.entries(VIDEO_SOURCES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Channel Theme Filter */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.channelTheme || ''}
              onChange={e => setFilters((f: VideoFilters) => ({
                ...f,
                channelTheme: e.target.value || undefined,
                curatedChannelId: undefined // Reset channel when theme changes
              }))}
            >
              <option value="">Todas las temáticas</option>
              {curatedChannels && [...new Set(curatedChannels.filter(ch => ch.total_videos_imported > 0 && ch.theme_name).map(ch => ch.theme_name))]
                .sort()
                .map(theme => (
                  <option key={theme} value={theme!}>{theme}</option>
                ))
              }
            </select>

            {/* Curated Channel */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.curatedChannelId || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, curatedChannelId: e.target.value ? Number(e.target.value) : undefined }))}
            >
              <option value="">Todos los canales</option>
              {curatedChannels && curatedChannels
                .filter(ch => ch.total_videos_imported > 0)
                .filter(ch => !filters.channelTheme || ch.theme_name === filters.channelTheme)
                .map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name} ({ch.total_videos_imported})</option>
                ))
              }
            </select>

            {/* Duration */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.durationRange || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, durationRange: e.target.value || undefined }))}
            >
              <option value="">Cualquier duración</option>
              <option value="0-5">Menos de 5 min</option>
              <option value="5-15">5-15 min</option>
              <option value="15-30">15-30 min</option>
              <option value="30-60">30-60 min</option>
              <option value="60+">Más de 1 hora</option>
            </select>

            {/* Views */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.viewsRange || ''}
              onChange={e => setFilters((f: VideoFilters) => ({ ...f, viewsRange: e.target.value || undefined }))}
            >
              <option value="">Cualquier visitas</option>
              <option value="0-10k">Menos de 10K</option>
              <option value="10k-100k">10K - 100K</option>
              <option value="100k-1m">100K - 1M</option>
              <option value="1m+">Más de 1M</option>
            </select>
          </div>

          {/* Second row - AI Status filter + Favorites */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-600">Estado IA:</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters((f: VideoFilters) => ({ ...f, aiStatus: undefined }))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    !filters.aiStatus ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilters((f: VideoFilters) => ({ ...f, aiStatus: 'processed' }))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    filters.aiStatus === 'processed' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Procesados
                </button>
                <button
                  onClick={() => setFilters((f: VideoFilters) => ({ ...f, aiStatus: 'pending' }))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    filters.aiStatus === 'pending' ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Pendientes
                </button>
              </div>
            </div>

            {/* Favorites filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters((f: VideoFilters) => ({ ...f, isFavorite: f.isFavorite ? undefined : true }))}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filters.isFavorite ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Star className={`w-4 h-4 ${filters.isFavorite ? 'fill-yellow-500' : ''}`} />
                Solo favoritos
              </button>
            </div>
          </div>

          {/* Sort and Clear */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Ordenar por:</span>
              <select
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.sortBy || 'recent'}
                onChange={e => setFilters((f: VideoFilters) => ({ ...f, sortBy: e.target.value as VideoFilters['sortBy'] }))}
              >
                <option value="recent">Más recientes</option>
                <option value="published">Fecha publicación</option>
                <option value="views">Más vistas</option>
                <option value="duration">Duración</option>
                <option value="title">Título A-Z</option>
              </select>
              <button
                onClick={() => setFilters((f: VideoFilters) => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                title={filters.sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {filters.sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Tags */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.categoryId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
              {getCategoryById(filters.categoryId)?.icon} {getCategoryById(filters.categoryId)?.name}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, categoryId: undefined }))} className="ml-1 hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.author && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
              <User className="w-3 h-3" /> {filters.author}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, author: undefined }))} className="ml-1 hover:text-green-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchInput && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
              <Search className="w-3 h-3" /> "{searchInput}"
              <button onClick={() => setSearchInput('')} className="ml-1 hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.source && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm">
              <Inbox className="w-3 h-3" /> {VIDEO_SOURCES[filters.source as keyof typeof VIDEO_SOURCES]}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, source: undefined }))} className="ml-1 hover:text-orange-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.channelTheme && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm">
              <Tv className="w-3 h-3" /> Tema: {filters.channelTheme}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, channelTheme: undefined, curatedChannelId: undefined }))} className="ml-1 hover:text-violet-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.curatedChannelId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
              <Tv className="w-3 h-3" /> {curatedChannels?.find(ch => ch.id === filters.curatedChannelId)?.name}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, curatedChannelId: undefined }))} className="ml-1 hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.tagId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-sm">
              <Hash className="w-3 h-3" /> {getTagById(filters.tagId)?.name}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, tagId: undefined }))} className="ml-1 hover:text-cyan-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.subcategoryId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-sm">
              <Tag className="w-3 h-3" /> {getSubcategoryById(filters.subcategoryId)?.name}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, subcategoryId: undefined }))} className="ml-1 hover:text-pink-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.aiStatus && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              filters.aiStatus === 'processed' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              <Sparkles className="w-3 h-3" /> {filters.aiStatus === 'processed' ? 'Procesados' : 'Pendientes'}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, aiStatus: undefined }))} className="ml-1 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.areaId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
              {getAreaById(filters.areaId)?.icon} {getAreaById(filters.areaId)?.name_es}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, areaId: undefined, topicId: undefined }))} className="ml-1 hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.topicId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm">
              <Tag className="w-3 h-3" /> {getTopicById(filters.topicId)?.name_es}
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, topicId: undefined }))} className="ml-1 hover:text-violet-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.isFavorite && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm">
              <Star className="w-3 h-3 fill-yellow-500" /> Favoritos
              <button onClick={() => setFilters((f: VideoFilters) => ({ ...f, isFavorite: undefined }))} className="ml-1 hover:text-yellow-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Tags & Subcategories Section */}
      {showFilters && (tags?.length || subcategories?.length) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowTags(!showTags)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Hash className="w-4 h-4" />
              Tags y Subcategorías
              {showTags ? <X className="w-3 h-3" /> : <span className="text-xs text-gray-400">({tags?.length || 0} tags)</span>}
            </button>
          </div>

          {showTags && (
            <div className="space-y-4">
              {/* Subcategories (AI generated, cleaner) */}
              {subcategories && subcategories.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Subcategorías IA
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {subcategories.slice(0, 20).map((subcat: Subcategory) => (
                      <button
                        key={subcat.id}
                        onClick={() => setFilters(f => ({ ...f, subcategoryId: f.subcategoryId === subcat.id ? undefined : subcat.id }))}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          filters.subcategoryId === subcat.id
                            ? 'bg-pink-100 border-pink-300 text-pink-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {subcat.name}
                        <span className="ml-1 text-gray-400">({subcat.video_count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hashtag Search */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Buscar hashtag
                </h4>
                <div className="relative mb-3">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar hashtag... (mín. 2 caracteres)"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={tagSearchInput}
                    onChange={e => setTagSearchInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  />
                  {isSearchingTags && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>

                {/* Search Results */}
                {tagSearchInput.length >= 2 && searchedTags && searchedTags.length > 0 && (
                  <div className="mb-3 p-2 bg-cyan-50 rounded-lg">
                    <p className="text-xs text-cyan-700 mb-2">Resultados para "{tagSearchInput}":</p>
                    <div className="flex flex-wrap gap-2">
                      {searchedTags.map((tag: TagType) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setFilters(f => ({ ...f, tagId: tag.id }))
                            setTagSearchInput('')
                          }}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            filters.tagId === tag.id
                              ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                              : 'bg-white border-cyan-200 text-cyan-700 hover:bg-cyan-100'
                          }`}
                        >
                          #{tag.name}
                          <span className="ml-1 text-cyan-500">({tag.video_count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tagSearchInput.length >= 2 && searchedTags && searchedTags.length === 0 && !isSearchingTags && (
                  <p className="text-xs text-gray-400 mb-3">No se encontraron hashtags con "{tagSearchInput}"</p>
                )}
              </div>

              {/* Popular Tags */}
              {tags && tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags populares
                  </h4>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {tags.filter((t: TagType) => t.video_count > 0).slice(0, 30).map((tag: TagType) => (
                      <button
                        key={tag.id}
                        onClick={() => setFilters(f => ({ ...f, tagId: f.tagId === tag.id ? undefined : tag.id }))}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          filters.tagId === tag.id
                            ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        #{tag.name}
                        <span className="ml-1 text-gray-400">({tag.video_count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Videos Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedVideos.map(video => {
            const area = video.areas
            return (
              <article
                key={video.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Play className="w-12 h-12" />
                    </div>
                  )}
                  {/* Duration badge */}
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </span>
                  {/* Area badge (new taxonomy) */}
                  {area && (
                    <span
                      className="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: area.color }}
                    >
                      {area.icon} {area.name_es}
                    </span>
                  )}
                  {/* Selection checkbox */}
                  <div
                    className={`absolute top-2 right-10 p-1 rounded transition-all cursor-pointer ${
                      selectedVideoIds.has(video.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                    onClickCapture={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setSelectedVideoIds(prev => {
                        const next = new Set(prev)
                        if (next.has(video.id)) {
                          next.delete(video.id)
                        } else {
                          next.add(video.id)
                        }
                        return next
                      })
                    }}
                  >
                    {selectedVideoIds.has(video.id) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </div>
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite.mutate({ videoId: video.id, isFavorite: video.is_favorite })
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <Star className={`w-4 h-4 ${video.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                  </button>
                  {/* Play overlay */}
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                      <Play className="w-7 h-7 text-white ml-1" fill="white" />
                    </div>
                  </a>
                </div>
                {/* Info */}
                <div className="p-3 space-y-2">
                  <h3 className="font-medium text-gray-900 line-clamp-2 text-sm leading-tight">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    <span className="truncate">{video.author}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(video.view_count)}
                    </span>
                    {video.like_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {formatNumber(video.like_count)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(video.duration)}
                    </span>
                    {video.upload_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(video.upload_date)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filteredAndSortedVideos.map(video => {
            const area = video.areas
            return (
              <article
                key={video.id}
                className="flex gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail */}
                <div className="relative w-40 flex-shrink-0">
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    {video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Play className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 line-clamp-2 flex-1">
                      {video.title}
                    </h3>
                    {video.is_favorite && (
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {video.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {formatNumber(video.view_count)}
                    </span>
                    {video.like_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {formatNumber(video.like_count)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(video.duration)}
                    </span>
                    {video.upload_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(video.upload_date)}
                      </span>
                    )}
                    {area && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white"
                        style={{ backgroundColor: area.color }}
                      >
                        {area.icon} {area.name_es}
                      </span>
                    )}
                  </div>
                  {video.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2">{video.summary}</p>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => toggleVideoSelection(video.id, e)}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedVideoIds.has(video.id)
                        ? 'bg-blue-100 text-blue-600'
                        : 'hover:bg-gray-100 text-gray-400'
                    }`}
                  >
                    {selectedVideoIds.has(video.id) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite.mutate({ videoId: video.id, isFavorite: video.is_favorite })
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Star className={`w-5 h-5 ${video.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                  </button>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Ver
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {filteredAndSortedVideos.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-gray-500">No se encontraron videos con los filtros aplicados.</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando más videos...</span>
          </div>
        )}
        {!hasNextPage && videos.length > 0 && (
          <p className="text-sm text-gray-400">Has llegado al final</p>
        )}
      </div>

      {/* Video Detail Modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          category={getCategoryById(selectedVideo.category_id)}
          area={selectedVideo.areas}
          onClose={() => setSelectedVideo(null)}
          onToggleFavorite={() => toggleFavorite.mutate({ videoId: selectedVideo.id, isFavorite: selectedVideo.is_favorite })}
        />
      )}
    </div>
  )
}
