import Viewer3D from './components/Viewer3D'
import Map2D from './components/Map2D'
import Filters from './components/Filters'
import InfoPanel from './components/InfoPanel'
import VisibilityWidget from './components/VisibilityWidget'
import HUDControls from './components/HUDControls'
import SatelliteLayer from './components/SatelliteLayer'
import SatList from './components/SatList'
import useAppStore from './store/useAppStore'
import { useEffect } from 'react'

export default function App() {
  const { mode, sidebarOpen, toggleSidebar, setSidebarOpen, setMode } = useAppStore()
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSidebarOpen(false); return }
      if (e.key === '2') { setMode('2D'); return }
      if (e.key === '3') { setMode('3D'); return }
      const fast = e.shiftKey
      const viewer: any = (window as any).CESIUM_VIEWER
      const map: any = (window as any).LEAFLET_MAP
      if (mode === '2D' && map) {
        const px = fast ? 200 : 100
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') map.panBy([-px, 0])
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') map.panBy([px, 0])
        else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') map.panBy([0, -px])
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') map.panBy([0, px])
        else if (e.key === '+' || e.key === '=') map.zoomIn(fast ? 2 : 1)
        else if (e.key === '-' || e.key === '_') map.zoomOut(fast ? 2 : 1)
      } else if (mode === '3D' && viewer?.camera) {
        const cam = viewer.camera
        const dist = fast ? 2.0e6 : 5.0e5
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') cam.moveLeft(dist)
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') cam.moveRight(dist)
        else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') cam.moveForward(dist)
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') cam.moveBackward(dist)
        else if (e.key === '+' || e.key === '=') cam.moveForward(dist)
        else if (e.key === '-' || e.key === '_') cam.moveBackward(dist)
        else if (e.key === 'r' || e.key === 'R') {
          const angle = (fast ? 20 : 10) * Math.PI / 180
          try { cam.rotateRight(angle) } catch { try { cam.twistRight?.(angle) } catch {} }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=>window.removeEventListener('keydown', onKey)
  }, [mode, setSidebarOpen, setMode])
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



