'use client'

import * as React from 'react'
import {
  DEFAULT_ORIGIN,
  geolocationPermissionState,
  isValidCoordinates,
  requestGeolocation,
  type Coordinates,
} from '@/lib/geo'

/**
 * Location context.
 *
 * Location drives discovery, so it has to work for everyone — including people
 * who deny the permission prompt, are on a desktop with bad IP geolocation, or
 * simply want to browse jobs in an area they are not standing in.
 *
 * The resolution order is: explicit manual choice → last known device position
 * → Lagos. There is never a state where the feed is empty because we do not
 * know where someone is.
 */

const STORAGE_KEY = 'hs:location'

export type LocationSource = 'device' | 'manual' | 'default'

export interface StoredLocation {
  coords: Coordinates
  label: string
  source: LocationSource
  savedAt: number
}

interface LocationContextValue {
  coords: Coordinates
  label: string
  source: LocationSource
  /** True while a device position request is in flight. */
  locating: boolean
  permission: PermissionState | 'unsupported' | 'unknown'
  /** Has the user actively chosen or granted a location? */
  isResolved: boolean
  requestDeviceLocation: () => Promise<boolean>
  setManualLocation: (coords: Coordinates, label: string) => void
  clearLocation: () => void
}

const LocationContext = React.createContext<LocationContextValue | null>(null)

function readStored(): StoredLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLocation
    if (!isValidCoordinates(parsed.coords)) return null
    // A device fix older than a day is stale; a manual choice never expires.
    if (parsed.source === 'device' && Date.now() - parsed.savedAt > 86_400_000) return null
    return parsed
  } catch {
    return null
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = React.useState<StoredLocation | null>(null)
  const [locating, setLocating] = React.useState(false)
  const [permission, setPermission] =
    React.useState<LocationContextValue['permission']>('unknown')

  // Read from storage after mount so the server and client render the same
  // markup on the first pass.
  React.useEffect(() => {
    setStored(readStored())
    void geolocationPermissionState().then(setPermission)
  }, [])

  const persist = React.useCallback((value: StoredLocation | null) => {
    setStored(value)
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Private browsing or a full quota — the in-memory value still works.
    }
  }, [])

  const requestDeviceLocation = React.useCallback(async () => {
    setLocating(true)
    try {
      const result = await requestGeolocation()
      if (result.coords) {
        persist({
          coords: result.coords,
          label: 'Your location',
          source: 'device',
          savedAt: Date.now(),
        })
        setPermission('granted')
        return true
      }
      if (result.error === 'denied') setPermission('denied')
      return false
    } finally {
      setLocating(false)
    }
  }, [persist])

  const setManualLocation = React.useCallback(
    (coords: Coordinates, label: string) => {
      persist({ coords, label, source: 'manual', savedAt: Date.now() })
    },
    [persist],
  )

  const clearLocation = React.useCallback(() => persist(null), [persist])

  const value = React.useMemo<LocationContextValue>(
    () => ({
      coords: stored?.coords ?? DEFAULT_ORIGIN,
      label: stored?.label ?? 'Lagos',
      source: stored?.source ?? 'default',
      locating,
      permission,
      isResolved: stored !== null,
      requestDeviceLocation,
      setManualLocation,
      clearLocation,
    }),
    [stored, locating, permission, requestDeviceLocation, setManualLocation, clearLocation],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation(): LocationContextValue {
  const context = React.useContext(LocationContext)
  if (!context) throw new Error('useLocation must be used inside <LocationProvider>')
  return context
}
