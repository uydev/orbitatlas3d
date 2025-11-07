import { useEffect } from 'react'
import { initCesium } from '../lib/cesiumInit'
export default function Viewer3D(){
  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string
    const viewer = initCesium('cesium-container', token)
    ;(window as any).CESIUM_VIEWER = viewer
    return () => {
      viewer?.destroy()
      ;(window as any).CESIUM_VIEWER = undefined
    }
  }, [])
  return <div id="cesium-container" className="w-full h-full" />
}



