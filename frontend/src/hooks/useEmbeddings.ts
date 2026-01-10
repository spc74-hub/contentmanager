import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface EmbeddingStats {
  total_videos: number
  with_embedding: number
  without_embedding: number
  percentage_complete: number
  by_source: Record<string, { total: number; with_embedding: number }>
}

export interface EmbeddingGenerateRequest {
  video_ids?: number[]
  batch_size?: number
  force_regenerate?: boolean
}

export interface EmbeddingGenerateResponse {
  processed: number
  failed: number
  skipped: number
  processing_time_seconds: number
  errors: string[]
}

export interface SearchResult {
  id: number
  video_id: string
  title: string
  author: string
  summary: string | null
  similarity: number
  source: string | null
  thumbnail: string | null
}

export interface SemanticSearchResponse {
  results: SearchResult[]
  query: string
  processing_time_ms: number
}

export interface ChatSource {
  id: number
  video_id: string
  title: string
  author: string
  similarity: number
}

export interface ChatResponse {
  answer: string
  sources: ChatSource[]
  processing_time_seconds: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  timestamp: Date
}

export interface OllamaModels {
  models: string[]
  embedding_model: string
  default_chat_model: string
}

// ============== Hooks ==============

// Get embedding statistics
export function useEmbeddingStats() {
  return useQuery({
    queryKey: ['embedding-stats'],
    queryFn: async (): Promise<EmbeddingStats> => {
      const response = await fetch(`${API_BASE}/api/embeddings/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch embedding stats')
      }
      return response.json()
    },
    refetchInterval: 10000, // Refresh every 10s while generating
  })
}

// Generate embeddings
export function useGenerateEmbeddings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: EmbeddingGenerateRequest = {}): Promise<EmbeddingGenerateResponse> => {
      const response = await fetch(`${API_BASE}/api/embeddings/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_ids: request.video_ids,
          batch_size: request.batch_size ?? 20,
          force_regenerate: request.force_regenerate ?? false,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to generate embeddings')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embedding-stats'] })
    },
  })
}

// Semantic search
export function useSemanticSearch() {
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [lastQuery, setLastQuery] = useState('')
  const [processingTime, setProcessingTime] = useState(0)

  const search = useCallback(async (
    query: string,
    options: { limit?: number; threshold?: number; sourceFilter?: string } = {}
  ) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`${API_BASE}/api/embeddings/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: options.limit ?? 10,
          threshold: options.threshold ?? 0.3,
          source_filter: options.sourceFilter,
        }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data: SemanticSearchResponse = await response.json()
      setResults(data.results)
      setLastQuery(data.query)
      setProcessingTime(data.processing_time_ms)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setLastQuery('')
  }, [])

  return {
    search,
    clearResults,
    results,
    isSearching,
    lastQuery,
    processingTime,
  }
}

// RAG Chat
export function useRAGChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [model, setModel] = useState('qwen2.5:7b')

  const sendMessage = useCallback(async (
    query: string,
    options: { videoIds?: number[]; contextLimit?: number } = {}
  ) => {
    if (!query.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/embeddings/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          video_ids: options.videoIds,
          context_limit: options.contextLimit ?? 5,
          model,
        }),
      })

      if (!response.ok) {
        throw new Error('Chat failed')
      }

      const data: ChatResponse = await response.json()

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [model])

  const clearChat = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    sendMessage,
    clearChat,
    isLoading,
    model,
    setModel,
  }
}

// Get available Ollama models
export function useOllamaModels() {
  return useQuery({
    queryKey: ['ollama-models'],
    queryFn: async (): Promise<OllamaModels> => {
      const response = await fetch(`${API_BASE}/api/embeddings/models`)
      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }
      return response.json()
    },
    staleTime: 60000, // Cache for 1 minute
  })
}
