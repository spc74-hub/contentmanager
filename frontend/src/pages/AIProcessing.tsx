import { useState, useEffect, useMemo } from 'react'
import { Play, Pause, RefreshCw, Check, AlertCircle, Clock, Sparkles, FileText, Tag, Folder, Settings, Zap, Activity, Timer, X, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'

// Enrichment stats types
interface EnrichmentSourceStats {
  source: string
  total: number
  without_transcript: number
  without_area: number
  without_summary: number
  without_key_points: number
  without_topics: number
}

interface EnrichmentChannelStats {
  channel_id: number
  channel_name: string
  total: number
  without_transcript: number
  without_area: number
  without_summary: number
  without_key_points: number
}

interface EnrichmentStats {
  total_videos: number
  total_archived: number
  by_source: EnrichmentSourceStats[]
  by_channel: EnrichmentChannelStats[]
  global_without_transcript: number
  global_without_area: number
  global_without_summary: number
  global_without_key_points: number
  global_without_topics: number
}

interface AIJob {
  id: string
  status: string
  total_videos: number
  processed: number
  transcribed: number
  summarized: number
  categorized: number
  failed: number
  skipped: number
  area_assigned: number
  key_points_added: number
  started_at: string | null
  completed_at: string | null
  eta_minutes: number | null
  current_video: string | null
  error: string | null
  errors_list: string[]
}

interface AIHealthStatus {
  ready: boolean
  services: {
    ollama: { status: string; model: string; available_models?: string[] }
    whisper: { status: string; models?: string[] }
    yt_dlp: { status: string; version?: string }
  }
}

interface ProcessingOptions {
  source: string
  include_transcription: boolean
  include_summary: boolean
  include_key_points: boolean
  include_categorization: boolean
  include_subcategories: boolean
  whisper_model: string
  limit: number | null
  skip_processed: boolean
  only_without_area: boolean
  only_without_key_points: boolean
  only_without_summary: boolean
  curated_channel_id: number | null
}

export function AIProcessing() {
  const [health, setHealth] = useState<AIHealthStatus | null>(null)
  const [currentJob, setCurrentJob] = useState<AIJob | null>(null)
  const [jobs, setJobs] = useState<AIJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Enrichment stats
  const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(true)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const [options, setOptions] = useState<ProcessingOptions>({
    source: 'all',
    include_transcription: true,
    include_summary: true,
    include_key_points: true,
    include_categorization: true,
    include_subcategories: true,
    whisper_model: 'base',
    limit: null,
    skip_processed: true,
    only_without_area: false,
    only_without_key_points: false,
    only_without_summary: false,
    curated_channel_id: null,
  })

  const [showChannelStats, setShowChannelStats] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Check health on mount
  useEffect(() => {
    checkHealth()
    loadJobs()
    loadEnrichmentStats()
  }, [])

  const loadEnrichmentStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch(`${apiUrl}/api/ai-process/enrichment-stats`)
      if (response.ok) {
        const data = await response.json()
        setEnrichmentStats(data)
      }
    } catch (e) {
      console.error('Error loading enrichment stats:', e)
    } finally {
      setLoadingStats(false)
    }
  }

  // Auto-configure options based on selected source stats
  const configureFromStats = (source: string, type: 'transcript' | 'area' | 'summary' | 'key_points' | 'all', channelId?: number) => {
    const sourceKey = source === 'all' ? 'all' : source
    setSelectedSource(channelId ? `channel_${channelId}` : source)

    // Map source names to API source values
    const sourceMapping: Record<string, string> = {
      'subscription': 'subscription',
      'liked_videos': 'liked_videos',
      'playlist': 'playlist',
      'tiktok': 'tiktok',
      'curated_channel': 'curated_channel',
      'all': 'all',
    }

    const apiSource = sourceMapping[sourceKey] || 'all'

    // Reset all special filters first
    const baseOptions = {
      source: apiSource,
      skip_processed: false,
      only_without_area: false,
      only_without_key_points: false,
      only_without_summary: false,
      curated_channel_id: channelId || null,
    }

    if (type === 'all') {
      // Configure to process everything missing
      setOptions(prev => ({
        ...prev,
        ...baseOptions,
        include_transcription: true,
        include_summary: true,
        include_key_points: true,
        include_categorization: true,
        include_subcategories: true,
        skip_processed: true,
      }))
    } else if (type === 'transcript') {
      setOptions(prev => ({
        ...prev,
        ...baseOptions,
        include_transcription: true,
        include_summary: false,
        include_key_points: false,
        include_categorization: false,
        include_subcategories: false,
        skip_processed: true,  // Skip videos that already have transcript
      }))
    } else if (type === 'area') {
      setOptions(prev => ({
        ...prev,
        ...baseOptions,
        include_transcription: false,
        include_summary: false,
        include_key_points: false,
        include_categorization: true,
        include_subcategories: true,
        only_without_area: true,  // Only videos without area
      }))
    } else if (type === 'summary') {
      setOptions(prev => ({
        ...prev,
        ...baseOptions,
        include_transcription: false,
        include_summary: true,
        include_key_points: false,
        include_categorization: false,
        include_subcategories: false,
        only_without_summary: true,  // Only videos without summary
      }))
    } else if (type === 'key_points') {
      // Note: key_points are generated together with summary, so include_summary must be true
      setOptions(prev => ({
        ...prev,
        ...baseOptions,
        include_transcription: false,
        include_summary: true,  // Required - key_points are generated with summary
        include_key_points: true,
        include_categorization: false,
        include_subcategories: false,
        only_without_key_points: true,  // Only videos without key_points
      }))
    }
  }

  // Poll for job status when a job is running
  useEffect(() => {
    if (currentJob?.status === 'running' || currentJob?.status === 'pending') {
      const interval = setInterval(() => {
        fetchJobStatus(currentJob.id)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [currentJob?.id, currentJob?.status])

  const checkHealth = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ai-process/health`)
      const data = await response.json()
      setHealth(data)
    } catch (e) {
      setHealth(null)
    }
  }

  const loadJobs = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ai-process/jobs`)
      const data = await response.json()
      setJobs(data)

      // Find active job
      const activeJob = data.find((j: AIJob) => j.status === 'running' || j.status === 'pending')
      if (activeJob) {
        setCurrentJob(activeJob)
      }
    } catch (e) {
      console.error('Error loading jobs:', e)
    }
  }

  const fetchJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/ai-process/status/${jobId}`)
      const data = await response.json()
      setCurrentJob(data)

      if (data.status === 'completed' || data.status === 'failed') {
        loadJobs()
      }
    } catch (e) {
      console.error('Error fetching job status:', e)
    }
  }

  const startProcessing = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/api/ai-process/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error starting processing')
      }

      const job = await response.json()
      setCurrentJob(job)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const pauseJob = async () => {
    if (!currentJob) return

    try {
      const response = await fetch(`${apiUrl}/api/ai-process/pause/${currentJob.id}`, {
        method: 'POST',
      })
      const data = await response.json()
      setCurrentJob(data.job)
    } catch (e) {
      console.error('Error pausing job:', e)
    }
  }

  const cancelJob = async () => {
    if (!currentJob) return

    if (!confirm('Seguro que quieres cancelar este trabajo? No se puede deshacer.')) return

    try {
      const response = await fetch(`${apiUrl}/api/ai-process/cancel/${currentJob.id}`, {
        method: 'POST',
      })
      const data = await response.json()
      setCurrentJob(data.job)
      loadJobs()
    } catch (e) {
      console.error('Error cancelling job:', e)
    }
  }

  const _deleteJob = async (jobId: string) => {
    try {
      await fetch(`${apiUrl}/api/ai-process/jobs/${jobId}`, {
        method: 'DELETE',
      })
      loadJobs()
      if (currentJob?.id === jobId) {
        setCurrentJob(null)
      }
    } catch (e) {
      console.error('Error deleting job:', e)
    }
  }
  void _deleteJob // Silence unused warning - may be used in future

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const progress = currentJob && currentJob.total_videos > 0
    ? Math.round((currentJob.processed / currentJob.total_videos) * 100)
    : 0

  // Calculate time metrics
  const timeMetrics = useMemo(() => {
    if (!currentJob?.started_at) return null

    const startTime = new Date(currentJob.started_at).getTime()
    const endTime = currentJob.completed_at
      ? new Date(currentJob.completed_at).getTime()
      : Date.now()

    const elapsedSeconds = (endTime - startTime) / 1000
    const elapsedMinutes = elapsedSeconds / 60

    const effectiveProcessed = currentJob.processed - currentJob.skipped
    const avgSecondsPerVideo = effectiveProcessed > 0 ? elapsedSeconds / effectiveProcessed : 0

    const remaining = currentJob.total_videos - currentJob.processed
    const etaSeconds = remaining * avgSecondsPerVideo
    const etaMinutes = etaSeconds / 60

    return {
      elapsedMinutes,
      avgSecondsPerVideo,
      etaMinutes,
      effectiveProcessed
    }
  }, [currentJob?.started_at, currentJob?.completed_at, currentJob?.processed, currentJob?.skipped, currentJob?.total_videos])

  const formatSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procesamiento con IA</h1>
        <p className="text-gray-500">Transcribe y analiza videos con Whisper + Ollama</p>
      </div>

      {/* Health Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Estado de Servicios
          </h2>
          <button
            onClick={checkHealth}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refrescar
          </button>
        </div>

        {health ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Ollama */}
            <div className={`p-4 rounded-lg ${health.services.ollama.status === 'ok' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {health.services.ollama.status === 'ok' ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">Ollama</span>
              </div>
              <p className="text-sm text-gray-600">
                {health.services.ollama.status === 'ok'
                  ? `Modelo: ${health.services.ollama.model}`
                  : 'No disponible - ejecuta: ollama serve'}
              </p>
            </div>

            {/* Whisper */}
            <div className={`p-4 rounded-lg ${health.services.whisper.status === 'ok' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {health.services.whisper.status === 'ok' ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">Whisper</span>
              </div>
              <p className="text-sm text-gray-600">
                {health.services.whisper.status === 'ok'
                  ? 'faster-whisper instalado'
                  : 'pip install faster-whisper'}
              </p>
            </div>

            {/* yt-dlp */}
            <div className={`p-4 rounded-lg ${health.services.yt_dlp.status === 'ok' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {health.services.yt_dlp.status === 'ok' ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">yt-dlp</span>
              </div>
              <p className="text-sm text-gray-600">
                {health.services.yt_dlp.status === 'ok'
                  ? `v${health.services.yt_dlp.version}`
                  : 'pip install yt-dlp'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            Verificando servicios...
          </div>
        )}
      </div>

      {/* Enrichment Stats Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Estado de Enriquecimiento
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadEnrichmentStats}
              disabled={loadingStats}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={() => setStatsExpanded(!statsExpanded)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {statsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {statsExpanded && (
          <>
            {loadingStats ? (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Cargando estadísticas...
              </div>
            ) : enrichmentStats ? (
              <div className="space-y-4">
                {/* Global Summary */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                  <button
                    onClick={() => configureFromStats('all', 'transcript')}
                    className={`p-3 rounded-lg text-center transition-all ${
                      selectedSource === 'all' && options.include_transcription && !options.include_summary
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl font-bold text-orange-600">{enrichmentStats.global_without_transcript}</div>
                    <div className="text-xs text-gray-600">Sin Transcripción</div>
                  </button>
                  <button
                    onClick={() => configureFromStats('all', 'area')}
                    className={`p-3 rounded-lg text-center transition-all ${
                      selectedSource === 'all' && options.only_without_area
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl font-bold text-red-600">{enrichmentStats.global_without_area}</div>
                    <div className="text-xs text-gray-600">Sin Área</div>
                  </button>
                  <button
                    onClick={() => configureFromStats('all', 'summary')}
                    className={`p-3 rounded-lg text-center transition-all ${
                      selectedSource === 'all' && options.include_summary && !options.include_transcription
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl font-bold text-yellow-600">{enrichmentStats.global_without_summary}</div>
                    <div className="text-xs text-gray-600">Sin Resumen</div>
                  </button>
                  <button
                    onClick={() => configureFromStats('all', 'key_points')}
                    className={`p-3 rounded-lg text-center transition-all ${
                      selectedSource === 'all' && options.include_key_points && !options.include_summary
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl font-bold text-purple-600">{enrichmentStats.global_without_key_points}</div>
                    <div className="text-xs text-gray-600">Sin Puntos Clave</div>
                  </button>
                  <button
                    onClick={() => configureFromStats('all', 'all')}
                    className={`p-3 rounded-lg text-center transition-all ${
                      selectedSource === 'all' && options.include_transcription && options.include_summary
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl font-bold text-blue-600">{enrichmentStats.total_videos}</div>
                    <div className="text-xs text-gray-600">Total Activos</div>
                  </button>
                </div>

                {/* Per-Source Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Fuente</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                        <th className="text-right py-2 px-3 font-medium text-orange-600">Sin Transcript</th>
                        <th className="text-right py-2 px-3 font-medium text-red-600">Sin Área</th>
                        <th className="text-right py-2 px-3 font-medium text-yellow-600">Sin Resumen</th>
                        <th className="text-right py-2 px-3 font-medium text-purple-600">Sin P. Clave</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichmentStats.by_source.map((source) => (
                        <tr
                          key={source.source}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            selectedSource === source.source ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-medium">{source.source}</td>
                          <td className="py-2 px-3 text-right">{source.total}</td>
                          <td className="py-2 px-3 text-right">
                            {source.without_transcript > 0 ? (
                              <button
                                onClick={() => configureFromStats(source.source, 'transcript')}
                                className="text-orange-600 hover:underline font-medium"
                              >
                                {source.without_transcript}
                              </button>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {source.without_area > 0 ? (
                              <button
                                onClick={() => configureFromStats(source.source, 'area')}
                                className="text-red-600 hover:underline font-medium"
                              >
                                {source.without_area}
                              </button>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {source.without_summary > 0 ? (
                              <button
                                onClick={() => configureFromStats(source.source, 'summary')}
                                className="text-yellow-600 hover:underline font-medium"
                              >
                                {source.without_summary}
                              </button>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {source.without_key_points > 0 ? (
                              <button
                                onClick={() => configureFromStats(source.source, 'key_points')}
                                className="text-purple-600 hover:underline font-medium"
                              >
                                {source.without_key_points}
                              </button>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => configureFromStats(source.source, 'all')}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Procesar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Haz clic en un número para configurar automáticamente las opciones de procesamiento.
                  <span className="ml-2 text-gray-400">({enrichmentStats.total_archived} archivados excluidos)</span>
                </p>

                {/* Curated Channels Stats */}
                {enrichmentStats.by_channel && enrichmentStats.by_channel.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowChannelStats(!showChannelStats)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-3"
                    >
                      {showChannelStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Canales Curados ({enrichmentStats.by_channel.length} con videos)
                    </button>

                    {showChannelStats && (
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Canal</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                              <th className="text-right py-2 px-3 font-medium text-orange-600">Sin Transcript</th>
                              <th className="text-right py-2 px-3 font-medium text-red-600">Sin Área</th>
                              <th className="text-right py-2 px-3 font-medium text-yellow-600">Sin Resumen</th>
                              <th className="text-right py-2 px-3 font-medium text-purple-600">Sin P. Clave</th>
                              <th className="text-center py-2 px-3 font-medium text-gray-700">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrichmentStats.by_channel.map((channel) => (
                              <tr
                                key={channel.channel_id}
                                className={`border-b border-gray-100 hover:bg-gray-50 ${
                                  selectedSource === `channel_${channel.channel_id}` ? 'bg-blue-50' : ''
                                }`}
                              >
                                <td className="py-2 px-3 font-medium truncate max-w-[200px]" title={channel.channel_name}>
                                  {channel.channel_name}
                                </td>
                                <td className="py-2 px-3 text-right">{channel.total}</td>
                                <td className="py-2 px-3 text-right">
                                  {channel.without_transcript > 0 ? (
                                    <button
                                      onClick={() => configureFromStats('curated_channel', 'transcript', channel.channel_id)}
                                      className="text-orange-600 hover:underline font-medium"
                                    >
                                      {channel.without_transcript}
                                    </button>
                                  ) : (
                                    <span className="text-green-600">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {channel.without_area > 0 ? (
                                    <button
                                      onClick={() => configureFromStats('curated_channel', 'area', channel.channel_id)}
                                      className="text-red-600 hover:underline font-medium"
                                    >
                                      {channel.without_area}
                                    </button>
                                  ) : (
                                    <span className="text-green-600">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {channel.without_summary > 0 ? (
                                    <button
                                      onClick={() => configureFromStats('curated_channel', 'summary', channel.channel_id)}
                                      className="text-yellow-600 hover:underline font-medium"
                                    >
                                      {channel.without_summary}
                                    </button>
                                  ) : (
                                    <span className="text-green-600">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {channel.without_key_points > 0 ? (
                                    <button
                                      onClick={() => configureFromStats('curated_channel', 'key_points', channel.channel_id)}
                                      className="text-purple-600 hover:underline font-medium"
                                    >
                                      {channel.without_key_points}
                                    </button>
                                  ) : (
                                    <span className="text-green-600">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => configureFromStats('curated_channel', 'all', channel.channel_id)}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >
                                    Procesar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No se pudieron cargar las estadísticas
              </div>
            )}
          </>
        )}
      </div>

      {/* Current Job Status */}
      {currentJob && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Trabajo Actual
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentJob.status)}`}>
              {currentJob.status === 'running' && <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />}
              {currentJob.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{currentJob.processed} / {currentJob.total_videos} videos</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current video */}
          {currentJob.current_video && (
            <p className="text-sm text-gray-500 mb-4">
              Procesando: {currentJob.current_video}
            </p>
          )}

          {/* Enrichment Stats - matching Estado de Enriquecimiento panel */}
          <div className="grid grid-cols-7 gap-3 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{currentJob.transcribed}</p>
              <p className="text-xs text-gray-500">Transcrito</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{currentJob.area_assigned || 0}</p>
              <p className="text-xs text-gray-500">Con Área</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{currentJob.summarized}</p>
              <p className="text-xs text-gray-500">Resumido</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{currentJob.key_points_added || 0}</p>
              <p className="text-xs text-gray-500">P. Clave</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{currentJob.categorized}</p>
              <p className="text-xs text-gray-500">Categorizado</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{currentJob.failed}</p>
              <p className="text-xs text-gray-500">Fallidos</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{currentJob.skipped}</p>
              <p className="text-xs text-gray-500">Omitidos</p>
            </div>
          </div>

          {/* Time Metrics */}
          {timeMetrics && (
            <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                  <Timer className="w-4 h-4" />
                  <span className="text-xs">Tiempo transcurrido</span>
                </div>
                <p className="text-lg font-semibold text-gray-800">
                  {formatDuration(timeMetrics.elapsedMinutes)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs">Tiempo por video</span>
                </div>
                <p className="text-lg font-semibold text-blue-600">
                  {timeMetrics.avgSecondsPerVideo > 0 ? formatSeconds(timeMetrics.avgSecondsPerVideo) : '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">ETA restante</span>
                </div>
                <p className="text-lg font-semibold text-orange-600">
                  {currentJob.status === 'running' && timeMetrics.etaMinutes > 0
                    ? formatDuration(timeMetrics.etaMinutes)
                    : currentJob.status === 'completed' ? 'Completado' : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {currentJob.status === 'running' && (
              <>
                <button
                  onClick={pauseJob}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                >
                  <Pause className="w-4 h-4" />
                  Pausar
                </button>
                <button
                  onClick={cancelJob}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </>
            )}
            {currentJob.status === 'paused' && (
              <button
                onClick={cancelJob}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <X className="w-4 h-4" />
                Cancelar definitivamente
              </button>
            )}
          </div>

          {/* Errors */}
          {currentJob.errors_list && currentJob.errors_list.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">
                Errores ({currentJob.errors_list.length}):
              </p>
              <ul className="text-xs text-red-600 max-h-32 overflow-y-auto space-y-1">
                {currentJob.errors_list.slice(0, 10).map((err, i) => (
                  <li key={i} className="truncate">- {err}</li>
                ))}
                {currentJob.errors_list.length > 10 && (
                  <li>...y {currentJob.errors_list.length - 10} mas</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Configuration Panel */}
      {(!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'paused') && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuracion del Procesamiento
          </h2>

          <div className="space-y-6">
            {/* Source Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fuente de videos
                </label>
                <select
                  value={options.source}
                  onChange={e => setOptions(o => ({ ...o, source: e.target.value, curated_channel_id: null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="all">Todos</option>
                  <option value="youtube">YouTube (todos)</option>
                  <option value="tiktok">TikTok</option>
                  <option value="subscription">Suscripciones</option>
                  <option value="liked_videos">Videos gustados</option>
                  <option value="playlist">Playlists</option>
                  <option value="curated_channel">Canales curados</option>
                </select>
              </div>

              {/* Curated Channel Selector */}
              {options.source === 'curated_channel' && enrichmentStats?.by_channel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canal específico
                  </label>
                  <select
                    value={options.curated_channel_id || ''}
                    onChange={e => setOptions(o => ({ ...o, curated_channel_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">Todos los canales curados</option>
                    {enrichmentStats.by_channel.map(ch => (
                      <option key={ch.channel_id} value={ch.channel_id}>
                        {ch.channel_name} ({ch.total} videos)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected channel indicator */}
              {options.curated_channel_id && enrichmentStats?.by_channel && (
                <div className="col-span-2 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-blue-800">
                    Canal seleccionado: <strong>{enrichmentStats.by_channel.find(c => c.channel_id === options.curated_channel_id)?.channel_name}</strong>
                  </span>
                  <button
                    onClick={() => setOptions(o => ({ ...o, curated_channel_id: null }))}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Processing Options */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.include_transcription}
                  onChange={e => setOptions(o => ({ ...o, include_transcription: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                <div>
                  <FileText className="w-5 h-5 text-blue-500 inline mr-2" />
                  <span className="font-medium">Transcripcion (Whisper)</span>
                  <p className="text-xs text-gray-500">Descarga audio y transcribe</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.include_summary}
                  onChange={e => setOptions(o => ({ ...o, include_summary: e.target.checked }))}
                  className="rounded border-gray-300 text-purple-600"
                />
                <div>
                  <Sparkles className="w-5 h-5 text-purple-500 inline mr-2" />
                  <span className="font-medium">Resumen IA</span>
                  <p className="text-xs text-gray-500">Genera resumen con Ollama</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.include_key_points}
                  onChange={e => setOptions(o => ({ ...o, include_key_points: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600"
                />
                <div>
                  <Tag className="w-5 h-5 text-green-500 inline mr-2" />
                  <span className="font-medium">Puntos clave</span>
                  <p className="text-xs text-gray-500">Lista de puntos principales</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.include_categorization}
                  onChange={e => setOptions(o => ({ ...o, include_categorization: e.target.checked }))}
                  className="rounded border-gray-300 text-orange-600"
                />
                <div>
                  <Folder className="w-5 h-5 text-orange-500 inline mr-2" />
                  <span className="font-medium">Re-categorizar</span>
                  <p className="text-xs text-gray-500">Mejora categoria con transcripcion</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.include_subcategories}
                  onChange={e => setOptions(o => ({ ...o, include_subcategories: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600"
                />
                <div>
                  <Tag className="w-5 h-5 text-pink-500 inline mr-2" />
                  <span className="font-medium">Subcategorias IA</span>
                  <p className="text-xs text-gray-500">2-3 subcategorias por video</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={options.skip_processed}
                  onChange={e => setOptions(o => ({ ...o, skip_processed: e.target.checked }))}
                  className="rounded border-gray-300 text-gray-600"
                />
                <div>
                  <Check className="w-5 h-5 text-gray-500 inline mr-2" />
                  <span className="font-medium">Omitir procesados</span>
                  <p className="text-xs text-gray-500">Salta videos con transcripcion</p>
                </div>
              </label>
            </div>

            {/* Migration Option */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.only_without_area}
                  onChange={e => setOptions(o => ({ ...o, only_without_area: e.target.checked }))}
                  className="rounded border-amber-400 text-amber-600"
                />
                <div>
                  <Folder className="w-5 h-5 text-amber-600 inline mr-2" />
                  <span className="font-medium text-amber-800">Solo videos sin area asignada</span>
                  <p className="text-xs text-amber-700">Procesa los 3,119 videos pendientes de clasificar en la nueva taxonomia</p>
                </div>
              </label>
            </div>

            {/* Whisper Model */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo Whisper
                </label>
                <select
                  value={options.whisper_model}
                  onChange={e => setOptions(o => ({ ...o, whisper_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="tiny">tiny (rapido, menos preciso)</option>
                  <option value="base">base (recomendado)</option>
                  <option value="small">small (mejor calidad)</option>
                  <option value="medium">medium (alta calidad, lento)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limite de videos (para pruebas)
                </label>
                <input
                  type="number"
                  value={options.limit || ''}
                  onChange={e => setOptions(o => ({ ...o, limit: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Sin limite"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  min="1"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={startProcessing}
              disabled={isLoading || !health?.ready}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Iniciar Procesamiento
                </>
              )}
            </button>

            {!health?.ready && (
              <p className="text-sm text-center text-gray-500">
                Asegurate de que todos los servicios esten activos antes de iniciar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Previous Jobs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Trabajos Anteriores ({jobs.length})
          </h2>
          <button
            onClick={loadJobs}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refrescar
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay trabajos anteriores</p>
        ) : (

          <div className="space-y-3">
            {jobs.slice(0, 10).map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900">{job.id}</span>
                  <p className="text-sm text-gray-500">
                    {job.processed}/{job.total_videos} videos -
                    {job.transcribed} transcritos, {job.summarized} resumidos
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
