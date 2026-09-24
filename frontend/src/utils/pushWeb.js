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

// DEBUG_OVERLAY: quítalo apenas quede confirmado que la suscripción se
// está guardando bien — es un recuadro fijo en pantalla (no un alert(),
// que iOS empieza a bloquear después de 1-2 seguidos) para ver, sin
// herramientas de desarrollador, en qué paso exacto se corta.
const DEBUG_OVERLAY = true

function debugLog(msg) {
  if (!DEBUG_OVERLAY) return
  console.log('[push-debug]', msg)
  let box = document.getElementById('push-debug-box')
  if (!box) {
    box = document.createElement('div')
    box.id = 'push-debug-box'
    box.style.cssText = 'position:fixed; left:8px; right:8px; bottom:8px; max-height:50vh; overflow:auto; background:rgba(0,0,0,0.9); color:#0f0; font:11px monospace; padding:8px; border-radius:8px; z-index:999999; white-space:pre-wrap;'
    document.body.appendChild(box)
  }
  const line = document.createElement('div')
  line.textContent = `${new Date().toLocaleTimeString()} — ${msg}`
  box.appendChild(line)
}

// Notificaciones push para la versión instalable (PWA) en navegador — solo
// tiene sentido fuera de la app nativa de Android, que ya usa Firebase
// directo (ver utils/push.js). Sin esto, un iPhone con la PWA instalada no
// tenía forma de recibir avisos: el plugin de Capacitor no tiene versión
// para navegador.
export async function registrarPushWeb(usuario) {
  if (Capacitor.isNativePlatform() || !usuario?.id) return
  debugLog('iniciando registro de push web para usuario ' + usuario?.nombre)

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    debugLog('este navegador no soporta Push (serviceWorker o PushManager ausente)')
    return
  }

  try {
    let permiso = Notification.permission
    debugLog('permiso actual: ' + permiso)
    if (permiso === 'default') {
      permiso = await Notification.requestPermission()
      debugLog('permiso luego de pedirlo: ' + permiso)
    }
    if (permiso !== 'granted') {
      debugLog('permiso no concedido, se detiene acá')
      return
    }

    debugLog('esperando que el service worker esté listo...')
    const registration = await navigator.serviceWorker.ready
    debugLog('service worker listo, pidiendo suscripción...')

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    debugLog('suscripción obtenida: ' + subscription.endpoint.slice(0, 50) + '...')

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys) {
      debugLog('la suscripción no trajo endpoint/keys')
      return
    }

    debugLog('guardando en Supabase (usuario_id=' + usuario.id + ')...')
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
      debugLog('ERROR guardando en Supabase: ' + error.message)
      console.error('No se pudo guardar la suscripción push web:', error)
    } else {
      debugLog('¡guardado con éxito!')
    }
  } catch (e) {
    debugLog('EXCEPCIÓN: ' + (e?.message || String(e)))
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
