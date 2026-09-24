import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El service worker no se auto-registra: lo registramos a mano en
      // main.jsx, solo cuando NO estamos dentro de la app nativa de
      // Android (Capacitor) — ahí ya se sirve todo localmente empaquetado
      // y un service worker de caché no aporta nada, solo puede interferir.
      injectRegister: false,
      // Estrategia "injectManifest": usamos nuestro propio src/sw.js (no uno
      // generado automáticamente) porque necesita código propio para recibir
      // las notificaciones push web y abrir el reporte correcto al tocarlas.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifest: {
        name: 'Control Operativo - Mantenimiento',
        short_name: 'Control Operativo',
        description: 'Sistema de Control Operativo de Mantenimiento - Grifos y Unidades',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Precachea el "shell" de la app (JS/CSS/HTML) para que abra
        // instantáneo y funcione offline; los datos siguen viniendo de
        // Supabase en vivo (esto no cachea las respuestas de la API).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
})
