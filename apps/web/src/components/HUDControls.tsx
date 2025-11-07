import useAppStore from '../store/useAppStore'
export default function HUDControls(){
  const { mode, setMode } = useAppStore()
  return (
    <div className="flex gap-2">
      <button className={`px-2 py-1 rounded ${mode==='3D'?'bg-blue-600':'bg-zinc-800'}`} onClick={()=>setMode('3D')}>3D</button>
      <button className={`px-2 py-1 rounded ${mode==='2D'?'bg-blue-600':'bg-zinc-800'}`} onClick={()=>setMode('2D')}>2D</button>
      <button className="px-2 py-1 rounded bg-zinc-800" onClick={()=>{
        const viewer = (window as any).CESIUM_VIEWER
        if (!viewer) return
        viewer.trackedEntity = undefined
        if (viewer.camera.flyHome) viewer.camera.flyHome(1.5)
      }}>Globe</button>
    </div>
  )
}



