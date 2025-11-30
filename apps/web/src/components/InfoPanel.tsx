import { useEffect, useState } from 'react'
import useAppStore from '../store/useAppStore'
import * as Cesium from 'cesium'
import * as sat from 'satellite.js'
export default function InfoPanel(){
  const {
    selected,
    mode,
    orbitPlay,
    setOrbitPlay,
    orbitHorizonHours,
    setOrbitHorizonHours,
    showTracks2D,
    toggleTracks2D,
    resetOrbitPlayback,
    showOnlySelected,
    toggleShowOnlySelected,
    select,
    refreshTracks,
  } = useAppStore()
  const [coords, setCoords] = useState<{lat:number, lon:number, alt:number}|undefined>()
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    // Prefer Cesium positions only when we are actually in 3D mode
    if (mode === '3D' && viewer && viewer.entities && viewer.clock) {
      const interval = setInterval(()=>{
        const tracked = viewer.trackedEntity
        if (!viewer || !viewer.entities || !viewer.clock) {
          setCoords(undefined)
          return
        }
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
    }
    // 2D mode: compute from TLE if available
    if (!selected || !selected.tle1 || !selected.tle2) {
      setCoords(undefined)
      return
    }
    const rec = sat.twoline2satrec(selected.tle1, selected.tle2)
    const interval = setInterval(()=>{
      try {
        const now = new Date()
        const pv = sat.propagate(rec, now)
        if (!pv.position) { setCoords(undefined); return }
        const gmst = sat.gstime(now)
        const gd = sat.eciToGeodetic(pv.position as any, gmst)
        setCoords({
          lat: sat.degreesLat(gd.latitude),
          lon: sat.degreesLong(gd.longitude),
          alt: (gd.height || 0) * 1000
        })
      } catch {
        setCoords(undefined)
      }
    }, 1000)
    return ()=>clearInterval(interval)
  }, [selected, mode])
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
          {mode === '3D' && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold opacity-80">Orbit playback</div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  className={`px-2 py-1 rounded border ${
                    orbitPlay
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-zinc-800 text-zinc-100 border-zinc-600'
                  }`}
                  onClick={()=>{
                    const next = !orbitPlay
                    setOrbitPlay(next)
                    // If starting playback and tracks are currently hidden,
                    // automatically enable tracks so the orbit path is visible.
                    if (next && !showTracks2D) {
                      toggleTracks2D()
                    }
                    // If starting playback, also ensure "Show only selected satellite"
                    // is enabled so we focus on a single object without clutter.
                    if (next && !showOnlySelected) {
                      toggleShowOnlySelected()
                    }
                    // When starting playback in 3D, immediately focus the camera
                    // on the selected satellite so the motion is visible.
                    if (next && mode === '3D' && selected) {
                      const viewer = (window as any).CESIUM_VIEWER
                      try {
                        const ent = viewer?.entities?.getById?.(`sat-${selected.norad_id}`)
                        if (ent && viewer?.camera) {
                          viewer.trackedEntity = undefined
                          viewer.selectedEntity = ent
                          const cameraHeight = viewer.camera.positionCartographic?.height ?? 2.0e6
                          viewer.flyTo(ent, {
                            duration: 1.2,
                            offset: new Cesium.HeadingPitchRange(0, -0.35, Math.max(cameraHeight, 1.5e6)),
                          })
                        }
                      } catch {
                        // best-effort focus; ignore camera errors
                      }
                    }
                    refreshTracks()
                  }}
                >
                  {orbitPlay ? 'Pause orbit' : 'Play orbit'}
                </button>
                <button
                  className="px-2 py-1 rounded border bg-zinc-900 text-zinc-100 border-zinc-600 hover:bg-zinc-800"
                  onClick={()=>{
                    resetOrbitPlayback()
                  }}
                  title="Snap back to the real, current satellite position"
                >
                  Reset
                </button>
                <select
                  className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1"
                  value={String(orbitHorizonHours)}
                  onChange={(e)=>{
                    const h = parseInt(e.target.value, 10) || 12
                    setOrbitHorizonHours(h)
                    // Nudge SatelliteLayer to rebuild the track immediately by
                    // re-emitting the current selection (effect depends on `selected`).
                    if (mode === '3D' && showTracks2D && selected) {
                      select({ ...selected })
                    }
                    refreshTracks()
                  }}
                >
                  <option value="12">Next 12 hours</option>
                  <option value="24">Next 24 hours</option>
                  <option value="48">Next 48 hours</option>
                  <option value="168">Next 7 days</option>
                </select>
              </div>
              <div className="text-xs opacity-70">
                When playing, the satellite animates quickly along its future orbit over the selected window.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}



