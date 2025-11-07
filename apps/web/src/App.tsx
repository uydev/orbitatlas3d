import Viewer3D from './components/Viewer3D'
import Map2D from './components/Map2D'
import SearchBar from './components/SearchBar'
import Filters from './components/Filters'
import InfoPanel from './components/InfoPanel'
import VisibilityWidget from './components/VisibilityWidget'
import HUDControls from './components/HUDControls'
import SatelliteLayer from './components/SatelliteLayer'
import SatList from './components/SatList'
import useAppStore from './store/useAppStore'

export default function App() {
  const { mode } = useAppStore()
  return (
    <div className="w-full h-screen bg-black text-white">
      <div className="absolute z-10 p-2 w-full flex gap-2">
        <SearchBar />
        <Filters />
        <HUDControls />
      </div>
      {mode === '3D' ? (
        <>
          <Viewer3D />
          <SatelliteLayer />
        </>
      ) : <Map2D />}
      <div className="absolute right-0 top-0 h-full w-[380px] bg-black/50 backdrop-blur p-3 overflow-y-auto">
        <InfoPanel />
        <SatList />
        <div className="mt-4">
          <VisibilityWidget />
        </div>
      </div>
    </div>
  )
}



