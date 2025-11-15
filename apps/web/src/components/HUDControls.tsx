import useAppStore from '../store/useAppStore'
import * as Cesium from 'cesium'
export default function HUDControls(){
  const { mode, setMode } = useAppStore()
  return (
    <div className="flex gap-2">
      <button className={`px-2 py-1 rounded ${mode==='3D'?'bg-blue-600':'bg-zinc-800'}`} onClick={()=>setMode('3D')}>3D</button>
      <button className={`px-2 py-1 rounded ${mode==='2D'?'bg-blue-600':'bg-zinc-800'}`} onClick={()=>setMode('2D')}>2D</button>
      <button className="px-2 py-1 rounded bg-zinc-800" onClick={()=>{
        // Ensure we're in 3D before trying to control the Cesium viewer
        if (mode !== '3D') setMode('3D')
        setTimeout(()=>{
          const viewer = (window as any).CESIUM_VIEWER
          if (!viewer) return
          viewer.trackedEntity = undefined
          try {
            viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 0, 42000000), duration: 1.2 })
          } catch {
            if (viewer.camera?.flyHome) viewer.camera.flyHome(1.5)
          }
          try { viewer.resize?.() } catch {}
          try { viewer.scene?.requestRender?.() } catch {}
        }, 120)
      }}>Globe</button>
    </div>
  )
}



