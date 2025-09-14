// src/components/LocationIQAutocomplete.jsx
import React, { useEffect, useRef, useState } from 'react'

const TOKEN = import.meta.env.VITE_LOCATIONIQ_KEY
const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

export default function LocationIQAutocomplete({
  onSelect,
  placeholder = 'Search address...',
  disabled = false,
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [highlight, setHighlight] = useState(-1)

  const timerRef = useRef(null)
  const abortRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) {
        try { abortRef.current.abort() } catch (e) {}
      }
    }
  }, [])

  // close suggestions when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) {
        setItems([])
        setHighlight(-1)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // if disabled becomes true, clear pending timer/fetch
  useEffect(() => {
    if (disabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (abortRef.current) {
        try { abortRef.current.abort() } catch (e) {}
        abortRef.current = null
      }
      setItems([])
      setLoading(false)
    }
  }, [disabled])

  async function fetchSuggestions(text) {
    // no-op if disabled
    if (disabled) return

    // cancel previous fetch
    if (abortRef.current) {
      try { abortRef.current.abort() } catch (e) {}
      abortRef.current = null
    }

    if (!TOKEN) {
      setError('LocationIQ key missing (VITE_LOCATIONIQ_KEY).')
      setItems([])
      setLoading(false)
      return
    }

    if (!text || text.length < MIN_QUERY_LENGTH) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    const url = `https://us1.locationiq.com/v1/autocomplete.php?key=${encodeURIComponent(
      TOKEN
    )}&q=${encodeURIComponent(text)}&limit=6&format=json`

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${txt}`)
      }
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setHighlight(-1)
    } catch (err) {
      if (err.name === 'AbortError') {
        // expected on cancel
      } else {
        console.error('LocationIQ autocomplete error', err)
        setError('Failed to load suggestions')
        setItems([])
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function scheduleFetch(text) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS)
  }

  function onChange(e) {
    const v = String(e.target.value || '').trimStart() // keep internal whitespace after start
    setQ(v)
    setError(null)
    if (v.length >= MIN_QUERY_LENGTH) scheduleFetch(v)
    else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setItems([])
    }
  }

  /**
   * Robustly parse lat/lng from provider result object.
   * Returns [lat|null, lon|null]
   */
  function parseLatLng(it) {
    if (!it) return [null, null]

    // common fields
    const latCandidates = [it.lat, it.latitude, it.latitud, it.location_lat]
    const lonCandidates = [it.lon, it.longitude, it.lng, it.location_lng]

    for (let i = 0; i < Math.max(latCandidates.length, lonCandidates.length); i++) {
      const la = latCandidates[i]
      const lo = lonCandidates[i]
      const nla = la != null ? Number(la) : null
      const nlo = lo != null ? Number(lo) : null
      if (isFinite(nla) && isFinite(nlo)) return [nla, nlo]
    }

    // `center` style object { lat, lon } (some APIs)
    if (it.center && typeof it.center === 'object') {
      const nla = it.center.lat != null ? Number(it.center.lat) : null
      const nlo = it.center.lon != null ? Number(it.center.lon) : null
      if (isFinite(nla) && isFinite(nlo)) return [nla, nlo]
    }

    // boundingbox: try first two values only if they look numeric
    if (Array.isArray(it.boundingbox) && it.boundingbox.length >= 2) {
      const a = Number(it.boundingbox[0])
      const b = Number(it.boundingbox[1])
      if (isFinite(a) && isFinite(b)) return [a, b]
    }

    // fallback: match "lat, lon" inside display_name (fragile)
    if (typeof it.display_name === 'string') {
      const m = it.display_name.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
      if (m) return [parseFloat(m[1]), parseFloat(m[2])]
    }

    return [null, null]
  }

  function doSelect(it) {
    if (!it) return
    const [lat, lon] = parseLatLng(it)
    const address = it.display_name || it.name || ''
    onSelect?.({ address, lat: lat ?? null, lng: lon ?? null, raw: it })
    setQ(address)
    setItems([])
    setHighlight(-1)
  }

  function onKeyDown(e) {
    if (items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(items.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(-1, h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < items.length) {
        e.preventDefault()
        doSelect(items[highlight])
      }
    } else if (e.key === 'Escape') {
      setItems([])
      setHighlight(-1)
    }
  }

  // keep highlighted item scrolled into view
  useEffect(() => {
    if (highlight < 0) return
    const container = listRef.current
    const itemEl = container?.querySelector(`[data-idx="${highlight}"]`)
    if (itemEl && container) {
      const cRect = container.getBoundingClientRect()
      const iRect = itemEl.getBoundingClientRect()
      if (iRect.top < cRect.top) itemEl.scrollIntoView({ block: 'nearest' })
      else if (iRect.bottom > cRect.bottom) itemEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlight])

  return (
    <div ref={containerRef} className="relative" style={{ minWidth: 0 }}>
      <input
        ref={inputRef}
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={items.length > 0}
        aria-activedescendant={highlight >= 0 ? `loc-item-${highlight}` : undefined}
        className="w-full px-3 py-2 rounded-lg border bg-gray-50"
        disabled={disabled}
      />

      {items.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded shadow max-h-56 overflow-auto"
        >
          {items.map((it, idx) => {
            const key = it.place_id ?? it.osm_id ?? it.display_name ?? idx
            const display =
              it.display_name ||
              it.name ||
              `${it.address?.city || ''} ${it.address?.road || ''}`.trim() ||
              'Unknown'
            const isActive = idx === highlight
            return (
              <div
                key={key}
                id={`loc-item-${idx}`}
                data-idx={idx}
                role="option"
                aria-selected={isActive}
                onClick={() => doSelect(it)}
                onMouseEnter={() => setHighlight(idx)}
                className={`p-2 cursor-pointer text-sm ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                {display}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-1 text-xs text-gray-500">
        {loading
          ? 'Loading suggestions…'
          : error
          ? <span className="text-red-600">{error}</span>
          : q.length > 0 && q.length < MIN_QUERY_LENGTH
          ? `Type ${MIN_QUERY_LENGTH}+ characters`
          : null}
      </div>
    </div>
  )
}
