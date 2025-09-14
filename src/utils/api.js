// src/utils/api.js
/**
 * Helper to produce absolute API and upload URLs using VITE_API_BASE
 * If VITE_API_BASE is not set, apiUrl('/api/xxx') will return '/api/xxx'
 * which is good for local dev (when backend is on same origin).
 */

export const API_BASE =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_API_BASE
    ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')
    : ''

/** Return absolute API url for a path (path may start with or without "/") */
export function apiUrl(path = '') {
  if (!path) return API_BASE || ''
  const p = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${p}` : p
}

/** Return absolute photo url for a stored photo path (eg "/uploads/xxx") */
export function absolutePhotoUrl(photoPath) {
  if (!photoPath) return null
  if (/^https?:\/\//i.test(photoPath)) return photoPath
  const p = photoPath.startsWith('/') ? photoPath : `/${photoPath}`
  return API_BASE ? `${API_BASE}${p}` : p
}
