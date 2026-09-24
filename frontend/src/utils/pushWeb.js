import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabaseClient'

// Llave pública VAPID — es pública a propósito (va en el navegador de
// cualquiera), la privada nunca sale de la Edge Function de Supabase.
const VAPID_PUBLIC_KEY = 'BI333UtdYnoMCtThgX-i6KxHaD4ZI-UhQmH2dvw3LCMuK3gaub10oaZjNpPHzA5qnlLHD5i6bO8e0D0U0xrOavA'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// Notificaciones push para la versión instalable (PWA) en navegador — solo
// tiene sentido fuera de la app nativa de Android, que ya usa Firebase
// directo (ver utils/push.js). Sin esto, un iPhone con la PWA instalada no
// tenía forma de recibir avisos: el plugin de Capacitor no tiene versión
// para navegador.
// DEBUG_ALERT: quítalo apenas quede confirmado que la suscripción se está
// guardando bien — es solo para ver en el celular, sin herramientas de
// desarrollador, en qué paso exacto se corta.
const DEBUG_ALERT = true

export async function registrarPushWeb(usuario) {
  if (Capacitor.isNativePlatform() || !usuario?.id) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (DEBUG_ALERT) alert('DEBUG push: este navegador no soporta Push (serviceWorker o PushManager ausente)')
    return
  }

  try {
    let permiso = Notification.permission
    if (permiso === 'default') {
      permiso = await Notification.requestPermission()
    }
    if (permiso !== 'granted') {
      if (DEBUG_ALERT) alert('DEBUG push: permiso de notificaciones = ' + permiso)
      return
    }

    const registration = await navigator.serviceWorker.ready
    if (DEBUG_ALERT) alert('DEBUG push: service worker listo, pidiendo suscripción...')

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    if (DEBUG_ALERT) alert('DEBUG push: suscripción obtenida, endpoint: ' + subscription.endpoint.slice(0, 60) + '...')

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys) {
      if (DEBUG_ALERT) alert('DEBUG push: la suscripción no trajo endpoint/keys')
      return
    }

    const { error } = await supabase.from('push_subscriptions_web').upsert(
      {
        usuario_id: usuario.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
    if (error) {
      if (DEBUG_ALERT) alert('DEBUG push: error guardando en Supabase: ' + error.message)
      console.error('No se pudo guardar la suscripción push web:', error)
    } else if (DEBUG_ALERT) {
      alert('DEBUG push: ¡guardado con éxito!')
    }
  } catch (e) {
    if (DEBUG_ALERT) alert('DEBUG push: excepción: ' + (e?.message || String(e)))
    console.warn('No se pudo registrar la suscripción push web:', e)
  }
}

// Cuando el usuario toca una notificación push web, el service worker abre
// la app con "?reporte=ID" en la URL — esto lo lee una sola vez al cargar
// y limpia la URL, devolviendo el id para abrir ese reporte directo.
export function leerReporteDesdeUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('reporte')
    if (!id) return null
    const url = new URL(window.location.href)
    url.searchParams.delete('reporte')
    window.history.replaceState({}, '', url)
    return parseInt(id, 10)
  } catch (e) {
    return null
  }
}
