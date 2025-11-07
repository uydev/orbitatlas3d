export interface GP {
  OBJECT_NAME: string
  NORAD_CAT_ID: number
  TLE_LINE1: string
  TLE_LINE2: string
}

export async function fetchActive(limit = 300): Promise<GP[]> {
  // Strategy: use the API proxy only (avoids CORS). The backend has retries and caching.
  const tryDirect = async (): Promise<GP[]> => { throw new Error('direct disabled') }
  const tryProxy = async (): Promise<GP[]> => {
    const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
    const url = `${base}/satellites/active?limit=${encodeURIComponent(String(limit))}`
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`proxy ${res.status}`)
    return (await res.json()) as GP[]
  }
  let data: GP[] | undefined
  try {
    data = await tryDirect()
  } catch {
    try { data = await tryProxy() } catch (e) { throw e }
  }
  return (data || []).slice(0, limit)
}


