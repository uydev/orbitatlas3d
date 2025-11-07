import { useEffect } from 'react'
import { CallbackProperty, Cartesian3, Color, JulianDate } from 'cesium'
import * as sat from 'satellite.js'
import { fetchSatList, fetchTLE } from '../lib/tleClient'
import useAppStore from '../store/useAppStore'
interface Props { ids?: number[] }
export default function SatelliteLayer({ ids }: Props){
  const { selected } = useAppStore()
  useEffect(() => {
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    const createdIds: string[] = []
    async function addSatellites() {
      const sats = ids?.length ? ids.map(norad_id => ({ norad_id, name: String(norad_id) })) : await fetchSatList({})
      for (const s of sats) {
        try {
          const tle = await fetchTLE(s.norad_id)
          const rec = sat.twoline2satrec(tle.line1, tle.line2)
          const position = new CallbackProperty(() => {
            const now = new Date(JulianDate.toDate(viewer.clock.currentTime))
            const pv = sat.propagate(rec, now)
            if (!pv.position) return undefined
            const gmst = sat.gstime(now)
            const geodetic = sat.eciToGeodetic(pv.position, gmst)
            const lat = geodetic.latitude * 180/Math.PI
            const lon = geodetic.longitude * 180/Math.PI
            const alt = geodetic.height * 1000
            return Cartesian3.fromDegrees(lon, lat, alt)
          }, false)
          const id = `sat-${s.norad_id}`
          createdIds.push(id)
          viewer.entities.add({
            id,
            name: s.name,
            position,
            point: { pixelSize: 6, color: Color.CYAN, outlineColor: Color.BLACK, outlineWidth: 1 },
            // Attempt model if available in /public/models/<norad_id>.glb
            model: { uri: `/models/${s.norad_id}.glb`, scale: 1.0, silhouetteColor: Color.BLACK, silhouetteSize: 1 }
          })
        } catch {
          // ignore individual failures
        }
      }
      if (createdIds.length > 0) {
        const e = viewer.entities.getById(createdIds[0])
        if (e) viewer.trackedEntity = e
      }
    }
    addSatellites()
    return () => {
      for (const id of createdIds) {
        const e = viewer.entities.getById(id)
        if (e) viewer.entities.remove(e)
      }
    }
  }, [ids])
  // Track selected satellite
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return
    if (selected) {
      const e = viewer.entities.getById(`sat-${selected.norad_id}`)
      if (e) viewer.trackedEntity = e
    }
  }, [selected])
  return null
}



