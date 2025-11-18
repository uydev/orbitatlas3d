import { useEffect } from 'react'
import { CallbackProperty, Cartesian2, Cartesian3, Color, HeadingPitchRange, JulianDate, NearFarScalar, VerticalOrigin, LabelStyle } from 'cesium'
import * as sat from 'satellite.js'
import { fetchActive } from '../lib/celestrak'
import useAppStore from '../store/useAppStore'
const SAT_PREFIX = 'sat-'
interface Props { ids?: number[] }
export default function SatelliteLayer({ ids }: Props){
  const { selected, showSatellites, satVisualMode, select, showLabels2D, occlude3D, satLimit, showOnlySelected } = useAppStore()
  useEffect(() => {
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    try {
      viewer.scene.globe.depthTestAgainstTerrain = !!occlude3D
    } catch {}
    const clearSatellites = () => {
      try {
        // Fast path: our scene uses entities only for satellites
        viewer.entities.removeAll()
      } catch {
        // Fallback: remove by prefix
        const toRemove: string[] = []
        viewer.entities.values.forEach((entity: any) => {
          if (typeof entity.id === 'string' && entity.id.startsWith(SAT_PREFIX)) {
            toRemove.push(entity.id)
          }
        })
        toRemove.forEach((id)=>{
          const e = viewer.entities.getById(id)
          if (e) viewer.entities.remove(e)
        })
      }
    }
    if (!showSatellites) {
      clearSatellites()
      return
    }
    try { viewer.selectedEntity = undefined; viewer.trackedEntity = undefined } catch {}
    clearSatellites()
    const createdIds: string[] = []
    async function addSatellites() {
      // If only selected is requested, draw just that entity when TLEs exist
      if (showOnlySelected) {
        if (selected?.tle1 && selected?.tle2) {
          try {
            const rec = sat.twoline2satrec(selected.tle1, selected.tle2)
            const position = new CallbackProperty((time: any) => {
              try {
                const now = JulianDate.toDate(time || viewer.clock.currentTime)
                const pv = sat.propagate(rec, now)
                if (!pv.position || pv.error) return Cartesian3.fromDegrees(0,0,0)
                const gmst = sat.gstime(now)
                const geodetic = sat.eciToGeodetic(pv.position, gmst)
                const lat = geodetic.latitude * 180/Math.PI
                const lon = geodetic.longitude * 180/Math.PI
                const alt = geodetic.height * 1000
                return Cartesian3.fromDegrees(lon, lat, alt)
              } catch { return Cartesian3.fromDegrees(0,0,0) }
            }, false)
            const id = `${SAT_PREFIX}${selected.norad_id}`
            const ent = viewer.entities.add({
              id,
              name: selected.name,
              position,
              point: {
                show: satVisualMode === 'dot',
                pixelSize: 4,
                color: Color.CYAN,
                outlineColor: Color.BLACK,
                outlineWidth: 1,
                scaleByDistance: new NearFarScalar(5.0e4, 1.0, 3.0e7, 0.5),
                disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
              },
              label: {
                show: !!showLabels2D,
                text: selected.name,
                font: '14px "JetBrains Mono", "Fira Mono", monospace',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 3,
                style: LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cartesian2(0, -58),
                scaleByDistance: new NearFarScalar(5.0e4, 1.4, 3.0e7, 0.22),
                disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
              },
              billboard: {
                show: satVisualMode === 'billboard',
                image: '/icons/satellite.svg',
                width: 56,
                height: 56,
                color: Color.CYAN,
                verticalOrigin: VerticalOrigin.CENTER,
                pixelOffset: new Cartesian2(0, -24),
                scaleByDistance: new NearFarScalar(5.0e4, 1.5, 3.0e7, 0.28),
                disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
              }
            })
            // Focus camera on the newly added selected entity
            try {
              viewer.selectedEntity = ent
              const doFly = () => {
                const cameraHeight = viewer.camera?.positionCartographic?.height ?? 2.0e6
                viewer.flyTo(ent, {
                  duration: 1.2,
                  offset: new HeadingPitchRange(0, -0.35, Math.max(cameraHeight, 1.5e6))
                })
              }
              // Ensure entity is in scene graph
              requestAnimationFrame(()=>{ try { doFly() } catch {} })
            } catch {}
            return
          } catch {
            // fall through to bulk load if single build fails
          }
        } else if (selected?.norad_id) {
          // Try to fetch and locate TLEs for just the selected from the API
          try {
            const list = await fetchActive(Math.max(1000, satLimit))
            const s = list.find((x:any)=> x.NORAD_CAT_ID === selected.norad_id)
            if (s?.TLE_LINE1 && s?.TLE_LINE2) {
              select({ norad_id: s.NORAD_CAT_ID, name: s.OBJECT_NAME, tle1: s.TLE_LINE1, tle2: s.TLE_LINE2 })
              // re-enter effect on next run
            }
          } catch {}
          return
        } else {
          // No selection: show nothing
          return
        }
      }
      let sats
      try {
        sats = await fetchActive(satLimit) // SAT LIMIT
      } catch (e) {
        console.error('Failed to fetch satellites:', e)
        return
      }
      if (!sats || sats.length === 0) {
        console.warn('No satellites returned from API')
        return
      }
      console.log(`Adding ${sats.length} satellites to viewer`)
      let focused = false
      for (const s of sats) {
        try {
          if (!s.TLE_LINE1 || !s.TLE_LINE2) {
            console.warn(`Missing TLE for ${s.OBJECT_NAME || s.NORAD_CAT_ID}`)
            continue
          }
          const rec = sat.twoline2satrec(s.TLE_LINE1, s.TLE_LINE2)
          if (!rec || rec.error) {
            console.warn(`Invalid TLE for ${s.OBJECT_NAME || s.NORAD_CAT_ID}`)
            continue
          }
          
          // Create position callback that always returns a valid position
          const position = new CallbackProperty((time: any) => {
            try {
              const now = JulianDate.toDate(time || viewer.clock.currentTime)
              const pv = sat.propagate(rec, now)
              if (!pv.position || pv.error) {
                // Return a default position if propagation fails
                return Cartesian3.fromDegrees(0, 0, 0)
              }
              const gmst = sat.gstime(now)
              const geodetic = sat.eciToGeodetic(pv.position, gmst)
              const lat = geodetic.latitude * 180/Math.PI
              const lon = geodetic.longitude * 180/Math.PI
              const alt = geodetic.height * 1000
              return Cartesian3.fromDegrees(lon, lat, alt)
            } catch (e) {
              console.warn(`Position calculation error for ${s.OBJECT_NAME}:`, e)
              return Cartesian3.fromDegrees(0, 0, 0)
            }
          }, false)
          
          const id = `${SAT_PREFIX}${s.NORAD_CAT_ID}`
          createdIds.push(id)
          
          // Create entity without path to avoid getValueInReferenceFrame issues
          // Path rendering conflicts with CallbackProperty position updates
          const showBillboard = satVisualMode === 'billboard'
          const showDot = satVisualMode === 'dot'
          const showLabel = !!showLabels2D
          
          const ent = viewer.entities.add({
            id,
            name: s.OBJECT_NAME,
            position,
            point: {
              show: showDot,
              pixelSize: 4,
              color: Color.CYAN,
              outlineColor: Color.BLACK,
              outlineWidth: 1,
              scaleByDistance: new NearFarScalar(5.0e4, 1.0, 3.0e7, 0.5),
              disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
            },
            label: {
              show: showLabel,
              text: s.OBJECT_NAME,
              font: '14px "JetBrains Mono", "Fira Mono", monospace',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cartesian2(0, -58),
              scaleByDistance: new NearFarScalar(5.0e4, 1.4, 3.0e7, 0.22),
              disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
            },
            billboard: {
              show: showBillboard,
              image: '/icons/satellite.svg',
              width: 56,
              height: 56,
              color: Color.CYAN,
              verticalOrigin: VerticalOrigin.CENTER,
              pixelOffset: new Cartesian2(0, -24),
              scaleByDistance: new NearFarScalar(5.0e4, 1.5, 3.0e7, 0.28),
              disableDepthTestDistance: occlude3D ? 0.0 : 1.0e8
            }
            // Path removed - causes getValueInReferenceFrame error with CallbackProperty
            // Can be added later using a different approach (sampled position property)
          })
          // If this entity is the currently selected, focus immediately
          if (!focused && selected && selected.norad_id === s.NORAD_CAT_ID) {
            focused = true
            try {
              viewer.selectedEntity = ent
              const doFly = () => {
                const cameraHeight = viewer.camera?.positionCartographic?.height ?? 2.0e6
                viewer.flyTo(ent, {
                  duration: 1.2,
                  offset: new HeadingPitchRange(0, -0.35, Math.max(cameraHeight, 1.5e6))
                })
              }
              requestAnimationFrame(()=>{ try { doFly() } catch {} })
            } catch {}
          }
        } catch {
          // ignore individual failures
        }
      }
      viewer.trackedEntity = undefined
    }
    addSatellites()
    // Sync Cesium selection -> global store so 3D -> 2D works
    const onSelectedChanged = () => {
      try {
        const ent = viewer.selectedEntity
        if (!ent || typeof ent.id !== 'string') return
        if (!ent.id.startsWith(SAT_PREFIX)) return
        const norad = parseInt(ent.id.slice(SAT_PREFIX.length), 10)
        if (Number.isFinite(norad)) {
          select({ norad_id: norad, name: ent.name || String(norad) })
        }
      } catch {
        // ignore
      }
    }
    viewer.selectedEntityChanged?.addEventListener?.(onSelectedChanged)
    return () => {
      try { viewer.selectedEntityChanged?.removeEventListener?.(onSelectedChanged) } catch {}
      clearSatellites()
    }
  }, [ids, showSatellites, satVisualMode, showLabels2D, occlude3D, satLimit, showOnlySelected, select])
  // Track selected satellite and handle single-sat mode without rebuilding bulk layer
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    if (!selected) return
    if (showOnlySelected) {
      // Render just the selected satellite using its TLE (or fetch it), then fly
      const renderSingle = (tle1: string, tle2: string) => {
        try { viewer.entities.removeAll() } catch {}
        try {
          const rec = sat.twoline2satrec(tle1, tle2)
          const position = new CallbackProperty((time: any) => {
            try {
              const now = JulianDate.toDate(time || viewer.clock.currentTime)
              const pv = sat.propagate(rec, now)
              if (!pv.position || pv.error) return Cartesian3.fromDegrees(0,0,0)
              const gmst = sat.gstime(now)
              const geodetic = sat.eciToGeodetic(pv.position, gmst)
              const lat = geodetic.latitude * 180/Math.PI
              const lon = geodetic.longitude * 180/Math.PI
              const alt = geodetic.height * 1000
              return Cartesian3.fromDegrees(lon, lat, alt)
            } catch { return Cartesian3.fromDegrees(0,0,0) }
          }, false)
          const ent = viewer.entities.add({
            id: `${SAT_PREFIX}${selected.norad_id}`,
            name: selected.name,
            position,
            point: { show: satVisualMode==='dot', pixelSize:4, color: Color.CYAN, outlineColor: Color.BLACK, outlineWidth:1, disableDepthTestDistance: occlude3D?0:1.0e8 },
            label: { show: !!showLabels2D, text: selected.name, font:'14px "JetBrains Mono", "Fira Mono", monospace', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth:3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cartesian2(0,-58), disableDepthTestDistance: occlude3D?0:1.0e8 },
            billboard: { show: satVisualMode==='billboard', image:'/icons/satellite.svg', width:56, height:56, color: Color.CYAN, verticalOrigin: VerticalOrigin.CENTER, pixelOffset: new Cartesian2(0,-24), disableDepthTestDistance: occlude3D?0:1.0e8 }
          })
          requestAnimationFrame(()=>{ try {
            viewer.selectedEntity = ent
            const cameraHeight = viewer.camera?.positionCartographic?.height ?? 2.0e6
            viewer.flyTo(ent, { duration: 1.2, offset: new HeadingPitchRange(0, -0.35, Math.max(cameraHeight, 1.5e6)) })
          } catch {} })
        } catch {}
      }
      if (selected.tle1 && selected.tle2) {
        renderSingle(selected.tle1, selected.tle2)
      } else {
        // Try to resolve TLEs for the selected
        ;(async ()=>{
          try {
            const list = await fetchActive(Math.max(1000, satLimit))
            const s = list.find((x:any)=> x.NORAD_CAT_ID === selected.norad_id)
            if (s?.TLE_LINE1 && s?.TLE_LINE2) {
              renderSingle(s.TLE_LINE1, s.TLE_LINE2)
            }
          } catch {}
        })()
      }
      return
    }
    // Normal mode: just focus existing entity
    const entityId = `${SAT_PREFIX}${selected.norad_id}`
    const e = viewer.entities.getById(entityId)
    if (e) {
      viewer.trackedEntity = undefined
      viewer.selectedEntity = e
      const cameraHeight = viewer.camera?.positionCartographic?.height ?? 2.0e6
      viewer.flyTo(e, {
        duration: 1.6,
        offset: new HeadingPitchRange(0, -0.35, Math.max(cameraHeight, 1.5e6))
      })
    }
  }, [selected, showOnlySelected, satVisualMode, showLabels2D, occlude3D, satLimit])
  return null
}



