import { useEffect } from 'react'
import { CallbackProperty, Cartesian2, Cartesian3, Color, HeadingPitchRange, JulianDate, NearFarScalar, VerticalOrigin, LabelStyle } from 'cesium'
import * as sat from 'satellite.js'
import { fetchActive } from '../lib/celestrak'
import useAppStore from '../store/useAppStore'
const SAT_PREFIX = 'sat-'
interface Props { ids?: number[] }
export default function SatelliteLayer({ ids }: Props){
  const { selected, showSatellites, satVisualMode, select, showLabels2D, occlude3D, satLimit } = useAppStore()
  useEffect(() => {
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    try {
      viewer.scene.globe.depthTestAgainstTerrain = !!occlude3D
    } catch {}
    const clearSatellites = () => {
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
    if (!showSatellites) {
      clearSatellites()
      return
    }
    clearSatellites()
    const createdIds: string[] = []
    async function addSatellites() {
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
          
          viewer.entities.add({
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
  }, [ids, showSatellites, satVisualMode, select, showLabels2D, occlude3D, satLimit])
  // Track selected satellite
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    if (selected) {
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
    }
  }, [selected])
  return null
}



