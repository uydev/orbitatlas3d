import { useEffect, useState } from 'react'
import { fetchSatList } from '../lib/tleClient'
import useAppStore, { SatSummary } from '../store/useAppStore'

export default function SatList(){
  const [items, setItems] = useState<SatSummary[]>([])
  const { selected, select } = useAppStore()

  useEffect(()=>{
    fetchSatList({}).then(setItems).catch(()=>setItems([]))
  },[])

  return (
    <div className="mt-3 text-sm">
      <div className="font-medium mb-1">Satellites</div>
      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800 rounded border border-zinc-800">
        {items.map(s=> (
          <button key={s.norad_id} className={`w-full text-left px-2 py-1 hover:bg-zinc-800 ${selected?.norad_id===s.norad_id?'bg-zinc-800':''}`} onClick={()=>select(s)}>
            <div className="font-medium">{s.name}</div>
            <div className="opacity-70">NORAD {s.norad_id}</div>
          </button>
        ))}
        {items.length===0 && <div className="px-2 py-2 opacity-70">No satellites</div>}
      </div>
    </div>
  )
}


