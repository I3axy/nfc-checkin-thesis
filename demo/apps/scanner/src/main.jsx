import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

const fnUrl = import.meta.env.VITE_CHECKIN_FUNCTION_URL
const slug  = import.meta.env.VITE_COMPANY_SLUG

if (!fnUrl || !slug) {
  document.getElementById('root').innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111827;color:#fff;font-family:monospace;gap:1rem;padding:2rem;text-align:center">
      <div style="font-size:3rem">⚠️</div>
      <div style="font-size:1.2rem;font-weight:bold">Missing environment variables</div>
      <div style="font-size:0.85rem;color:#9ca3af">VITE_CHECKIN_FUNCTION_URL and VITE_COMPANY_SLUG must be set</div>
    </div>`
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}
