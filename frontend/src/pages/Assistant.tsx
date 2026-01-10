import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  useEmbeddingStats,
  useGenerateEmbeddings,
  useSemanticSearch,
  useRAGChat,
  useOllamaModels,
  useAnalyzeSelection,
  type SearchResult,
  type ChatMessage
} from '@/hooks'
import {
  Bot,
  Search,
  MessageSquare,
  Database,
  Play,
  Loader2,
  Send,
  Trash2,
  ExternalLink,
  Sparkles,
  X,
  ChevronDown
} from 'lucide-react'

type TabType = 'search' | 'chat' | 'indexing'

export function Assistant() {
  const [activeTab, setActiveTab] = useState<TabType>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { data: stats } = useEmbeddingStats()
  const generateEmbeddings = useGenerateEmbeddings()
  const { search, results, isSearching, processingTime, clearResults } = useSemanticSearch()
  const { messages, sendMessage, clearChat, isLoading: isChatLoading, model, setModel } = useRAGChat()
  const { data: modelsData } = useOllamaModels()
  const analyzeSelection = useAnalyzeSelection()

  // Analysis modal state
  const [analysisModal, setAnalysisModal] = useState<{
    isOpen: boolean
    result: { analysis: string; mode: string; video_count: number; videos_with_summary: number | null; processing_time_seconds: number } | null
    loading: boolean
  }>({ isOpen: false, result: null, loading: false })
  const [showAnalyzeDropdown, setShowAnalyzeDropdown] = useState(false)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      search(searchQuery)
    }
  }

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (chatInput.trim() && !isChatLoading) {
      sendMessage(chatInput)
      setChatInput('')
    }
  }

  const handleGenerate = () => {
    generateEmbeddings.mutate({ batch_size: 20 })
  }

  const handleAnalyzeResults = async (mode: 'light' | 'extended') => {
    const videoIds = results.map(r => r.id)
    if (videoIds.length === 0) return

    setShowAnalyzeDropdown(false)
    setAnalysisModal({ isOpen: true, result: null, loading: true })

    try {
      const result = await analyzeSelection.mutateAsync({ videoIds, mode })
      setAnalysisModal({ isOpen: true, result, loading: false })
    } catch (error) {
      console.error('Analysis error:', error)
      setAnalysisModal({ isOpen: false, result: null, loading: false })
      alert(error instanceof Error ? error.message : 'Error al analizar resultados')
    }
  }

  const tabs = [
    { id: 'search' as TabType, label: 'Buscar', icon: Search },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'indexing' as TabType, label: 'Indexación', icon: Database },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" />
          Asistente IA
        </h1>
        <p className="text-gray-500">Busca y consulta tu biblioteca de videos usando IA</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-sm text-gray-500">Videos indexados</span>
                <p className="text-xl font-bold text-gray-900">
                  {stats.with_embedding.toLocaleString()} / {stats.total_videos.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div>
                <span className="text-sm text-gray-500">Progreso</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all"
                      style={{ width: `${stats.percentage_complete}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{stats.percentage_complete}%</span>
                </div>
              </div>
            </div>
            {stats.without_embedding > 0 && activeTab !== 'indexing' && (
              <button
                onClick={() => setActiveTab('indexing')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {stats.without_embedding.toLocaleString()} pendientes
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca por tema, contenido, autor..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Buscar
              </button>
            </form>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {results.length} resultados ({processingTime.toFixed(0)}ms)
                  </p>
                  <div className="flex items-center gap-3">
                    {/* Analyze button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAnalyzeDropdown(!showAnalyzeDropdown)}
                        disabled={analysisModal.loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm disabled:opacity-50"
                      >
                        {analysisModal.loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Analizar
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {showAnalyzeDropdown && (
                        <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] z-10">
                          <button
                            onClick={() => handleAnalyzeResults('light')}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            <div className="font-medium text-sm">Análisis rápido</div>
                            <div className="text-xs text-gray-500">Solo títulos (5-10s)</div>
                          </button>
                          <button
                            onClick={() => handleAnalyzeResults('extended')}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            <div className="font-medium text-sm">Análisis extendido</div>
                            <div className="text-xs text-gray-500">Títulos + resúmenes (30-60s)</div>
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={clearResults}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {results.map((result: SearchResult) => (
                    <SearchResultCard key={result.id} result={result} />
                  ))}
                </div>
              </div>
            )}

            {results.length === 0 && searchQuery && !isSearching && (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron resultados para "{searchQuery}"</p>
              </div>
            )}

            {!searchQuery && results.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Escribe algo para buscar en tu biblioteca</p>
                <p className="text-sm mt-1">La búsqueda semántica encuentra videos por significado, no solo palabras</p>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[600px]">
            {/* Model selector */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Modelo:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                >
                  {modelsData?.models
                    ?.filter((m: string) => !m.includes('embed'))
                    ?.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    )) || <option value={model}>{model}</option>}
                </select>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar chat
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Pregunta sobre tus videos</p>
                  <p className="text-sm mt-1">El asistente buscará en tu biblioteca y responderá con contexto</p>
                </div>
              )}
              {messages.map((msg: ChatMessage, idx: number) => (
                <ChatMessageBubble key={idx} message={msg} />
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleChat} className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                disabled={isChatLoading}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* Indexing Tab */}
        {activeTab === 'indexing' && (
          <div className="space-y-6">
            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <p className="text-sm text-gray-500">Total videos</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total_videos.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-green-200 bg-green-50">
                  <p className="text-sm text-green-600">Con embedding</p>
                  <p className="text-3xl font-bold text-green-700">{stats.with_embedding.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-orange-200 bg-orange-50">
                  <p className="text-sm text-orange-600">Pendientes</p>
                  <p className="text-3xl font-bold text-orange-700">{stats.without_embedding.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* By source */}
            {stats?.by_source && Object.keys(stats.by_source).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Por fuente</h3>
                <div className="space-y-3">
                  {Object.entries(stats.by_source).map(([source, data]) => (
                    <div key={source} className="flex items-center gap-4">
                      <span className="w-24 text-sm text-gray-600 capitalize">{source}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{ width: `${(data.with_embedding / data.total * 100) || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-24 text-right">
                        {data.with_embedding}/{data.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate button */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Generar embeddings</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Procesa videos sin embedding usando el modelo <code className="bg-gray-100 px-1 rounded">nomic-embed-text</code>
                  </p>
                  {stats && stats.without_embedding > 0 && (
                    <p className="text-sm text-orange-600 mt-2">
                      Tiempo estimado: ~{Math.ceil(stats.without_embedding * 0.5 / 60)} minutos
                    </p>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generateEmbeddings.isPending || (stats?.without_embedding === 0)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generateEmbeddings.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Iniciar
                    </>
                  )}
                </button>
              </div>

              {/* Result */}
              {generateEmbeddings.data && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700">
                    Procesados: {generateEmbeddings.data.processed} |
                    Fallidos: {generateEmbeddings.data.failed} |
                    Omitidos: {generateEmbeddings.data.skipped} |
                    Tiempo: {generateEmbeddings.data.processing_time_seconds}s
                  </p>
                </div>
              )}

              {generateEmbeddings.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">{(generateEmbeddings.error as Error).message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Modal */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold">Análisis de Resultados</h2>
                {analysisModal.result && (
                  <span className="text-sm text-gray-500">
                    ({analysisModal.result.video_count} videos, {analysisModal.result.processing_time_seconds}s)
                  </span>
                )}
              </div>
              <button
                onClick={() => setAnalysisModal({ isOpen: false, result: null, loading: false })}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {analysisModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                  <p className="text-gray-600">Analizando {results.length} videos...</p>
                  <p className="text-sm text-gray-400 mt-2">Esto puede tardar 30-60 segundos</p>
                </div>
              ) : analysisModal.result ? (
                <div className="prose prose-sm max-w-none">
                  {analysisModal.result.mode === 'extended' && analysisModal.result.videos_with_summary !== null && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-lg text-sm">
                      <span className="font-medium">{analysisModal.result.videos_with_summary}</span> videos con resumen,{' '}
                      <span className="font-medium">{analysisModal.result.video_count - analysisModal.result.videos_with_summary}</span> solo con título
                    </div>
                  )}
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 underline">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {analysisModal.result.analysis}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>

            <div className="border-t p-4 flex justify-end">
              <button
                onClick={() => setAnalysisModal({ isOpen: false, result: null, loading: false })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Search result card component
function SearchResultCard({ result }: { result: SearchResult }) {
  const similarityPercent = Math.round(result.similarity * 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-200 transition-colors">
      <div className="flex gap-4">
        {result.thumbnail && (
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 truncate">{result.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              similarityPercent >= 70
                ? 'bg-green-100 text-green-700'
                : similarityPercent >= 50
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {similarityPercent}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{result.author}</p>
          {result.summary && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{result.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {result.source && (
              <span className="text-xs text-gray-400 capitalize">{result.source}</span>
            )}
            <a
              href={`/videos/${result.id}`}
              className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              Ver detalles <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Chat message bubble component
function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-400">Fuentes:</p>
            {message.sources.map((source, idx) => (
              <a
                key={idx}
                href={`/videos/${source.id}`}
                className="block text-xs text-purple-600 hover:text-purple-700 truncate"
              >
                {source.title} ({Math.round(source.similarity * 100)}%)
              </a>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
