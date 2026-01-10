import { useState, useMemo } from 'react'
import { useAuthorsWithStats, useToggleFavoriteAuthor, useAreas, useTopics } from '@/hooks'
import { User, Eye, Video, Star, Search, X, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Area, AuthorWithStats, TopicWithArea } from '@/types'

type ClassificationFilter = 'all' | 'classified' | 'unclassified'

export function Authors() {
  const [areaFilter, setAreaFilter] = useState<number | undefined>(undefined)
  const [topicFilter, setTopicFilter] = useState<number | undefined>(undefined)
  const [searchInput, setSearchInput] = useState('')
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all')

  const { data: authors, isLoading } = useAuthorsWithStats({ areaId: areaFilter, topicId: topicFilter })
  const { data: areas } = useAreas()
  const { data: topics } = useTopics(areaFilter) // Only get topics for selected area
  const toggleFavorite = useToggleFavoriteAuthor()
  const navigate = useNavigate()

  const filteredAuthors = useMemo(() => {
    if (!authors) return []
    let result = [...authors]

    // Search filter
    if (searchInput) {
      const term = searchInput.toLowerCase()
      result = result.filter(a => a.author.toLowerCase().includes(term))
    }

    // Favorites filter
    if (showOnlyFavorites) {
      result = result.filter(a => a.is_favorite)
    }

    // Classification filter
    if (classificationFilter === 'classified') {
      result = result.filter(a => a.areas.length > 0)
    } else if (classificationFilter === 'unclassified') {
      result = result.filter(a => a.areas.length === 0)
    }

    return result
  }, [authors, searchInput, showOnlyFavorites, classificationFilter])

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getAreaPercentage = (author: AuthorWithStats, area: { count: number }) => {
    const total = author.areas.reduce((sum, a) => sum + a.count, 0)
    if (total === 0) return 0
    return Math.round((area.count / total) * 100)
  }

  const handleAuthorClick = (author: string) => {
    // Navigate to videos page with author filter
    navigate(`/videos?author=${encodeURIComponent(author)}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const totalAuthors = authors?.length ?? 0
  const authorsWithArea = authors?.filter(a => a.areas.length > 0).length ?? 0
  const favoriteCount = authors?.filter(a => a.is_favorite).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Autores</h1>
          <p className="text-gray-500">
            {filteredAuthors.length} de {totalAuthors} autores
            <span className="mx-2">|</span>
            {authorsWithArea} con área clasificada
            {favoriteCount > 0 && (
              <>
                <span className="mx-2">|</span>
                <Star className="w-3 h-3 inline text-yellow-500 fill-yellow-500" /> {favoriteCount} favoritos
              </>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar autor..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {/* Area filter */}
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={areaFilter || ''}
            onChange={e => {
              const newArea = e.target.value ? Number(e.target.value) : undefined
              setAreaFilter(newArea)
              // Clear topic when area changes
              if (newArea !== areaFilter) {
                setTopicFilter(undefined)
              }
            }}
          >
            <option value="">Todas las áreas</option>
            {areas?.map((area: Area) => (
              <option key={area.id} value={area.id}>{area.icon} {area.name_es}</option>
            ))}
          </select>

          {/* Topic filter */}
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            value={topicFilter || ''}
            onChange={e => setTopicFilter(e.target.value ? Number(e.target.value) : undefined)}
            disabled={!areaFilter}
            title={!areaFilter ? 'Selecciona un área primero' : ''}
          >
            <option value="">Todos los topics</option>
            {topics?.map((topic: TopicWithArea) => (
              <option key={topic.id} value={topic.id}>{topic.name_es}</option>
            ))}
          </select>

          {/* Classification filter */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setClassificationFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                classificationFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setClassificationFilter('classified')}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                classificationFilter === 'classified'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Clasificados
            </button>
            <button
              onClick={() => setClassificationFilter('unclassified')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                classificationFilter === 'unclassified'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pendientes
            </button>
          </div>

          {/* Favorites filter */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showOnlyFavorites
                ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Star className={`w-4 h-4 ${showOnlyFavorites ? 'fill-yellow-500' : ''}`} />
            Favoritos
          </button>

          {/* Clear filters */}
          {(searchInput || areaFilter || topicFilter || showOnlyFavorites || classificationFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchInput('')
                setAreaFilter(undefined)
                setTopicFilter(undefined)
                setShowOnlyFavorites(false)
                setClassificationFilter('all')
              }}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Authors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAuthors.map(author => (
          <article
            key={author.author}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => handleAuthorClick(author.author)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {author.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {author.author}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {author.video_count} videos
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(author.total_views)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite.mutate({ authorName: author.author, isFavorite: author.is_favorite })
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Star className={`w-5 h-5 ${author.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
              </button>
            </div>

            {/* Areas distribution */}
            {author.areas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Distribución por área:</p>

                {/* Bar visualization */}
                <div className="flex h-3 rounded-full overflow-hidden">
                  {author.areas.map((area, idx) => (
                    <div
                      key={area.id}
                      className="h-full transition-all"
                      style={{
                        backgroundColor: area.color,
                        width: `${getAreaPercentage(author, area)}%`,
                        marginLeft: idx > 0 ? '1px' : 0
                      }}
                      title={`${area.icon} ${area.name_es}: ${area.count} videos (${getAreaPercentage(author, area)}%)`}
                    />
                  ))}
                </div>

                {/* Area tags */}
                <div className="flex flex-wrap gap-1.5">
                  {author.areas.slice(0, 4).map(area => (
                    <span
                      key={area.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ backgroundColor: area.color }}
                    >
                      {area.icon} {area.count}
                    </span>
                  ))}
                  {author.areas.length > 4 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">
                      +{author.areas.length - 4}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-xs text-gray-400 italic">Sin clasificar</p>
              </div>
            )}
          </article>
        ))}
      </div>

      {filteredAuthors.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-gray-400 mb-4">
            <User className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-gray-500">No se encontraron autores con los filtros aplicados.</p>
        </div>
      )}
    </div>
  )
}
