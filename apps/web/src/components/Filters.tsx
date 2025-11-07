import useAppStore from '../store/useAppStore'

export default function Filters(){
  const { showSatellites, toggleSatellites } = useAppStore()
  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded bg-zinc-800">
      <span className="text-xs uppercase tracking-wide opacity-70">Layers</span>
      <button
        className={`px-2 py-1 text-xs font-medium rounded border border-cyan-400/40 transition ${showSatellites ? 'bg-cyan-500/20 text-cyan-200' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700'}`}
        onClick={toggleSatellites}
      >
        {showSatellites ? 'Hide Satellites' : 'Show Satellites'}
      </button>
    </div>
  )
}



