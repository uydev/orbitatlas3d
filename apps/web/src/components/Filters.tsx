import useAppStore from '../store/useAppStore'
import { useState } from 'react'
import { geocode } from '../lib/geocode'

export default function Filters(){
  const { showSatellites, toggleSatellites, satVisualMode, setSatVisualMode, observer, setObserver, overheadOnly, toggleOverheadOnly, showLabels2D, toggleLabels2D, showTracks2D, toggleTracks2D } = useAppStore()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  async function findLocation(){
    if (!query.trim()) return
    setSearching(true)
    try {
      const result = await geocode(query)
      if (result) {
        setObserver({ lat: result.lat, lon: result.lon, name: result.name })
      }
    } finally {
      setSearching(false)
    }
  }
  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded bg-zinc-800">
      <span className="text-xs uppercase tracking-wide opacity-70">Layers</span>
      <button
        className={`px-2 py-1 text-xs font-medium rounded border border-cyan-400/40 transition ${showSatellites ? 'bg-cyan-500/20 text-cyan-200' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700'}`}
        onClick={toggleSatellites}
      >
        {showSatellites ? 'Hide Satellites' : 'Show Satellites'}
      </button>
      <label className="flex items-center gap-2 text-xs opacity-90 select-none">
        <input type="checkbox" checked={overheadOnly} onChange={toggleOverheadOnly} />
        Overhead only
      </label>
      <label className="flex items-center gap-2 text-xs opacity-90 select-none">
        <input type="checkbox" checked={showLabels2D} onChange={toggleLabels2D} />
        Show labels
      </label>
      <label className="flex items-center gap-2 text-xs opacity-90 select-none">
        <input type="checkbox" checked={showTracks2D} onChange={toggleTracks2D} />
        Show tracks
      </label>
      <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
        <input
          className="px-2 py-1 text-xs rounded bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
          placeholder="Postcode or place"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') { void findLocation() } }}
          style={{ width: 180 }}
        />
        <button
          className="px-2 py-1 text-xs font-medium rounded bg-zinc-700 hover:bg-zinc-600"
          onClick={()=>{ void findLocation() }}
          disabled={searching}
          title="Set observer location"
        >
          {searching ? '...' : 'Set'}
        </button>
        {observer && (
          <span className="text-xs opacity-70 ml-1 truncate max-w-[180px]" title={observer.name || ''}>
            {observer.name ? observer.name : `${observer.lat.toFixed(3)}, ${observer.lon.toFixed(3)}`}
          </span>
        )}
      </div>
      {showSatellites && (
        <div className="flex gap-1 border-l border-zinc-700 pl-3">
          <button
            className={`px-2 py-1 text-xs font-medium rounded transition ${
              satVisualMode === 'billboard' 
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40' 
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700 border border-transparent'
            }`}
            onClick={() => setSatVisualMode('billboard')}
            title="Show as icons"
          >
            Icons
          </button>
          <button
            className={`px-2 py-1 text-xs font-medium rounded transition ${
              satVisualMode === 'dot' 
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40' 
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700 border border-transparent'
            }`}
            onClick={() => setSatVisualMode('dot')}
            title="Show as dots"
          >
            Dots
          </button>
        </div>
      )}
    </div>
  )
}



