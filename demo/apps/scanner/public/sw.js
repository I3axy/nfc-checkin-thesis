// -----------------------------------------------------------------------------
// Scanner service worker — keeps the kiosk usable with no network.
//
// The offline check-in queue lives in IndexedDB, but that is worthless if the
// app itself can't boot: a reload, a phone restart or a closed tab while
// offline must still bring the scanner back up.
//
// Vite fingerprints its bundles (index-<hash>.js), so a static worker can't
// precache them by name. Instead we precache the shell and cache every
// same-origin asset as it is fetched (stale-while-revalidate). After one
// online visit — which the roster cache needs anyway — the app boots offline.
// -----------------------------------------------------------------------------
const VERSION = 'v4'
const SHELL_CACHE = `scanner-shell-${VERSION}`
const ASSET_CACHE = `scanner-assets-${VERSION}`
const SHELL_URL = '/index.html'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      // cache: 'reload' bypasses the HTTP cache so we store a fresh shell
      .then((c) => c.add(new Request(SHELL_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  const keep = [SHELL_CACHE, ASSET_CACHE]
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return                                   // check-ins are POSTs — never touch them
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return                    // Supabase calls go straight to the network

  // Navigation: prefer the network (so a new deploy lands), fall back to the
  // cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(SHELL_CACHE)
        cache.put(SHELL_URL, fresh.clone())
        return fresh
      } catch {
        const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE })
        return cached ?? new Response(
          '<h1 style="font-family:system-ui;padding:2rem">Offline — nyisd meg egyszer hálózaton, hogy a scanner offline is induljon.</h1>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    })())
    return
  }

  // Assets (JS/CSS/icons): serve from cache instantly, refresh in the
  // background. Hashed filenames make stale copies safe.
  e.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE)
    const cached = await cache.match(req)
    const network = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res })
      .catch(() => null)
    return cached ?? (await network) ?? Response.error()
  })())
})
