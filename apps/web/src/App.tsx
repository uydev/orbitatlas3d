import Viewer3D from './components/Viewer3D'
import Map2D from './components/Map2D'
import Filters from './components/Filters'
import InfoPanel from './components/InfoPanel'
import VisibilityWidget from './components/VisibilityWidget'
import HUDControls from './components/HUDControls'
import SatelliteLayer from './components/SatelliteLayer'
import SatList from './components/SatList'
import useAppStore from './store/useAppStore'

export default function App() {
  const { mode, sidebarOpen, toggleSidebar } = useAppStore()
  return (
    <div className="w-full h-screen bg-black text-white">
      <div className="absolute z-[3000] p-2 w-full flex gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <Filters />
        </div>
        <div className="pointer-events-auto">
          <HUDControls />
        </div>
      </div>
      {/* Always render both, use CSS to show/hide */}
      <div className={mode === '3D' ? 'w-full h-full' : 'hidden'}>
        <Viewer3D />
        <SatelliteLayer />
      </div>
      <div className={mode === '2D' ? 'absolute inset-0' : 'hidden'} style={{ top: '48px' }}>
        <Map2D />
      </div>
      {/* Sidebar toggle button - always visible on right edge */}
      <button
        onClick={toggleSidebar}
        className={`absolute top-1/2 -translate-y-1/2 z-20 px-2 py-4 bg-black/70 hover:bg-black/90 backdrop-blur rounded-l-lg border border-white/20 transition-all ${
          sidebarOpen ? 'right-[380px]' : 'right-0'
        }`}
        title={sidebarOpen ? 'Hide panel' : 'Show panel'}
      >
        <span className="text-white text-sm">{sidebarOpen ? '◀' : '▶'}</span>
      </button>
      {/* Sidebar panel */}
      <div className={`absolute right-0 top-0 h-full w-[380px] bg-black/50 backdrop-blur p-3 overflow-y-auto transition-transform duration-300 z-[1000] ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Satellite Info</h2>
          <button
            onClick={toggleSidebar}
            className="text-white/70 hover:text-white px-2 py-1 rounded"
            title="Close panel"
          >
            ✕
          </button>
        </div>
        <InfoPanel />
        <SatList />
        <div className="mt-4">
          <VisibilityWidget />
        </div>
      </div>
    </div>
  )
}



