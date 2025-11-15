import useAppStore from '../store/useAppStore'
import { useState } from 'react'

export default function Filters(){
  const { showSatellites, toggleSatellites, satVisualMode, setSatVisualMode, showLabels2D, toggleLabels2D, showTracks2D, toggleTracks2D } = useAppStore()
  const [showConfig, setShowConfig] = useState(false)
  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded bg-zinc-800 relative">
      <span className="text-xs uppercase tracking-wide opacity-70">Layers</span>
      <button
        className={`px-2 py-1 text-xs font-medium rounded border border-cyan-400/40 transition ${showSatellites ? 'bg-cyan-500/20 text-cyan-200' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700'}`}
        onClick={toggleSatellites}
      >
        {showSatellites ? 'Hide Satellites' : 'Show Satellites'}
      </button>
      <button
        className="px-2 py-1 text-xs font-medium rounded bg-zinc-900 hover:bg-zinc-700 border border-white/10"
        onClick={()=>setShowConfig(v=>!v)}
        title="Map settings"
        aria-label="Map settings"
      >
        ⚙
      </button>
      {showConfig && (
        <div className="absolute top-[110%] left-2 z-50 bg-zinc-900/95 border border-white/10 rounded p-2 shadow-md">
          <div className="text-xs font-semibold opacity-80 mb-1">Map settings</div>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={showLabels2D} onChange={toggleLabels2D} />
            Show labels
          </label>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={showTracks2D} onChange={toggleTracks2D} />
            Show tracks
          </label>
        </div>
      )}
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



