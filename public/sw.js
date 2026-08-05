/* eslint-disable no-restricted-globals */
/**
 * Hustle Street service worker.
 *
 * Caching strategy, chosen per resource class:
 *
 *   App shell / static assets   cache-first        (immutable, hashed URLs)
 *   Navigations                 network-first      (fresh HTML, offline fallback)
 *   Reference data (categories) stale-while-revalidate
 *   Job/hustler reads           network-first with a short-lived cache
 *   Everything under /api/      network-only unless explicitly listed
 *
 * The hard rule, and the reason the allowlist below is explicit rather than a
 * pattern: MONEY IS NEVER CACHED. Wallet balances, transactions, payment
 * initialisation and payouts always go to the network. A cached balance is a
 * wrong balance, and showing one would be worse than showing nothing.
 */

const VERSION = 'v1'
const SHELL_CACHE = `hs-shell-${VERSION}`
const STATIC_CACHE = `hs-static-${VERSION}`
const DATA_CACHE = `hs-data-${VERSION}`
const IMAGE_CACHE = `hs-images-${VERSION}`

const OFFLINE_URL = '/offline'

// Precached so the app opens with no network at all.
const SHELL_ASSETS = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png']

/** API paths safe to serve from cache while revalidating. Read-only, non-financial. */
const CACHEABLE_API = ['/api/categories', '/api/locations']

/** API paths that must NEVER be cached, under any circumstance. */
const NEVER_CACHE = [
  '/api/wallet',
  '/api/payouts',
  '/api/payments',
  '/api/webhooks',
  '/api/cron',
  '/api/health',
  '/auth/',
]

const DATA_MAX_AGE_MS = 5 * 60 * 1000
const IMAGE_MAX_ENTRIES = 80

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      // A failed precache must not block installation entirely.
      .catch((error) => console.warn('[sw] precache failed', error)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('hs-') && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

// The update prompt in the app posts this when the user taps "Reload".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never touch non-GET: a cached POST would be a correctness disaster.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin (map tiles, fonts) — let the browser handle it.
  if (url.origin !== self.location.origin) return

  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, IMAGE_MAX_ENTRIES))
    return
  }

  if (CACHEABLE_API.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE))
  }
})

/** Navigations: fresh HTML when possible, the offline page when not. */
async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline

    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}

/** Same as cache-first, but evicts oldest entries so images cannot grow forever. */
async function cacheFirstWithLimit(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      const keys = await cache.keys()
      if (keys.length > maxEntries) {
        await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
      }
    }
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      // Stamp the entry so stale reads can be labelled in the UI.
      const body = await response.clone().blob()
      const headers = new Headers(response.headers)
      headers.set('x-hs-cached-at', String(Date.now()))
      cache.put(request, new Response(body, { status: response.status, headers }))
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) {
      const cachedAt = Number(cached.headers.get('x-hs-cached-at') ?? 0)
      if (Date.now() - cachedAt < DATA_MAX_AGE_MS) return cached
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'OFFLINE', message: "You're offline. Some features are unavailable." },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)

  return cached ?? network
}

/* ── Background sync ──────────────────────────────────────────────────────
 *
 * Messages and applications composed offline are queued by the app in
 * IndexedDB and replayed here when connectivity returns. Each carries a client
 * nonce, so a replay that races the original cannot create a duplicate.
 *
 * Financial actions are deliberately absent from this queue.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'hs-outbox') {
    event.waitUntil(flushOutbox())
  }
})

async function flushOutbox() {
  const db = await openOutbox()
  if (!db) return

  const items = await readAll(db, 'outbox')

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      })

      // Remove on success, and also on a 4xx — retrying a rejected request
      // forever would keep the queue permanently stuck.
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        await remove(db, 'outbox', item.id)
      }
    } catch {
      // Still offline. Leave it queued for the next sync.
      break
    }
  }

  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => client.postMessage({ type: 'OUTBOX_FLUSHED' }))
}

function openOutbox() {
  return new Promise((resolve) => {
    const request = indexedDB.open('hustle-street', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function readAll(db, storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result ?? [])
    request.onerror = () => resolve([])
  })
}

function remove(db, storeName, id) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/* ── Push notifications ─────────────────────────────────────────────────── */

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Hustle Street', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Hustle Street', {
      body: payload.body ?? '',
      icon: payload.icon ?? '/icons/icon-192.png',
      badge: payload.badge ?? '/icons/badge-72.png',
      image: payload.image,
      tag: payload.tag,
      // Replaces a same-tag notification instead of stacking three "new
      // message" alerts from one conversation.
      renotify: Boolean(payload.tag),
      requireInteraction: payload.requireInteraction ?? false,
      data: { url: payload.url ?? '/home', ...payload.data },
      vibrate: [80, 40, 80],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? '/home'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // Reuse an open tab rather than piling up windows.
      for (const client of allClients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(targetUrl)
          return
        }
      }

      await self.clients.openWindow(targetUrl)
    })(),
  )
})
