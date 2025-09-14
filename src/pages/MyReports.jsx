// src/components/MyReports.jsx
import React, { useEffect, useState, useCallback } from 'react'

/**
 * Props:
 *  - apiBase (optional) : string base url for API, default '/api'
 *  - user (optional)    : if provided, appended as `user` when requesting ?mine=true
 *
 * Notes:
 *  - The component tolerates two response shapes: an array, or { data: [...] }.
 *  - It also tolerates multiple coordinate key names (lat/lng, latitude/longitude, location_lat/location_lng).
 */
export default function MyReports({ apiBase = '/api', user = null }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const buildEndpoint = useCallback(() => {
    let url = `${apiBase.replace(/\/$/, '')}/reports?mine=true`
    if (user) url += `&user=${encodeURIComponent(user)}`
    return url
  }, [apiBase, user])

  const extractCoords = (r) => {
    if (!r) return null
    const candidates = [
      ['location_lat', 'location_lng'],
      ['lat', 'lng'],
      ['latitude', 'longitude'],
      ['locationLatitude', 'locationLongitude'],
      ['locationLat', 'locationLng'],
    ]
    for (const [a, b] of candidates) {
      if (r?.[a] != null && r?.[b] != null) {
        const la = Number(r[a]), lo = Number(r[b])
        if (isFinite(la) && isFinite(lo)) return [la, lo]
      }
    }
    if (typeof r.location === 'string') {
      const m = r.location.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
      if (m) return [parseFloat(m[1]), parseFloat(m[2])]
    }
    if (r.coords) {
      const p = String(r.coords).split(',').map(s => s.trim())
      if (p.length >= 2) {
        const la = Number(p[0]), lo = Number(p[1])
        if (isFinite(la) && isFinite(lo)) return [la, lo]
      }
    }
    return null
  }

  const load = useCallback(
    async (signal) => {
      setLoading(true)
      setError(null)
      const endpoint = buildEndpoint()
      try {
        const res = await fetch(endpoint, { signal, credentials: 'same-origin' })
        const text = await res.text().catch(() => '')
        if (!res.ok) {
          let parsed = null
          try { parsed = JSON.parse(text) } catch (err) { parsed = null }
          const errMsg = parsed?.message || parsed?.error || text || `Server ${res.status}`
          throw new Error(errMsg)
        }

        // support both: bare array OR { data: [...] }
        let parsedBody = []
        if (text) {
          try {
            const tmp = JSON.parse(text)
            if (Array.isArray(tmp)) parsedBody = tmp
            else if (Array.isArray(tmp?.data)) parsedBody = tmp.data
            else parsedBody = []
          } catch (err) {
            parsedBody = []
          }
        }

        // normalize minimal coordinate keys for display
        const normalized = parsedBody.map((r) => ({
          ...r,
          location_lat: r.location_lat ?? r.lat ?? r.latitude ?? null,
          location_lng: r.location_lng ?? r.lng ?? r.longitude ?? null,
        }))

        setReports(Array.isArray(normalized) ? normalized : [])
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('MyReports load error', err)
        setReports([])
        setError(err.message || 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    },
    [buildEndpoint]
  )

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load])

  return (
    <div className="max-w-xl mx-auto" aria-live="polite">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">My Reports</h2>
        <button
          onClick={() => {
            const ac = new AbortController()
            load(ac.signal)
          }}
          className="text-sm px-3 py-1 rounded bg-gray-100 border disabled:opacity-60"
          aria-label="Refresh reports"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-sm text-gray-500">Loading your reports…</div>}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded">
            <div className="font-medium">Failed to load reports</div>
            <div className="text-xs mt-1 break-words">{error}</div>
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="text-sm text-gray-500">No reports yet</div>
        )}

        {reports.map((r, idx) => {
          const coords = extractCoords(r)
          return (
            <div
              key={r.id ?? r._id ?? r.uuid ?? `r-${idx}`}
              className="bg-white p-3 rounded shadow-sm"
            >
              <div className="text-sm font-medium">
                {(r.type || 'Issue').toString().replace(/_/g, ' ')} —{' '}
                <span className="text-gray-500 text-xs">{r.status || 'unknown'}</span>
              </div>
              <div className="text-sm mt-1">{r.description || r.title || 'No description'}</div>

              {coords ? (
                <div className="text-xs text-gray-400 mt-2">
                  {`Lat: ${coords[0].toFixed(6)}, Lng: ${coords[1].toFixed(6)}`}
                </div>
              ) : (
                <div className="text-xs text-gray-400 mt-2">Coordinates: not available</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
