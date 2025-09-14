// src/pages/MapView.jsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Vite-friendly imports of Leaflet marker assets so bundler resolves them
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Ensure default icons are set once (Vite-friendly)
;(function initLeafletIcons() {
  try {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    })
  } catch (err) {
    console.warn('Leaflet icon init failed', err)
  }
})()

function coloredSvgIcon(color = '#2563eb') {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42" fill="none">
      <path d="M14 0C8.5 0 4 4.5 4 10c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="${color}"/>
      <circle cx="14" cy="12" r="4.2" fill="white" opacity="0.92"/>
    </svg>
  `)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${svg}`

  return L.icon({
    iconUrl: dataUrl,
    iconRetinaUrl: dataUrl,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -40],
    shadowUrl,
    shadowSize: [41, 41],
    shadowAnchor: [14, 41],
  })
}

const STATUS_TO_COLOR = {
  high_priority: '#ef4444',
  submitted: '#f59e0b',
  acknowledged: '#60a5fa',
  in_progress: '#3b82f6',
  resolved: '#10b981',
  your_location: '#6366f1',
}

function statusLabelFromKey(key) {
  if (!key) return 'Unknown'
  const k = String(key).toLowerCase()
  switch (k) {
    case 'high_priority':
      return 'High Priority'
    case 'submitted':
      return 'Submitted'
    case 'acknowledged':
      return 'Acknowledged'
    case 'in_progress':
      return 'In Progress'
    case 'resolved':
      return 'Resolved'
    case 'your_location':
      return 'Your Location'
    default:
      return k.replace(/_/g, ' ')
  }
}

function parseCoords(r) {
  // tolerate many possible key names and formats
  if (!r) return [null, null]
  const latCandidates = [
    r.location_lat,
    r.locationLatitude,
    r.locationLat,
    r.lat,
    r.latitude,
    r.coords?.lat,
  ]
  const lngCandidates = [
    r.location_lng,
    r.locationLongitude,
    r.locationLng,
    r.lng,
    r.longitude,
    r.coords?.lng,
  ]

  for (let i = 0; i < Math.max(latCandidates.length, lngCandidates.length); i++) {
    const la = latCandidates[i]
    const lo = lngCandidates[i]
    const nla = la != null ? Number(la) : null
    const nlo = lo != null ? Number(lo) : null
    if (isFinite(nla) && isFinite(nlo)) return [nla, nlo]
  }

  // fallback: parse "lat,lng" string in various properties
  const possibleStrings = [r.location, r.location_text, r.coords, r.coordsString, r.coords_str, r.coordsString]
  for (const s of possibleStrings) {
    if (!s) continue
    const str = typeof s === 'string' ? s : String(s)
    const m = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
    if (m) return [parseFloat(m[1]), parseFloat(m[2])]
  }

  return [null, null]
}

