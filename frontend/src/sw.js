/// <reference lib="webworker" />
// Service worker de la versión instalable (PWA) — solo corre en el
// navegador, nunca dentro de la app nativa de Android (ver main.jsx).
// Dos trabajos: 1) cachear el "shell" de la app para que abra rápido y
// funcione offline, y 2) recibir notificaciones push web y abrir el
// reporte correcto cuando las tocan.

const CACHE_NAME = 'control-operativo-shell-v1'

// vite-plugin-pwa reemplaza esto con la lista real de archivos a cachear
// (JS, CSS, íconos, etc.) al momento de compilar.
const PRECACHE_URLS = self.__WB_MANIFEST.map((entry) => (typeof entry === 'string' ? entry : entry.url))

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        // cache.addAll() es "todo o nada": si UN solo archivo falla al
        // descargarse, cancela la instalación entera y el service worker se
        // queda parado para siempre (nunca llega a "activo") — sin avisar
        // nada, solo hace que serviceWorker.ready nunca se resuelva. Con
        // allSettled, un archivo que falle no tumba a los demás.
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url).then((res) => {
              if (res.ok) return cache.put(url, res)
              console.warn('[sw] no se pudo precachear (status ' + res.status + '):', url)
            }).catch((err) => {
              console.warn('[sw] no se pudo precachear:', url, err)
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})

// Llega un mensaje push desde el servidor (mismo "tipo"/formato de datos
// que ya usa la app nativa: title, body, reporte_id, pendientes).
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'Control Operativo', body: event.data.text() }
  }
  const title = data.title || 'Control Operativo'
  const options = {
    body: data.body || '',
    icon: './pwa-icon-192.png',
    badge: './pwa-icon-192.png',
    data: { reporteId: data.reporte_id || null },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// El usuario toca la notificación: enfoca la app si ya está abierta (y la
// navega al reporte), o la abre nueva si no. El reporte se comunica por un
// parámetro en la URL que App.jsx lee al cargar.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const reporteId = event.notification.data && event.notification.data.reporteId
  const url = reporteId ? `./?reporte=${reporteId}` : './'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
