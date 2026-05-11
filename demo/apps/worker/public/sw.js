const CACHE = 'worker-v3'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request)
        const cache = await caches.open(CACHE)
        cache.put('/index.html', fresh.clone())
        return fresh
      } catch {
        const cached = await caches.match('/index.html')
        if (cached) return cached
        throw new Error('No cached shell available')
      }
    })())
  }
})
