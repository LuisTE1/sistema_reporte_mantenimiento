import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import './styles.css'
import { initErrorLogger } from './utils/errorLogger'

initErrorLogger()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// El service worker (para que sea instalable como PWA, con ícono propio y
// funcione sin conexión) solo tiene sentido en el navegador — dentro de la
// app nativa de Android ya se sirve todo empaquetado localmente, así que
// ahí un service worker no aporta nada y solo podría interferir con cómo
// Capacitor carga sus propios recursos.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
