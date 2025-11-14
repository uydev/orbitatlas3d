import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as sat from 'satellite.js'
import { fetchActive } from '../lib/celestrak'
import useAppStore from '../store/useAppStore'

// Fix for default marker icons in Leaflet with Vite
// We'll use circle markers instead, so we don't need the default icon fix

export default function Map2D() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<number, L.Layer>>(new Map())
  const observerMarkerRef = useRef<L.Layer | null>(null)
  const tracksRef = useRef<Map<number, L.Polyline>>(new Map())
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(0)
  const { selected, select, showSatellites, mode, observer, overheadOnly, showLabels2D, showTracks2D, satVisualMode, sidebarOpen, toggleSidebar } = useAppStore()
  function getIcon(selected: boolean){
    const size = selected ? 26 : 20
    const cls = selected ? 'oa-sat-icon oa-sat-icon--selected' : 'oa-sat-icon'
    return L.divIcon({
      className: '',
      html: `<div class="${cls}" style="width:${size}px;height:${size}px"></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    })
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }
    
    if (mapRef.current) {
      return
    }

    const initializeMap = () => {
      if (!mapContainerRef.current || mapRef.current) {
        return
      }

      const container = mapContainerRef.current
      const width = container.offsetWidth
      const height = container.offsetHeight

      if (width === 0 || height === 0) {
        setTimeout(initializeMap, 200)
        return
      }

      try {
        const map = L.map(container, {
          center: [0, 0],
          zoom: 2,
          minZoom: 2,
          maxZoom: 10,
        })

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        mapRef.current = map

        // Invalidate size to ensure map renders correctly
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getContainer()) {
            try {
              mapRef.current.invalidateSize()
            } catch (e) {
              // Silently fail
            }
          }
        }, 300)
      } catch (e) {
        console.error('Error creating map:', e)
      }
    }

    // Try to initialize immediately or wait for layout
    if (mapContainerRef.current.offsetWidth > 0 && mapContainerRef.current.offsetHeight > 0) {
      initializeMap()
    } else {
      setTimeout(initializeMap, 200)
    }

    return () => {
      // Don't clean up map - keep it alive for mode switching
      // Only clean up on actual unmount
    }
  }, [])

  // Invalidate map size when mode changes to 2D (map becomes visible)
  useEffect(() => {
    if (mode === '2D' && mapRef.current) {
      // Small delay to ensure container is visible
      setTimeout(() => {
        if (mapRef.current) {
          try {
            mapRef.current.invalidateSize()
          } catch (e) {
            // Silently fail
          }
        }
      }, 100)
    }
  }, [mode])

  // Fetch and display satellites
  useEffect(() => {
    if (!mapRef.current) return
    
    if (!showSatellites) {
      // Clear markers if satellites are hidden
      markersRef.current.forEach((marker) => {
        mapRef.current?.removeLayer(marker)
      })
      markersRef.current.clear()
      tracksRef.current.forEach((line)=>mapRef.current?.removeLayer(line))
      tracksRef.current.clear()
      return
    }

    setLoading(true)
    const map = mapRef.current

    async function loadSatellites() {
      try {
        const sats = await fetchActive(600) // SAT LIMIT
        if (!sats || sats.length === 0) {
          console.warn('No satellites returned from API')
          setLoading(false)
          return
        }

        // Clear existing markers
        markersRef.current.forEach((marker) => {
          map.removeLayer(marker as any)
        })
        markersRef.current.clear()
        tracksRef.current.forEach((line)=>map.removeLayer(line))
        tracksRef.current.clear()

        const now = new Date()
        const gmst = sat.gstime(now)

        // Add satellites to map
        sats.forEach((s) => {
          try {
            if (!s.TLE_LINE1 || !s.TLE_LINE2) {
              return
            }

            const rec = sat.twoline2satrec(s.TLE_LINE1, s.TLE_LINE2)
            
            // Validate TLE record
            if (!rec || rec.error) {
              return
            }
            
            const positionAndVelocity = sat.propagate(rec, now)

            if (positionAndVelocity.position && !positionAndVelocity.error) {
              const positionEci = positionAndVelocity.position as sat.EciVec3<number>
              const positionGd = sat.eciToGeodetic(positionEci, gmst)

              let lat = sat.degreesLat(positionGd.latitude)
              let lon = sat.degreesLong(positionGd.longitude)
              const alt = positionGd.height / 1000 // Convert to km

              // If observer and overheadOnly are set, compute elevation at observer and filter
              if (observer && overheadOnly) {
                try {
                  const satEcf = sat.eciToEcf(positionEci, gmst)
                  const obs = {
                    longitude: observer.lon * Math.PI / 180,
                    latitude: observer.lat * Math.PI / 180,
                    height: 0
                  }
                  const look = sat.ecfToLookAngles(obs as any, satEcf as any)
                  const elevDeg = look.elevation * 180 / Math.PI
                  if (elevDeg <= 0) {
                    return
                  }
                } catch {
                  // ignore visibility calc failures
                }
              }

              // Validate coordinates are valid numbers
              if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) {
                console.warn(`Invalid coordinates for satellite ${s.NORAD_CAT_ID}: lat=${lat}, lon=${lon}`)
                return
              }

              // Validate latitude is within valid range [-90, 90]
              if (lat < -90 || lat > 90) {
                console.warn(`Latitude out of range for satellite ${s.NORAD_CAT_ID}: ${lat}`)
                return
              }

              // Normalize longitude to [-180, 180]
              if (lon < -180 || lon > 180) {
                lon = ((lon % 360) + 360) % 360
                if (lon > 180) {
                  lon = lon - 360
                }
                // Final check after normalization
                if (lon < -180 || lon > 180) {
                  console.warn(`Longitude normalization failed for satellite ${s.NORAD_CAT_ID}: original=${sat.degreesLong(positionGd.longitude)}, normalized=${lon}`)
                  return
                }
              }

              let marker: L.Layer
              if (satVisualMode === 'dot') {
                marker = L.circleMarker([lat, lon], {
                  radius: 4,
                  fillColor: observer ? '#88e0ff' : '#66ccff',
                  color: '#ffffff',
                  weight: 1,
                  opacity: 0.8,
                  fillOpacity: 0.6,
                })
              } else {
                marker = L.marker([lat, lon], { icon: getIcon(false), zIndexOffset: 100 })
              }
              if (showLabels2D) {
                marker.bindTooltip(s.OBJECT_NAME || String(s.NORAD_CAT_ID), {
                  permanent: true,
                  direction: 'top',
                  offset: L.point(0, -8),
                  className: 'leaflet-sat-label'
                })
              }

              // No popup; selection displayed in side panel

              // Handle click to select satellite
              ;(marker as any).on?.('click', () => {
                // Open the side panel if it is closed to mirror 3D UX
                if (!sidebarOpen) toggleSidebar()
                select({
                  norad_id: s.NORAD_CAT_ID,
                  name: s.OBJECT_NAME || 'Unknown',
                  tle1: s.TLE_LINE1,
                  tle2: s.TLE_LINE2,
                })
              })

              ;(marker as any).addTo(map)
              markersRef.current.set(s.NORAD_CAT_ID, marker)

              // Optional ground track (simple forward-only, short)
              if (showTracks2D) {
                try {
                  const points: [number, number][] = []
                  for (let minutes = 0; minutes <= 30; minutes += 2) {
                    const t = new Date(now.getTime() + minutes * 60 * 1000)
                    const gmstStep = sat.gstime(t)
                    const pv2 = sat.propagate(rec, t)
                    if (pv2.position) {
                      const gd2 = sat.eciToGeodetic(pv2.position as any, gmstStep)
                      const lat2 = sat.degreesLat(gd2.latitude)
                      let lon2 = sat.degreesLong(gd2.longitude)
                      if (lon2 < -180 || lon2 > 180) {
                        lon2 = ((lon2 % 360) + 360) % 360
                        if (lon2 > 180) lon2 -= 360
                      }
                      points.push([lat2, lon2])
                    }
                  }
                  if (points.length >= 2) {
                    const line = L.polyline(points, { color: '#00ffff', opacity: 0.5, weight: 1 })
                    line.addTo(map)
                    tracksRef.current.set(s.NORAD_CAT_ID, line)
                  }
                } catch {}
              }
            }
          } catch (e) {
            console.warn(`Error processing satellite ${s.NORAD_CAT_ID}:`, e)
          }
        })

        setVisibleCount(markersRef.current.size)

        // Expose select function to window for popup buttons
        // Legacy helper no longer used (popups removed), keep as no-op safe bridge
        ;(window as any).selectSatellite = (noradId: number, name: string, tle1?: string, tle2?: string) => {
          if (!sidebarOpen) toggleSidebar()
          select({ norad_id: noradId, name, tle1, tle2 })
        }

        setLoading(false)
      } catch (e) {
        console.error('Failed to fetch satellites:', e)
        setLoading(false)
      }
    }

    loadSatellites()

    // Update satellite positions periodically
    const interval = setInterval(() => {
      if (showSatellites && mapRef.current) {
        loadSatellites()
      }
    }, 60000) // Update every minute

    return () => {
      clearInterval(interval)
      // Cleanup window function
      delete (window as any).selectSatellite
    }
  }, [showSatellites, select, observer, overheadOnly, showLabels2D, showTracks2D])

  // Show observer marker and recenter
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Remove existing
    if (observerMarkerRef.current) {
      map.removeLayer(observerMarkerRef.current)
      observerMarkerRef.current = null
    }
    if (!observer) return
    const marker = L.circleMarker([observer.lat, observer.lon], {
      radius: 6,
      fillColor: '#ffd800',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    })
    marker.bindPopup(`<div style="font-size:12px;"><strong>Observer</strong><br/>${observer.name || ''}</div>`)
    marker.addTo(map)
    observerMarkerRef.current = marker
    try {
      map.setView([observer.lat, observer.lon], Math.max(map.getZoom(), 4))
    } catch {}
  }, [observer])

  // Highlight selected satellite
  useEffect(() => {
    if (!mapRef.current || !selected) return

    markersRef.current.forEach((marker, noradId) => {
      if ((marker as any).setStyle) {
        if (noradId === selected.norad_id) {
          ;(marker as L.CircleMarker).setStyle({
            radius: 6,
            fillColor: '#ffd800',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          })
          ;(marker as any).openPopup?.()
          mapRef.current?.setView((marker as L.CircleMarker).getLatLng(), Math.max(mapRef.current.getZoom(), 4))
        } else {
          ;(marker as L.CircleMarker).setStyle({
            radius: 4,
            fillColor: '#66ccff',
            color: '#ffffff',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          })
        }
      } else if ((marker as any).setIcon) {
        if (noradId === selected.norad_id) {
          ;(marker as L.Marker).setIcon(getIcon(true))
          ;(marker as any).openPopup?.()
          mapRef.current?.setView((marker as L.Marker).getLatLng(), Math.max(mapRef.current.getZoom(), 4))
        } else {
          ;(marker as L.Marker).setIcon(getIcon(false))
        }
      }
    })
  }, [selected])

  return (
    <div className="w-full h-full relative">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
      />
      {(loading && showSatellites) && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm z-50">Loading satellites...</div>
      )}
      {showSatellites && !loading && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm z-50 space-y-1">
          <div>Satellites on map: {visibleCount}</div>
          {overheadOnly && !observer && (
            <div className="opacity-80">Set a location to use “Overhead only”.</div>
          )}
          {overheadOnly && observer && visibleCount === 0 && (
            <div className="opacity-80">No satellites above the horizon right now at {observer.name || `${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`}</div>
          )}
          {overheadOnly && observer && visibleCount > 0 && (
            <div className="opacity-80">Overhead at {observer.name || `${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`}</div>
          )}
        </div>
      )}
    </div>
  )
}
