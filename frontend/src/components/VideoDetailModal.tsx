import { X, Play, ExternalLink, Clock, Eye, ThumbsUp, User, Tag, Hash, FileText, Calendar, Folder, ListChecks, Star } from 'lucide-react'
import { useVideoTags, useVideoSubcategories } from '@/hooks/useTags'
import { useVideoTopics } from '@/hooks/useAreas'
import type { Video, Category, Area } from '@/types'
import { VIDEO_SOURCES } from '@/types'

interface VideoDetailModalProps {
  video: Video & { categories?: { name: string; icon: string; color: string }; areas?: Area | null }
  category?: Category
  area?: Area | null
  onClose: () => void
  onToggleFavorite?: () => void
}

export function VideoDetailModal({ video, category, area, onClose, onToggleFavorite }: VideoDetailModalProps) {
  const { data: videoTags } = useVideoTags(video.id)
  const { data: videoSubcategories } = useVideoSubcategories(video.id)
  const { data: videoTopics } = useVideoTopics(video.id)

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {video.title}
            </h2>
            {video.is_favorite && (
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title={video.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                <Star className={`w-5 h-5 ${video.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Left Column - Video Preview */}
            <div className="space-y-4">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Play className="w-16 h-16" />
                  </div>
                )}
                {/* Play button overlay */}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </a>
                {/* Duration */}
                <span className="absolute bottom-3 right-3 bg-black/80 text-white text-sm px-2 py-1 rounded">
                  {formatDuration(video.duration)}
                </span>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Eye className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{formatNumber(video.view_count)}</p>
                  <p className="text-xs text-gray-500">Vistas</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <ThumbsUp className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{formatNumber(video.like_count)}</p>
                  <p className="text-xs text-gray-500">Likes</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{formatDuration(video.duration)}</p>
                  <p className="text-xs text-gray-500">Duración</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Ver Video Original
                </a>
                <a
                  href={`/videos/${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Ver Detalle Completo
                </a>
              </div>
            </div>

            {/* Right Column - Details */}
            <div className="space-y-5">
              {/* Author & Source */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{video.author}</span>
                </div>
                {video.source && (
                  <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                    {VIDEO_SOURCES[video.source as keyof typeof VIDEO_SOURCES] || video.source}
                  </span>
                )}
              </div>

              {/* Area (new taxonomy) */}
              {area && (
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-gray-400" />
                  <span
                    className="px-3 py-1 rounded-full text-white text-sm"
                    style={{ backgroundColor: area.color }}
                  >
                    {area.icon} {area.name_es}
                  </span>
                </div>
              )}

              {/* Topics (new taxonomy) */}
              {videoTopics && videoTopics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {videoTopics.map((vt: { topic_id: number; topic: { id: number; name_es: string; area: { color: string } } }) => (
                      <span
                        key={vt.topic_id}
                        className="px-3 py-1 text-sm rounded-full border"
                        style={{
                          borderColor: vt.topic?.area?.color || '#6366f1',
                          color: vt.topic?.area?.color || '#6366f1',
                          backgroundColor: `${vt.topic?.area?.color || '#6366f1'}15`
                        }}
                      >
                        {vt.topic?.name_es}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category (legacy - fallback) */}
              {!area && category && (
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-gray-400" />
                  <span
                    className="px-3 py-1 rounded-full text-white text-sm"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.icon} {category.name}
                  </span>
                </div>
              )}

              {/* Dates */}
              <div className="space-y-1">
                {video.upload_date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span>Publicado: {formatDate(video.upload_date)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Calendar className="w-4 h-4 text-gray-300" />
                  <span>Añadido: {formatDate(video.created_at)}</span>
                </div>
              </div>

              {/* AI Summary */}
              {video.summary && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                    <FileText className="w-4 h-4" />
                    Resumen IA
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {video.summary}
                  </p>
                </div>
              )}

              {/* AI Key Points */}
              {video.key_points && video.key_points.length > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                    <ListChecks className="w-4 h-4" />
                    Puntos Clave
                  </div>
                  <ul className="space-y-1.5">
                    {video.key_points.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-700 text-sm">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Subcategories */}
              {videoSubcategories && videoSubcategories.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    Subcategorías IA
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {videoSubcategories.map(subcat => (
                      <span
                        key={subcat.id}
                        className="px-3 py-1 bg-pink-50 text-pink-700 text-sm rounded-full border border-pink-200"
                      >
                        {subcat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {videoTags && videoTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                    <Hash className="w-4 h-4 text-gray-400" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {videoTags.map(tag => (
                      <span
                        key={tag.id}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div>
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Descripción
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-6">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Has Transcript indicator */}
              {video.has_transcript && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <FileText className="w-4 h-4" />
                  Transcripción disponible
                  <a
                    href={`/videos/${video.id}`}
                    className="text-green-700 hover:underline font-medium"
                  >
                    (ver completa)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
