/**
 * API client replacing Supabase SDK.
 * All calls go through the FastAPI backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `API Error ${res.status}`)
  }
  return res.json()
}

// ============================================================================
// Supabase-compatible wrapper that routes to FastAPI
// ============================================================================

type QueryBuilder = {
  select: (columns?: string, opts?: { count?: string }) => QueryBuilder
  insert: (data: unknown) => QueryBuilder
  update: (data: unknown) => QueryBuilder
  delete: () => QueryBuilder
  eq: (col: string, val: unknown) => QueryBuilder
  neq: (col: string, val: unknown) => QueryBuilder
  in: (col: string, vals: unknown[]) => QueryBuilder
  ilike: (col: string, val: string) => QueryBuilder
  is: (col: string, val: unknown) => QueryBuilder
  or: (expr: string) => QueryBuilder
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => QueryBuilder
  range: (from: number, to: number) => QueryBuilder
  limit: (n: number) => QueryBuilder
  single: () => QueryBuilder
  then: (resolve: (value: { data: unknown; error: null; count?: number }) => void) => Promise<unknown>
}

interface SupabaseClient {
  from: (table: string) => QueryBuilder
}

/**
 * Creates a Supabase-compatible client that actually calls our FastAPI backend.
 * This is a drop-in replacement that maps table operations to REST API calls.
 */
function createAPIClient(): SupabaseClient {
  return {
    from(table: string) {
      let method = 'GET'
      let body: unknown = undefined
      let filters: string[] = []
      let selectCols = '*'
      let ordering = ''
      let rangeFrom = 0
      let __rangeTo = 999999
      let limitVal = 0
      let isSingle = false
      let _countMode = ''

      const builder: QueryBuilder = {
        select(columns?: string, opts?: { count?: string }) {
          selectCols = columns || '*'
          if (opts?.count) _countMode = opts.count
          return builder
        },
        insert(data: unknown) {
          method = 'POST'
          body = data
          return builder
        },
        update(data: unknown) {
          method = 'PATCH'
          body = data
          return builder
        },
        delete() {
          method = 'DELETE'
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push(`${col}=eq.${val}`)
          return builder
        },
        neq(col: string, val: unknown) {
          filters.push(`${col}=neq.${val}`)
          return builder
        },
        in(col: string, vals: unknown[]) {
          filters.push(`${col}=in.(${vals.join(',')})`)
          return builder
        },
        ilike(col: string, val: string) {
          filters.push(`${col}=ilike.${val}`)
          return builder
        },
        is(col: string, val: unknown) {
          filters.push(`${col}=is.${val}`)
          return builder
        },
        or(expr: string) {
          filters.push(`or=(${expr})`)
          return builder
        },
        order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
          const dir = opts?.ascending ? 'asc' : 'desc'
          ordering = `${col}.${dir}`
          return builder
        },
        range(from: number, to: number) {
          rangeFrom = from
          _rangeTo = to
          return builder
        },
        limit(n: number) {
          limitVal = n
          return builder
        },
        single() {
          isSingle = true
          limitVal = 1
          return builder
        },
        async then(resolve) {
          // Build the API URL based on table and operation
          const tableEndpoints: Record<string, string> = {
            'videos': '/api/videos',
            'categories': '/api/categories',
            'areas': '/api/taxonomy/areas',
            'topics': '/api/taxonomy/topics',
            'tags': '/api/taxonomy/tag-groups',
            'tag_groups': '/api/taxonomy/tag-groups',
            'video_tags': '/api/videos',
            'video_topics': '/api/videos',
            'video_subcategories': '/api/videos',
            'subcategories': '/api/categories',
            'favorite_authors': '/api/videos/authors',
            'curated_channels': '/api/channels',
          }

          try {
            const endpoint = tableEndpoints[table] || `/api/${table}`
            // For simple table reads, build query params
            const params = new URLSearchParams()
            filters.forEach(f => {
              const [key, ...rest] = f.split('=')
              params.append(key, rest.join('='))
            })
            if (ordering) params.append('order', ordering)
            if (limitVal) params.append('limit', String(limitVal))
            if (rangeFrom > 0) params.append('offset', String(rangeFrom))
            if (selectCols !== '*') params.append('select', selectCols)

            const queryString = params.toString()
            const url = `${API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`

            let data: unknown
            if (method === 'GET') {
              const res = await fetch(url)
              data = await res.json()
            } else {
              const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
              })
              data = await res.json()
            }

            if (isSingle && Array.isArray(data)) {
              data = data[0] || null
            }

            const result = {
              data,
              error: null,
              count: Array.isArray(data) ? (data as unknown[]).length : undefined,
            }
            return resolve(result)
          } catch (error) {
            return resolve({ data: null, error: error as Error, count: 0 } as never)
          }
        },
      }
      return builder
    },
  }
}

// Export both the new API functions and the compatibility client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createAPIClient() as any
export { apiFetch, API_BASE }
