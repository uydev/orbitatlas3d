export interface GP {
  OBJECT_NAME: string
  NORAD_CAT_ID: number
  TLE_LINE1: string
  TLE_LINE2: string
}

export async function fetchActive(limit = 300): Promise<GP[]> {
  // Use the API proxy (avoids CORS). The backend has retries and caching.
  const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
  const url = `${base}/satellites/active?limit=${encodeURIComponent(String(limit))}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as GP[]
  if (!Array.isArray(data)) {
    throw new Error('API returned invalid data format')
  }
  return data.slice(0, limit)
}


