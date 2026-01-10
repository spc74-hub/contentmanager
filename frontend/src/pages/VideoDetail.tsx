import { useParams, Link } from 'react-router-dom'
import { useVideo, useCategories, useVideoTags, useVideoSubcategories } from '@/hooks'
import { ArrowLeft, Play, ExternalLink, Clock, Eye, ThumbsUp, User, Tag, Hash, FileText, Calendar, Folder, Copy, Check, ListChecks } from 'lucide-react'
import { VIDEO_SOURCES } from '@/types'
import { useState } from 'react'

export function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const videoId = Number(id)
  const { data: video, isLoading, error } = useVideo(videoId)
  const { data: categories } = useCategories()
  const { data: videoTags } = useVideoTags(videoId)
  const { data: videoSubcategories } = useVideoSubcategories(videoId)
  const [copiedTranscript, setCopiedTranscript] = useState(false)

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const copyTranscript = async () => {
    if (video?.transcript) {
      await navigator.clipboard.writeText(video.transcript)
      setCopiedTranscript(true)
      setTimeout(() => setCopiedTranscript(false), 2000)
    }
  }

  const category = categories?.find(c => c.id === video?.category_id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Video no encontrado</p>
        <Link to="/videos" className="text-blue-600 hover:underline mt-4 inline-block">
          Volver a videos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/videos"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Video and Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="relative aspect-video bg-gray-100">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Play className="w-20 h-20" />
                </div>
              )}
              {/* Play button overlay */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                  <Play className="w-10 h-10 text-white ml-1" fill="white" />
                </div>
              </a>
            </div>

            <div className="p-6 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {formatNumber(video.view_count)} vistas
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  {formatNumber(video.like_count)} likes
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(video.duration)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Ver Video Original
                </a>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir en nueva pestaña
                </a>
              </div>
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <FileText className="w-5 h-5 text-gray-400" />
                Descripción Original
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {video.description}
              </p>
            </div>
          )}

          {/* AI Summary */}
          {video.summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-800 mb-4">
                <FileText className="w-5 h-5" />
                Resumen Generado por IA
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {video.summary}
              </p>
            </div>
          )}

          {/* AI Key Points */}
          {video.key_points && video.key_points.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-green-800 mb-4">
                <ListChecks className="w-5 h-5" />
                Puntos Clave
              </h2>
              <ul className="space-y-2">
                {video.key_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {video.transcript && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FileText className="w-5 h-5 text-gray-400" />
                  Transcripción Completa
                </h2>
                <button
                  onClick={copyTranscript}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {copiedTranscript ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm font-mono">
                  {video.transcript}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Author & Source */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Información</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Autor</p>
                  <p className="font-medium text-gray-900">{video.author}</p>
                </div>
              </div>

              {video.source && (
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Fuente</p>
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-sm rounded-full">
                      {VIDEO_SOURCES[video.source as keyof typeof VIDEO_SOURCES] || video.source}
                    </span>
                  </div>
                </div>
              )}

              {category && (
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Categoría</p>
                    <span
                      className="px-3 py-1 rounded-full text-white text-sm inline-block"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.icon} {category.name}
                    </span>
                  </div>
                </div>
              )}

              {video.upload_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Publicado</p>
                    <p className="text-gray-700">{formatDate(video.upload_date)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Añadido a la biblioteca</p>
                  <p className="text-gray-700">{formatDate(video.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Subcategories */}
          {videoSubcategories && videoSubcategories.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <Tag className="w-5 h-5 text-gray-400" />
                Subcategorías IA
              </h2>
              <div className="flex flex-wrap gap-2">
                {videoSubcategories.map(subcat => (
                  <Link
                    key={subcat.id}
                    to={`/videos?subcategoryId=${subcat.id}`}
                    className="px-3 py-1.5 bg-pink-50 text-pink-700 text-sm rounded-full border border-pink-200 hover:bg-pink-100 transition-colors"
                  >
                    {subcat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {videoTags && videoTags.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <Hash className="w-5 h-5 text-gray-400" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {videoTags.map(tag => (
                  <Link
                    key={tag.id}
                    to={`/videos?tagId=${tag.id}`}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 text-center">
                <Eye className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{formatNumber(video.view_count)}</p>
                <p className="text-xs text-gray-500">Vistas</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <ThumbsUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{formatNumber(video.like_count)}</p>
                <p className="text-xs text-gray-500">Likes</p>
              </div>
              <div className="col-span-2 bg-white rounded-xl p-4 text-center">
                <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{formatDuration(video.duration)}</p>
                <p className="text-xs text-gray-500">Duración</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
