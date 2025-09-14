// src/components/ReportMap.jsx
import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Vite-friendly imports for the default Leaflet icon assets
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Initialize default icon once (safe even if called multiple times)
;(function initLeafletDefaultIcon() {
  try {
    // avoid re-setting if already done
    if (!L.Icon.Default.prototype.options.iconUrl || L.Icon.Default.prototype.options.iconUrl === '') {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
      })
    }
  } catch (err) {
    // don't break the app if something goes wrong
    // eslint-disable-next-line no-console
    console.warn('ReportMap: failed to initialize leaflet default icon', err)
  }
})()

function SetViewAndResize({ coords, zoom = 15 }) {
  const map = useMap()
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!coords) return
    try {
      const lat = Number(coords[0]), lng = Number(coords[1])
      if (!isFinite(lat) || !isFinite(lng)) {
        console.warn('ReportMap: invalid coords passed to SetViewAndResize', coords)
        return
      }
      map.setView([lat, lng], zoom)
      // small delay helps when map is inside a modal or animated container
      timeoutRef.current = setTimeout(() => {
        try { map.invalidateSize() } catch (e) { /* ignore */ }
      }, 200)
    } catch (e) {
      // ignore runtime errors
      // eslint-disable-next-line no-console
      console.warn('ReportMap: SetViewAndResize error', e)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [coords, map, zoom])

  return null
}

export default function ReportMap({ coords, zoom = 15, style = { height: 360, width: '100%' } }) {
  const center = coords && coords.length === 2 && isFinite(Number(coords[0])) && isFinite(Number(coords[1]))
    ? [Number(coords[0]), Number(coords[1])]
    : [20, 0]

  return (
    <div className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={coords ? zoom : 3} style={style} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {coords && isFinite(Number(coords[0])) && isFinite(Number(coords[1])) && (
          <Marker position={[Number(coords[0]), Number(coords[1])]} />
        )}
        <SetViewAndResize coords={coords} zoom={zoom} />
      </MapContainer>
    </div>
  )
}
