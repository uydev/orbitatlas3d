import useAppStore from '../store/useAppStore'
import { useState } from 'react'
import { CONSTELLATION_FILTERS, getConstellationFilterOption, matchesConstellationFilter } from '../lib/constellationFilters'

export default function Filters(){
  const { showSatellites, toggleSatellites, satVisualMode, setSatVisualMode, showLabels2D, toggleLabels2D, showTracks2D, toggleTracks2D, occlude3D, toggleOcclude3D, satLimit, setSatLimit, showOnlySelected, toggleShowOnlySelected, constellationFilter, setConstellationFilter, refreshTracks, selected, select } = useAppStore()
  const [showConfig, setShowConfig] = useState(false)
  const groupedFilters = CONSTELLATION_FILTERS.reduce<Record<string, typeof CONSTELLATION_FILTERS>>((acc, item)=>{
    acc[item.group] = acc[item.group] ? [...acc[item.group], item] : [item]
    return acc
  }, {})
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
        <div className="fixed top-[52px] left-2 z-[2000] bg-zinc-900/95 border border-white/10 rounded p-2 shadow-md">
          <div className="text-xs font-semibold opacity-80 mb-1">Map settings</div>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={showLabels2D} onChange={toggleLabels2D} />
            Show labels
          </label>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={showTracks2D} onChange={toggleTracks2D} />
            Show tracks
          </label>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={occlude3D} onChange={toggleOcclude3D} />
            Hide satellites behind planet (3D)
          </label>
          <label className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <input type="checkbox" checked={showOnlySelected} onChange={toggleShowOnlySelected} />
            Show only selected satellite (2D/3D)
          </label>
          <div className="text-xs opacity-90 select-none py-0.5 space-y-1">
            <span>Constellation filter</span>
            <select
              className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs"
              value={constellationFilter || ''}
              onChange={(e)=>{
                const value = e.target.value || undefined
                setConstellationFilter(value)
                refreshTracks()
                // Auto-enable satellite visibility when a filter is selected
                if (value && !showSatellites) {
                  toggleSatellites()
                }
                if (value && selected) {
                  const option = getConstellationFilterOption(value)
                  const matches = option?.groupId
                    ? matchesConstellationFilter(selected.name || '', value)
                    : matchesConstellationFilter(selected.name || '', value)
                  if (!matches) {
                    select(undefined)
                  }
                }
              }}
            >
              <option value="">All constellations</option>
              {Object.entries(groupedFilters).map(([group, options])=>(
                <optgroup key={group} label={group}>
                  {options.map((opt)=>(
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-90 select-none py-0.5">
            <span>Sat limit</span>
            <select
              className="bg-zinc-800 border border-white/10 rounded px-2 py-1"
              value={String(satLimit)}
              onChange={(e)=>{
                const v = e.target.value
                const n = v === '999999' ? 999999 : parseInt(v, 10)
                if (!isNaN(n)) setSatLimit(n)
              }}
              title="Limit number of satellites rendered"
            >
              <option value="200">200</option>
              <option value="600">600</option>
              <option value="1000">1000</option>
              <option value="3000">3000</option>
              <option value="6000">6000</option>
              <option value="9000">9000</option>
              <option value="999999">MAX</option>
            </select>
          </div>
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



