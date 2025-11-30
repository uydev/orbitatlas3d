export interface GeocodeResult {
  lat: number
  lon: number
  name: string
}

export async function geocode(query: string): Promise<GeocodeResult | undefined> {
  const q = query.trim()
  if (!q) return undefined
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  })
  if (!res.ok) return undefined
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return undefined
  const item = data[0]
  const lat = parseFloat(item.lat)
  const lon = parseFloat(item.lon)
  if (!isFinite(lat) || !isFinite(lon)) return undefined
  return { lat, lon, name: item.display_name || q }
}