export default function MapView() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const mapRef = useRef(null)

  // API base: prefer VITE_API_BASE if set, otherwise relative
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : ''

  useEffect(() => {
    let mounted = true
    const ac = new AbortController()

    async function loadReports() {
      setLoading(true)
      setError(null)
      try {
        // FETCH THE PUBLIC ENDPOINT (no auth)
        const res = await fetch(`${API_BASE || ''}/api/public/reports`, { signal: ac.signal })
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = await res.json()

        // Accept both: raw array OR { data: [...] } wrapper
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []

        console.debug('MapView: fetched reports payload', { raw: data, count: arr.length })

        const normalized = arr.map((r) => {
          const [lat, lng] = parseCoords(r)
          return {
            ...r,
            location_lat: lat ?? (r.location_lat ?? null),
            location_lng: lng ?? (r.location_lng ?? null),
            created_at: r.created_at ?? r.createdAt ?? r.date ?? null,
          }
        })

        const withCoords = normalized.filter((r) => {
          const lat = Number(r.location_lat)
          const lng = Number(r.location_lng)
          return isFinite(lat) && isFinite(lng)
        })

        console.debug(`MapView: reports with coords ${withCoords.length} out of ${normalized.length}`)

        if (mounted) setReports(withCoords)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('MapView: failed to load reports', err)
          if (mounted) setError(err.message || 'Failed to load reports')
          if (mounted) setReports([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadReports()
    return () => {
      mounted = false
      ac.abort()
    }
  }, [API_BASE])

  // user geolocation (non-blocking)
  useEffect(() => {
    if (!navigator.geolocation) return
    let mounted = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mounted) return
        setUserPos([pos.coords.latitude, pos.coords.longitude])
      },
      () => {
        /* ignore permission denied */
      }
    )
    return () => {
      mounted = false
    }
  }, [])

  // fit bounds to reports + userPos when they change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const points = []
    for (const r of reports) {
      const lat = Number(r.location_lat)
      const lng = Number(r.location_lng)
      if (isFinite(lat) && isFinite(lng)) points.push([lat, lng])
    }
    if (userPos && userPos.length === 2) points.push(userPos)
    if (points.length === 0) return
    try {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } catch (err) {
      console.warn('MapView: fitBounds failed', err)
    }
  }, [reports, userPos])

  const defaultCenter = [28.6139, 77.209]
  const center =
    userPos ||
    (reports.length ? [Number(reports[0].location_lat), Number(reports[0].location_lng)] : defaultCenter)

  function buildPhotoUrl(src) {
    if (!src) return null
    if (/^https?:\/\//i.test(src)) return src
    if (typeof window === 'undefined') return src
    return src.startsWith('/') ? `${window.location.origin}${src}` : `${window.location.origin}/${src}`
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Map */}
      <div className="flex-1 bg-white rounded-2xl p-4 border shadow-sm map-wrapper">
        <div style={{ height: 640 }} className="rounded-lg overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">Loading map…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-500 flex-col">
              <div className="text-lg font-semibold">Failed to load reports</div>
              <div className="mt-2 text-sm">{error}</div>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              whenCreated={(mapInstance) => {
                mapRef.current = mapInstance
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* User position circle */}
              {userPos && (
                <Circle
                  center={userPos}
                  radius={40}
                  pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.12 }}
                />
              )}

              {/* Render only non-quarantined reports (they were filtered on server) */}
              {reports.map((r) => {
                const lat = Number(r.location_lat)
                const lng = Number(r.location_lng)
                if (!isFinite(lat) || !isFinite(lng)) return null

                const st = (r.status || 'submitted').toString().toLowerCase()
                const color = STATUS_TO_COLOR[st] || STATUS_TO_COLOR.submitted
                const icon = coloredSvgIcon(color)

                return (
                  <Marker key={r.id ?? `${lat}-${lng}`} position={[lat, lng]} icon={icon}>
                    <Popup>
                      <div style={{ maxWidth: 280 }}>
                        <div style={{ fontWeight: 600 }}>{((r.type || 'Issue') + '').replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>{r.description || r.title || 'No description'}</div>

                        {r.photo_url ? (
                          <img
                            src={buildPhotoUrl(r.photo_url)}
                            alt="report"
                            style={{ width: '100%', marginTop: 8, borderRadius: 6, objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}

                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          Status: <strong>{r.status ?? 'submitted'}</strong>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          Reported: {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          )}
        </div>
      </div>

      {/* Sidebar / Legend */}
      <aside className="w-full lg:w-80 space-y-4">
        <div className="bg-white rounded-2xl p-4 border shadow-sm">
          <h3 className="font-medium mb-3">Legend</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {Object.entries(STATUS_TO_COLOR).map(([key, color]) => (
              <li key={key}>
                <span className="inline-block w-3 h-3 mr-2 rounded-full align-middle" style={{ backgroundColor: color }} />
                {statusLabelFromKey(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-4 border shadow-sm text-sm">
          <div className="font-medium mb-2">Area Statistics</div>
          <div className="text-gray-600">Total Reports: <span className="float-right font-medium">{reports.length}</span></div>
          <div className="text-gray-600 mt-2">Pending: <span className="float-right font-medium">{reports.filter((r) => (r.status || '').toLowerCase() === 'submitted' && !r.quarantined).length}</span></div>
          <div className="text-gray-600 mt-2">Resolved: <span className="float-right font-medium">{reports.filter((r) => (r.status || '').toLowerCase() === 'resolved' && !r.quarantined).length}</span></div>
        </div>
      </aside>
    </div>
  )
}
