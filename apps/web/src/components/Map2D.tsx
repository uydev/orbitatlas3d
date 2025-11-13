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
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map())
  const [loading, setLoading] = useState(true)
  const { selected, select, showSatellites, mode } = useAppStore()

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
          map.removeLayer(marker)
        })
        markersRef.current.clear()

        const now = new Date()
        const jday = sat.jday(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds()
        )

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
            
            const positionAndVelocity = sat.propagate(rec, jday)

            if (positionAndVelocity.position && !positionAndVelocity.error) {
              const positionEci = positionAndVelocity.position as sat.EciVec3<number>
              const gmst = sat.gstime(jday)
              const positionGd = sat.eciToGeodetic(positionEci, gmst)

              let lat = sat.degreesLat(positionGd.latitude)
              let lon = sat.degreesLong(positionGd.longitude)
              const alt = positionGd.height / 1000 // Convert to km

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

              // Create circle marker
              const marker = L.circleMarker([lat, lon], {
                radius: 4,
                fillColor: '#66ccff',
                color: '#ffffff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6,
              })

              // Add popup with satellite info
              const popup = L.popup({
                maxWidth: 200,
              }).setContent(`
                <div style="font-size: 12px;">
                  <strong>${s.OBJECT_NAME || 'Unknown'}</strong><br/>
                  NORAD: ${s.NORAD_CAT_ID}<br/>
                  Alt: ${alt.toFixed(1)} km<br/>
                  <button 
                    style="margin-top: 4px; padding: 2px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;"
                    onclick="window.selectSatellite(${s.NORAD_CAT_ID}, '${s.OBJECT_NAME?.replace(/'/g, "\\'") || 'Unknown'}')"
                  >
                    Select
                  </button>
                </div>
              `)

              marker.bindPopup(popup)

              // Handle click to select satellite
              marker.on('click', () => {
                select({
                  norad_id: s.NORAD_CAT_ID,
                  name: s.OBJECT_NAME || 'Unknown',
                })
              })

              marker.addTo(map)
              markersRef.current.set(s.NORAD_CAT_ID, marker)
            }
          } catch (e) {
            console.warn(`Error processing satellite ${s.NORAD_CAT_ID}:`, e)
          }
        })

        // Expose select function to window for popup buttons
        ;(window as any).selectSatellite = (noradId: number, name: string) => {
          select({ norad_id: noradId, name })
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
  }, [showSatellites, select])

  // Highlight selected satellite
  useEffect(() => {
    if (!mapRef.current || !selected) return

    markersRef.current.forEach((marker, noradId) => {
      if (noradId === selected.norad_id) {
        marker.setStyle({
          radius: 6,
          fillColor: '#ffd800',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        })
        marker.openPopup()
        mapRef.current?.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 4))
      } else {
        marker.setStyle({
          radius: 4,
          fillColor: '#66ccff',
          color: '#ffffff',
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.6,
        })
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
      {loading && showSatellites && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm z-50">
          Loading satellites...
        </div>
      )}
    </div>
  )
}
