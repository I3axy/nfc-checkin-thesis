// -----------------------------------------------------------------------------
// Worker app service worker — same strategy as the scanner.
//
// The worker app needs the network to show data (it reads through the
// worker-data function), but the shell must still boot offline so the user
// gets the app's own "no connection" state instead of a browser error page.
//
// Vite fingerprints its bundles, so assets are cached as they are fetched
// (stale-while-revalidate) rather than precached by name.
// -----------------------------------------------------------------------------
const VERSION = 'v4'
const SHELL_CACHE = `worker-shell-${VERSION}`
const ASSET_CACHE = `worker-assets-${VERSION}`
const SHELL_URL = '/index.html'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
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
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

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
          '<h1 style="font-family:system-ui;padding:2rem">Offline — nyisd meg egyszer hálózaton.</h1>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    })())
    return
  }

  e.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE)
    const cached = await cache.match(req)
    const network = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res })
      .catch(() => null)
    return cached ?? (await network) ?? Response.error()
  })())
})
