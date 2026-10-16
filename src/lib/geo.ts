/**
 * Geospatial helpers.
 *
 * The database does the authoritative distance work with PostGIS. This module
 * covers the client-side needs: formatting a distance for a job card, rough
 * bounding boxes for map queries, and the privacy fuzzing rule that must match
 * `app.fuzz_coordinate()` in SQL exactly.
 */

export interface Coordinates {
  lat: number
  lng: number
}

export const EARTH_RADIUS_M = 6_371_008.8

/** Lagos city centre — the fallback origin when a user declines geolocation. */
export const DEFAULT_ORIGIN: Coordinates = { lat: 6.5244, lng: 3.3792 }

export function isValidCoordinates(value: Partial<Coordinates> | null | undefined): value is Coordinates {
  return (
    !!value &&
    typeof value.lat === 'number' &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  )
}

/**
 * Great-circle distance in metres.
 *
 * Used for optimistic UI only (e.g. re-sorting an already-fetched list as the
 * user moves). Anything authoritative — search results, service radius checks —
 * is computed by PostGIS server-side.
 */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Rounds a coordinate to 2dp (~1.1 km).
 *
 * MUST stay identical to `app.fuzz_coordinate()` in the database. Publishing a
 * more precise value anywhere in the product would let someone triangulate a
 * private home address from a job listing.
 */
export function fuzzCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

export function fuzzCoordinates(coords: Coordinates): Coordinates {
  return { lat: fuzzCoordinate(coords.lat), lng: fuzzCoordinate(coords.lng) }
}

/**
 * Formats a distance the way a person would say it.
 *
 * Deliberately imprecise below 500 m: showing "80 m away" on a public job card
 * is close to publishing an address.
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return ''

  if (meters < 500) return 'Under 500 m away'
  if (meters < 1000) return `${Math.round(meters / 100) * 100} m away`

  const km = meters / 1000
  if (km < 10) return `${km.toFixed(1)} km away`
  if (km < 100) return `${Math.round(km)} km away`
  return `${Math.round(km)} km away`
}

/** Short form for dense surfaces: "1.8 km". */
export function formatDistanceShort(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.round(meters / 100) * 100}m`
  const km = meters / 1000
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`
}

export interface BoundingBox {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

/** Approximate bounding box around a point, for a first-pass map query. */
export function boundingBox(center: Coordinates, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 110.574
  // Longitude degrees shrink toward the poles.
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180) || 1)

  return {
    minLat: Math.max(-90, center.lat - latDelta),
    maxLat: Math.min(90, center.lat + latDelta),
    minLng: Math.max(-180, center.lng - lngDelta),
    maxLng: Math.min(180, center.lng + lngDelta),
  }
}

/** Zoom level that comfortably fits a radius, for MapLibre. */
export function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 14
  if (radiusKm <= 3) return 13
  if (radiusKm <= 6) return 12
  if (radiusKm <= 12) return 11
  if (radiusKm <= 25) return 10
  if (radiusKm <= 50) return 9
  return 8
}

export interface GeolocationResult {
  coords: Coordinates | null
  accuracy: number | null
  error: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | null
}

/**
 * Browser geolocation with an explicit, typed failure mode.
 *
 * Location is core to the product but must never be a dead end: every caller
 * gets a usable result object and falls back to manual selection.
 */
export function requestGeolocation(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ coords: null, accuracy: null, error: 'unsupported' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: position.coords.accuracy,
          error: null,
        }),
      (error) => {
        const map: Record<number, GeolocationResult['error']> = {
          1: 'denied',
          2: 'unavailable',
          3: 'timeout',
        }
        resolve({ coords: null, accuracy: null, error: map[error.code] ?? 'unavailable' })
      },
      options,
    )
  })
}

/** Checks the Permissions API without triggering a prompt. */
export async function geolocationPermissionState(): Promise<PermissionState | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state
  } catch {
    return 'unsupported'
  }
}
