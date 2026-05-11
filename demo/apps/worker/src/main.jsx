import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js?v=3'))
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!url || !key) {
  document.getElementById('root').innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1d4ed8;color:#fff;font-family:monospace;gap:1rem;padding:2rem;text-align:center">
      <div style="font-size:3rem">⚠️</div>
      <div style="font-size:1.2rem;font-weight:bold">Missing environment variables</div>
      <div style="font-size:0.85rem;opacity:0.8">VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY must be set in Vercel</div>
    </div>`
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}
