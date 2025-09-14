// src/utils/coords.js
export function extractCoords(report) {
  if (!report) return null;

  const tryPairs = [
    ['lat','lng'],
    ['latitude','longitude'],
    ['location_lat','location_lng'],
    ['locationLatitude','locationLongitude'],
    ['locationLat','locationLng'],
  ];

  for (const [a,b] of tryPairs) {
    if (report?.[a] != null && report?.[b] != null) {
      const la = parseFloat(report[a]), lo = parseFloat(report[b]);
      if (!Number.isNaN(la) && !Number.isNaN(lo)) return [la, lo];
    }
  }

  if (typeof report.location === 'string') {
    const m = report.location.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  }

  if (report.coords) {
    const parts = String(report.coords).split(',').map(s => s.trim());
    if (parts.length >= 2) {
      const la = parseFloat(parts[0]), lo = parseFloat(parts[1]);
      if (!Number.isNaN(la) && !Number.isNaN(lo)) return [la, lo];
    }
  }

  return null;
}
