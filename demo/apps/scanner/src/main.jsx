import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// updateViaCache:'none' keeps the worker script itself out of the HTTP cache,
// so a redeployed sw.js is picked up instead of a stale copy.
//
// FEJLESZTŐI MÓDBAN NEM REGISZTRÁLJUK: a sw.js gyorsítótárazása azt
// feltételezi, hogy minden fájlnév egyedi (Vite build-hash) — ez éles
// build esetén igaz, a Vite DEV szerver viszont mindig ugyanazon az
// URL-en szolgálja ki a forrásfájlokat (pl. /src/App.jsx). Emiatt dev
// módban a service worker minden kódváltoztatás UTÁN is a régi,
// gyorsítótárazott változatot adná vissza — a frissítés gomb sem segítene.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  })
}

const fnUrl = import.meta.env.VITE_CHECKIN_FUNCTION_URL
const slug  = import.meta.env.VITE_COMPANY_SLUG

if (!fnUrl || !slug) {
  document.getElementById('root').innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111827;color:#fff;font-family:monospace;gap:1rem;padding:2rem;text-align:center">
      <div style="font-size:1.2rem;font-weight:bold">Hiányzó környezeti változók</div>
      <div style="font-size:0.85rem;color:#9ca3af">A VITE_CHECKIN_FUNCTION_URL és a VITE_COMPANY_SLUG beállítása kötelező</div>
    </div>`
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}
