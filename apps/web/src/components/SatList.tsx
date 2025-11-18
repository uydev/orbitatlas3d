import { useEffect, useMemo, useState } from 'react'
import { fetchActive } from '../lib/celestrak'
import useAppStore, { SatSummary } from '../store/useAppStore'

export default function SatList(){
  const [items, setItems] = useState<SatSummary[]>([])
  const [byId, setById] = useState<Map<number, {name: string; tle1?: string; tle2?: string}>>(new Map())
  const [error, setError] = useState<string|undefined>()
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const { selected, select, satLimit } = useAppStore()

  useEffect(()=>{ void load() },[satLimit])

  async function load(){
    setLoading(true)
    setError(undefined)
    try {
      let list = [] as any[]
      let lastErr: any
      for (let i=0;i<3;i++){
        try {
          list = await fetchActive(satLimit) // respect global sat limit
          if (Array.isArray(list) && list.length>0) break
        } catch(e){ lastErr = e }
        await new Promise(r=>setTimeout(r, (i+1)*800))
      }
      if (!Array.isArray(list) || list.length===0) throw lastErr || new Error('No data')
      const map = new Map<number, {name:string; tle1?: string; tle2?: string}>()
      const mapped = list.map((s:any)=> {
        map.set(s.NORAD_CAT_ID, { name: s.OBJECT_NAME, tle1: s.TLE_LINE1, tle2: s.TLE_LINE2 })
        return { norad_id: s.NORAD_CAT_ID, name: s.OBJECT_NAME }
      })
      setById(map)
      setItems(mapped)
    } catch (e:any) {
      setError(e?.message || 'Failed to load satellites')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(()=>{
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter(s=> 
      s.name.toLowerCase().includes(query) || 
      String(s.norad_id).includes(query)
    )
  }, [q, items])

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


