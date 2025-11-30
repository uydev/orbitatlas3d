import { useEffect, useMemo, useState } from 'react'
import { fetchSatellites } from '../lib/celestrak'
import useAppStore, { SatSummary } from '../store/useAppStore'
import { getConstellationFilterOption, matchesConstellationFilter } from '../lib/constellationFilters'

export default function SatList(){
  const [items, setItems] = useState<SatSummary[]>([])
  const [allItems, setAllItems] = useState<SatSummary[]>([]) // Keep all loaded satellites for NORAD ID search
  const [byId, setById] = useState<Map<number, {name: string; tle1?: string; tle2?: string}>>(new Map())
  const [error, setError] = useState<string|undefined>()
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const { selected, select, satLimit, constellationFilter } = useAppStore()

  useEffect(()=>{ void load() },[satLimit, constellationFilter])

  async function load(){
    setLoading(true)
    setError(undefined)
    try {
      let list = [] as any[]
      let lastErr: any
      const option = getConstellationFilterOption(constellationFilter)
      for (let i=0;i<3;i++){
        try {
          list = await fetchSatellites(satLimit, option?.groupId) // Try group endpoint first, fallback to active
          if (Array.isArray(list) && list.length>0) break
        } catch(e){ lastErr = e }
        await new Promise(r=>setTimeout(r, (i+1)*800))
      }
      if (!Array.isArray(list) || list.length===0) throw lastErr || new Error('No data')
      // Don't filter here - we'll filter after storing all items so NORAD ID search works
      const map = new Map<number, {name:string; tle1?: string; tle2?: string}>()
      const allMapped = list.map((s:any)=> {
        const id = Number(s.NORAD_CAT_ID)
        map.set(id, { name: s.OBJECT_NAME, tle1: s.TLE_LINE1, tle2: s.TLE_LINE2 })
        return { norad_id: id, name: s.OBJECT_NAME }
      })
      setById(map)
      setAllItems(allMapped) // Store all satellites
      
      // Apply constellation filter to items
      const filteredMapped = constellationFilter 
        ? allMapped.filter(s => matchesConstellationFilter(s.name, constellationFilter))
        : allMapped
        
      // If we fell back to a large dataset (e.g. 10000), we should trim the list 
      // to the user's requested limit (e.g. 600) for performance, BUT only after filtering.
      // This ensures we show "600 Starlink satellites" rather than "0 Starlink satellites found in the first 600 active ones".
      const finalItems = filteredMapped.slice(0, satLimit)
      
      setItems(finalItems)
      
      if (constellationFilter && selected && !filteredMapped.some((s)=>s.norad_id === selected.norad_id)) {
        select(undefined)
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to load satellites')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(()=>{
    const query = q.trim()
    if (!query) return items
    
    // If query is all digits, it's likely a NORAD ID search
    // For NORAD ID searches, search in ALL loaded satellites (not just filtered by constellation)
    // This allows finding any satellite by ID even if it doesn't match the current filter
    const isNoradIdSearch = /^\d+$/.test(query)
    const searchItems = isNoradIdSearch ? allItems : items
    
    const queryLower = query.toLowerCase()
    return searchItems.filter(s=> {
      const nameMatch = s.name.toLowerCase().includes(queryLower)
      const noradMatch = String(s.norad_id).includes(query) // Use original query for NORAD ID (preserves leading zeros if any)
      return nameMatch || noradMatch
    })
  }, [q, items, allItems])

  return (
    <div className="mt-3 text-sm">
      <div className="font-medium mb-1">Satellites</div>
      <input
        className="w-full mb-2 px-2 py-1 rounded bg-zinc-800"
        placeholder="Search name or NORAD..."
        value={q} onChange={e=>setQ(e.target.value)}
      />
      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800 rounded border border-zinc-800">
        {loading && <div className="px-2 py-2 opacity-70">Loading…</div>}
        {error && !loading && (
          <div className="px-2 py-2">
            <div className="text-red-400 text-xs mb-2">{error}</div>
            <button className="px-2 py-1 rounded bg-zinc-800" onClick={()=>load()}>Retry</button>
          </div>
        )}
        {filtered.map(s=> (
          <button key={s.norad_id} className={`w-full text-left px-2 py-1 hover:bg-zinc-800 ${selected?.norad_id===s.norad_id?'bg-zinc-800':''}`} onClick={()=>{
            const extra = byId.get(s.norad_id)
            select({ norad_id: s.norad_id, name: s.name, tle1: extra?.tle1, tle2: extra?.tle2 })
          }}>
            <div className="font-medium">{s.name}</div>
            <div className="opacity-70">NORAD {s.norad_id}</div>
          </button>
        ))}
        {!loading && !error && filtered.length===0 && <div className="px-2 py-2 opacity-70">No results</div>}
      </div>
    </div>
  )
}


