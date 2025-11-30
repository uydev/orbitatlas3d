export interface GP {
  OBJECT_NAME: string
  NORAD_CAT_ID: number
  TLE_LINE1: string
  TLE_LINE2: string
}

// Helper function to add timeout to fetch
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

export async function fetchSatellites(limit = 300, group?: string): Promise<GP[]> {
  const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  
  // Try group endpoint first if group is provided (Space-Track will handle it if credentials are available)
  // Fallback to /satellites/active if group endpoint fails or times out
  let url: string
  if (group) {
    const normalizedGroup = group.toUpperCase()
    url = `${base}/satellites/group/${encodeURIComponent(normalizedGroup)}?${params.toString()}`
  } else {
    url = `${base}/satellites/active?${params.toString()}`
  }
  console.log(url)
  
  let res: Response
  try {
    // Use shorter timeout for group endpoint (15 seconds) to fail fast and fallback
    const timeout = group ? 15000 : 30000
    res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, timeout)
    if (!res.ok) {
      // If group endpoint fails, fallback to active + client-side filtering
      if (group && (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 500)) {
        console.warn(`Group endpoint failed (${res.status}), falling back to /satellites/active with client-side filtering`)
        // On fallback, we MUST fetch a large set to ensure the target group is included
        const fallbackLimit = Math.max(parseInt(String(limit)), 10000)
        const paramsFallback = new URLSearchParams()
        paramsFallback.set('limit', String(fallbackLimit))
        const fallbackUrl = `${base}/satellites/active?${paramsFallback.toString()}`
        console.log(fallbackUrl)
        res = await fetchWithTimeout(fallbackUrl, { headers: { accept: 'application/json' } }, 30000)
        if (!res.ok) {
          throw new Error(`API request failed: ${res.status} ${res.statusText}`)
        }
      } else {
        const error: any = new Error(`API request failed: ${res.status} ${res.statusText}`)
        error.status = res.status
        error.isGatewayError = res.status === 502 || res.status === 503 || res.status === 504
        throw error
      }
    }
  } catch (e: any) {
    // Network error or timeout - fallback to active if we were trying group
    if (group) {
      console.warn(`Group endpoint error/timeout, falling back to /satellites/active:`, e.message)
      // On fallback, we MUST fetch a large set to ensure the target group is included
      const fallbackLimit = Math.max(parseInt(String(limit)), 10000)
      const paramsFallback = new URLSearchParams()
      paramsFallback.set('limit', String(fallbackLimit))
      const fallbackUrl = `${base}/satellites/active?${paramsFallback.toString()}`
      console.log(fallbackUrl)
      try {
        res = await fetchWithTimeout(fallbackUrl, { headers: { accept: 'application/json' } }, 30000)
        if (!res.ok) {
          throw new Error(`API request failed: ${res.status} ${res.statusText}`)
        }
      } catch (fallbackError: any) {
        throw new Error(`Both group endpoint and fallback failed: ${e.message}, ${fallbackError.message}`)
      }
    } else {
      throw e
    }
  }
  
  const data = (await res.json()) as any[]
  if (!Array.isArray(data)) {
    throw new Error('API returned invalid data format')
  }
  // Normalize the data: ensure NORAD_CAT_ID is a number and map field names
  return data.slice(0, limit).map((item) => ({
    OBJECT_NAME: item.OBJECT_NAME || '',
    NORAD_CAT_ID: typeof item.NORAD_CAT_ID === 'string' ? parseInt(item.NORAD_CAT_ID, 10) : (item.NORAD_CAT_ID || 0),
    TLE_LINE1: item.TLE_LINE1 || '',
    TLE_LINE2: item.TLE_LINE2 || '',
  })).filter((item) => item.NORAD_CAT_ID > 0 && item.TLE_LINE1 && item.TLE_LINE2)
}


