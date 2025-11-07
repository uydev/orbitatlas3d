import { useEffect, useState } from 'react'
import useAppStore from '../store/useAppStore'
import * as Cesium from 'cesium'
export default function InfoPanel(){
  const { selected } = useAppStore()
  const [coords, setCoords] = useState<{lat:number, lon:number, alt:number}|undefined>()
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    const interval = setInterval(()=>{
      const tracked = viewer.trackedEntity
      const target = tracked || (selected ? viewer.entities.getById(`sat-${selected.norad_id}`) : undefined)
      if (!target || !target.position) { setCoords(undefined); return }
      const time = viewer.clock.currentTime
      const pos = target.position.getValue(time)
      if (!pos) { setCoords(undefined); return }
      const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos)
      if (!carto) { setCoords(undefined); return }
      setCoords({ lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude), alt: carto.height })
    }, 500)
    return ()=>clearInterval(interval)
  }, [selected])
  return (
    <div>
      <h3 className="text-lg font-semibold">Info</h3>
      {!selected && <div className="text-sm opacity-80">Select a satellite to view details.</div>}
      {selected && (
        <div className="mt-2 text-sm">
          <div className="font-medium">{selected.name}</div>
          <div className="opacity-80">NORAD {selected.norad_id}</div>
          {coords && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="opacity-70">Latitude</div><div>{coords.lat.toFixed(4)}°</div>
              <div className="opacity-70">Longitude</div><div>{coords.lon.toFixed(4)}°</div>
              <div className="opacity-70">Altitude</div><div>{(coords.alt/1000).toFixed(1)} km</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}



