// src/pages/MapTest.jsx
import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// import marker assets so Vite can bundle them
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Initialize default Leaflet icons at module load so they exist before the first render.
// Using an IIFE ensures this runs immediately (Vite-friendly).
;(function initLeafletIcons() {
  try {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    })
  } catch (err) {
    // don't crash the app if mergeOptions is not available for some reason
    // eslint-disable-next-line no-console
    console.warn('Leaflet icon init failed:', err)
  }
})()

// Small helper component to set view and invalidate size after mount.
// Useful when the map container may have been hidden before rendering.
function SetViewAndResize({ center, zoom = 12 }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !center) return
    try {
      map.setView(center, zoom)
      // slight delay helps if the container had CSS transitions or just mounted
      const t = setTimeout(() => {
        try {
          map.invalidateSize()
        } catch (e) {
          /* ignore */
        }
      }, 50)
      return () => clearTimeout(t)
    } catch (e) {
      // ignore runtime errors here
    }
  }, [map, center, zoom])
  return null
}

export default function MapTest() {
  // Default center: New Delhi
  const center = [28.6139, 77.2090]
  const mapRef = useRef(null)

  useEffect(() => {
    // No-op: this effect exists so you can add dev-only checks later.
    // If you want to force a resize from outside, you can call:
    // setTimeout(() => mapRef.current?.invalidateSize(), 100)
  }, [])

  return (
    <section className="p-5" aria-label="Leaflet test map">
      <h2 className="mb-3 text-xl font-medium">Leaflet Test Map</h2>

      <div className="h-[620px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          whenCreated={(mapInstance) => {
            // store instance and trigger a small invalidateSize to avoid blank maps
            mapRef.current = mapInstance
            setTimeout(() => {
              try {
                mapInstance.invalidateSize()
              } catch (e) {
                // ignore
              }
            }, 50)
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <Marker position={center}>
            <Popup>Delhi</Popup>
          </Marker>

          <SetViewAndResize center={center} zoom={12} />
        </MapContainer>
      </div>
    </section>
  )
}
