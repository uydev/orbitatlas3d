import { useEffect } from 'react'
import { CallbackProperty, Cartesian2, Cartesian3, Color, HeadingPitchRange, JulianDate, NearFarScalar, VerticalOrigin, LabelStyle } from 'cesium'
import * as sat from 'satellite.js'
import { fetchSatellites } from '../lib/celestrak'
import useAppStore from '../store/useAppStore'
import { getConstellationFilterOption, matchesConstellationFilter } from '../lib/constellationFilters'
const SAT_PREFIX = 'sat-'
interface Props { ids?: number[] }
export default function SatelliteLayer({ ids }: Props){
  const { selected, showSatellites, satVisualMode, select, showLabels2D, showTracks2D, occlude3D, satLimit, showOnlySelected, setSimulationTime, orbitPlay, orbitHorizonHours, trackRefreshToken, constellationFilter, toggleSatellites } = useAppStore()
  
  // Auto-enable satellites when a filter is selected
  useEffect(() => {
    if (constellationFilter && !showSatellites) {
      console.log('[SatelliteLayer] Auto-enabling satellites for filter:', constellationFilter)
      toggleSatellites()
    }
  }, [constellationFilter, showSatellites, toggleSatellites])
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
    // Helper to remove any existing track polyline / beacon entities
    const clearTrack = () => {
      try {
        const existing = viewer.entities.getById('selected-track')
        if (existing) viewer.entities.remove(existing)
      } catch {}
      try {
        const beacon = viewer.entities.getById('selected-track-beacon')
        if (beacon) viewer.entities.remove(beacon)
      } catch {}
    }

    // Drive shared simulation time from Cesium's clock (real time, but centralized)
    const tickSimTime = () => {
      try {
        const now = JulianDate.toDate(viewer.clock.currentTime)
        setSimulationTime(now)
      } catch {}
    }
    tickSimTime()
    const simInterval = setInterval(tickSimTime, 1000)

    // If a filter is selected, force satellites to be visible
    if (constellationFilter && !showSatellites) {
      console.log('[SatelliteLayer] Filter selected but satellites hidden - this should not happen (auto-enable should have triggered)')
    }
    if (!showSatellites) {
      clearSatellites()
      clearTrack()
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
            const list = await fetchSatellites(Math.max(1000, satLimit))
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
      const filterOption = getConstellationFilterOption(constellationFilter)
      console.log(`[SatelliteLayer] Fetching satellites: filter=${constellationFilter || 'none'}, groupId=${filterOption?.groupId || 'none'}, limit=${satLimit}`)
      let sats
      let usedGroupEndpoint = false
      let needsClientSideFilter = true  // Always use client-side filtering as primary method
      
      // When filtering is needed, always fetch a large set for reliable client-side filtering
      const clientSideLimit = constellationFilter ? Math.max(satLimit, 10000) : satLimit
      
      try {
        // Try group endpoint as optimization (with short timeout), but always fallback to client-side
        if (filterOption?.groupId) {
          try {
            // Try group endpoint - if it works quickly, great, otherwise fallback
            sats = await fetchSatellites(satLimit, filterOption.groupId)
            
            if (sats && sats.length > 0 && sats.length < 500) {
              // Got reasonable number of results from group endpoint - use it
              usedGroupEndpoint = true
              needsClientSideFilter = false
              console.log(`[SatelliteLayer] Successfully fetched ${sats.length} satellites from group endpoint for "${filterOption.groupId}"`)
            } else {
              // Got too many results or empty - fallback to client-side
              throw new Error(`Group endpoint returned ${sats?.length || 0} results (expected < 500)`)
            }
          } catch (groupError: any) {
            console.warn(`[SatelliteLayer] Group endpoint failed/timeout for ${filterOption.groupId}, using client-side filtering:`, groupError?.message || groupError)
            // Fall through to client-side filtering
            needsClientSideFilter = true
          }
        }
        
        // Use client-side filtering (either no groupId or group endpoint failed)
        if (needsClientSideFilter) {
          console.log(`[SatelliteLayer] Fetching ${clientSideLimit} satellites for client-side filtering`)
          sats = await fetchSatellites(clientSideLimit)
        }
      } catch (e: any) {
        console.error('[SatelliteLayer] Failed to fetch satellites:', e)
        return
      }
      if (!sats || sats.length === 0) {
        console.warn('[SatelliteLayer] No satellites returned from API')
        return
      }
      if (usedGroupEndpoint && !needsClientSideFilter) {
        console.log(`[SatelliteLayer] Using server-filtered results: ${sats.length} satellites from group "${filterOption?.groupId}"`)
        // Log sample names to verify filtering worked
        if (sats.length > 0 && sats.length <= 5) {
          console.log(`[SatelliteLayer] Sample satellite names:`, sats.slice(0, 5).map(s => s.OBJECT_NAME))
        } else if (sats.length > 5) {
          console.log(`[SatelliteLayer] Sample satellite names (first 5):`, sats.slice(0, 5).map(s => s.OBJECT_NAME))
        }
      } else {
        console.log(`[SatelliteLayer] Fetched ${sats.length} active satellites, will filter client-side for "${constellationFilter || 'all'}"`)
        // Log sample names to help debug filtering
        if (sats.length > 0) {
          const sampleNames = sats.slice(0, 10).map(s => s.OBJECT_NAME)
          console.log(`[SatelliteLayer] Sample satellite names (first 10):`, sampleNames)
        }
      }
      let focused = false
      let addedCount = 0
      let skippedCount = 0
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
          // Apply client-side filtering
          // If group endpoint was used and worked well (few results), trust server filtering
          // Otherwise, always apply client-side filtering as backup
          let passesFilter = false
          if (!constellationFilter) {
            // No filter - show all
            passesFilter = true
          } else if (usedGroupEndpoint && !needsClientSideFilter && sats.length < 100) {
            // Server filtered successfully (got few results) - trust it, but still allow selected sat through
            passesFilter = true
          } else {
            // Client-side name matching (always use when fallback happened or when no groupId)
            const name = s.OBJECT_NAME || ''
            passesFilter = matchesConstellationFilter(name, constellationFilter) ||
              (selected && selected.norad_id === s.NORAD_CAT_ID)
            if (passesFilter && addedCount < 5) {
              // Log first few matching names to verify filtering is working
              console.log(`[SatelliteLayer] ✓ Match: "${name}" matches filter "${constellationFilter}"`)
            }
            if (!passesFilter && skippedCount < 3) {
              // Log first few non-matching names to help debug
              console.log(`[SatelliteLayer] Sample non-match: "${name}" doesn't contain keywords for filter "${constellationFilter}"`)
            }
          }
          if (!passesFilter) {
            skippedCount++
            continue
          }
          addedCount++
          
          // Create position callback that supports optional orbit playback
          let lastSampleTime: Date | undefined
          let lastResetCounter = useAppStore.getState().orbitResetCounter
          const position = new CallbackProperty((time: any) => {
            try {
              const nowCb = JulianDate.toDate(time || viewer.clock.currentTime)
              const state = useAppStore.getState()
              if (state.orbitResetCounter !== lastResetCounter) {
                lastResetCounter = state.orbitResetCounter
                lastSampleTime = undefined
              }
              let sampleTime = nowCb
              const isSelected = !!state.selected && state.selected.norad_id === s.NORAD_CAT_ID
              if (isSelected && state.orbitPlay && state.showTracks2D) {
                const horizonMinutes = Math.max(30, Math.min(state.orbitHorizonHours * 60, 7 * 24 * 60))
                const periodSec = 10
                const tNorm = ((Date.now() / 1000) / periodSec) % 1
                const minutesAhead = tNorm * horizonMinutes
                sampleTime = new Date(nowCb.getTime() + minutesAhead * 60 * 1000)
                lastSampleTime = sampleTime
              } else if (isSelected && lastSampleTime && state.showTracks2D) {
                sampleTime = lastSampleTime
              }
              const pv = sat.propagate(rec, sampleTime)
              if (!pv.position || pv.error) {
                return Cartesian3.fromDegrees(0, 0, 0)
              }
              const gmstCb = sat.gstime(sampleTime)
              const geodetic = sat.eciToGeodetic(pv.position as any, gmstCb)
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
        } catch (e) {
          console.warn(`Failed to add satellite ${s.OBJECT_NAME || s.NORAD_CAT_ID}:`, e)
        }
      }
      console.log(`[SatelliteLayer] Summary: Added ${addedCount} entities, skipped ${skippedCount} (total fetched: ${sats.length}, filter: ${constellationFilter || 'none'})`)
      if (addedCount === 0 && constellationFilter) {
        console.warn(`[SatelliteLayer] WARNING: No satellites match filter "${constellationFilter}". Try selecting a different constellation or check if satellites exist for this filter.`)
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
      clearTrack()
      clearInterval(simInterval)
    }
  }, [ids, showSatellites, satVisualMode, showLabels2D, showTracks2D, occlude3D, satLimit, showOnlySelected, orbitHorizonHours, trackRefreshToken, constellationFilter, select])
  // Track selected satellite and handle single-sat mode without rebuilding bulk layer
  useEffect(()=>{
    const viewer = (window as any).CESIUM_VIEWER
    if (!viewer) return

    // Track polyline helper – visualizes trajectory for the selected satellite only
    const clearTrack = () => {
      try {
        const existing = viewer.entities.getById('selected-track')
        if (existing) viewer.entities.remove(existing)
      } catch {}
      try {
        const beacon = viewer.entities.getById('selected-track-beacon')
        if (beacon) viewer.entities.remove(beacon)
      } catch {}
    }

    if (!selected) {
      clearTrack()
      return
    }
    if (showOnlySelected) {
      // Render just the selected satellite using its TLE (or fetch it), then fly
          const renderSingle = (tle1: string, tle2: string) => {
        try { viewer.entities.removeAll() } catch {}
        try {
          const rec = sat.twoline2satrec(tle1, tle2)
          let lastSampleTime: Date | undefined
          let lastResetCounter = useAppStore.getState().orbitResetCounter
          const position = new CallbackProperty((time: any) => {
            try {
              const now = JulianDate.toDate(time || viewer.clock.currentTime)
              const state = useAppStore.getState()
              // Clear any cached playback position when reset is pressed
              if (state.orbitResetCounter !== lastResetCounter) {
                lastResetCounter = state.orbitResetCounter
                lastSampleTime = undefined
              }
              // Real-time position by default
              let sampleTime = now
              if (state.orbitPlay && state.showTracks2D) {
                const horizonMinutes = Math.max(30, Math.min(state.orbitHorizonHours * 60, 7 * 24 * 60))
                const periodSec = 10 // one full playback loop every 10 seconds
                const tNorm = ((Date.now() / 1000) / periodSec) % 1 // 0..1
                const minutesAhead = tNorm * horizonMinutes
                sampleTime = new Date(now.getTime() + minutesAhead * 60 * 1000)
                lastSampleTime = sampleTime
              } else if (lastSampleTime && state.showTracks2D) {
                // When paused (orbitPlay false but tracks still visible), hold the
                // last animated position instead of snapping back to real time.
                sampleTime = lastSampleTime
              }
              const pv = sat.propagate(rec, sampleTime)
              if (!pv.position || pv.error) return Cartesian3.fromDegrees(0,0,0)
              const gmst = sat.gstime(sampleTime)
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
          // Build a static trajectory polyline if tracks are enabled.
          // The visible segment is based on the selected orbit horizon.
          if (showTracks2D) {
            try {
              const now = new Date()
              const positions: Cartesian3[] = []
              const horizonMinutes = Math.max(30, Math.min(orbitHorizonHours * 60, 7 * 24 * 60))
              for (let minutes = 0; minutes <= horizonMinutes; minutes += 4) {
                const t = new Date(now.getTime() + minutes * 60 * 1000)
                const pv = sat.propagate(rec, t)
                if (!pv.position) continue
                const gmst = sat.gstime(t)
                const geodetic = sat.eciToGeodetic(pv.position as any, gmst)
                const lat = geodetic.latitude * 180 / Math.PI
                const lon = geodetic.longitude * 180 / Math.PI
                const alt = geodetic.height * 1000
                positions.push(Cartesian3.fromDegrees(lon, lat, alt))
              }
              if (positions.length >= 2) {
                clearTrack()
                // Base orbit line
                viewer.entities.add({
                  id: 'selected-track',
                  polyline: {
                    positions,
                    width: 1.5,
                    material: Color.fromBytes(255, 216, 0, 220),
                    clampToGround: false
                  }
                })
              }
            } catch {}
          } else {
            clearTrack()
          }

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
            const list = await fetchSatellites(Math.max(1000, satLimit))
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

    // In normal (bulk) mode, add/remove trajectory for selected satellite only
    if (showTracks2D && selected.tle1 && selected.tle2) {
      try {
        const rec = sat.twoline2satrec(selected.tle1, selected.tle2)
        const now = new Date()
        const positions: Cartesian3[] = []
        const horizonMinutes = Math.max(30, Math.min(orbitHorizonHours * 60, 7 * 24 * 60))
        for (let minutes = 0; minutes <= horizonMinutes; minutes += 4) {
          const t = new Date(now.getTime() + minutes * 60 * 1000)
          const pv = sat.propagate(rec, t)
          if (!pv.position) continue
          const gmst = sat.gstime(t)
          const geodetic = sat.eciToGeodetic(pv.position as any, gmst)
          const lat = geodetic.latitude * 180 / Math.PI
          const lon = geodetic.longitude * 180 / Math.PI
          const alt = geodetic.height * 1000
          positions.push(Cartesian3.fromDegrees(lon, lat, alt))
        }
        if (positions.length >= 2) {
          clearTrack()
          viewer.entities.add({
            id: 'selected-track',
            polyline: {
              positions,
              width: 1.5,
              material: Color.fromBytes(255, 216, 0, 220),
              clampToGround: false
            }
          })
        }
      } catch {
        clearTrack()
      }
    } else {
      clearTrack()
    }
  }, [selected, showOnlySelected, satVisualMode, showLabels2D, showTracks2D, occlude3D, satLimit, orbitPlay, orbitHorizonHours, trackRefreshToken, constellationFilter])
  return null
}



