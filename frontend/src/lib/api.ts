/**
 * API client for the FastAPI backend.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export { API_BASE }
