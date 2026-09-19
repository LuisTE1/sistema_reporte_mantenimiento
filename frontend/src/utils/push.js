import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Badge } from '@capawesome/capacitor-badge'
import { supabase } from '../supabaseClient'

// Notifica al resto de la app ("abre este reporte") cuando el usuario toca
// una notificación push. App.jsx escucha este evento y navega al reporte.
const EVENTO_ABRIR_REPORTE = 'sm-abrir-reporte'

export async function actualizarBadge(cantidad) {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (!cantidad || cantidad <= 0) {
      await Badge.clear()
    } else {
      await Badge.set({ count: cantidad })
    }
  } catch (e) {
    // El plugin puede no estar disponible en algunos dispositivos/OEMs;
    // no es crítico para el funcionamiento de la app.
    console.warn('No se pudo actualizar el badge del ícono:', e)
  }
}

export async function registrarPushNotifications(usuario) {
  if (!Capacitor.isNativePlatform() || !usuario?.id) return

  try {
    let permiso = await PushNotifications.checkPermissions()
    if (permiso.receive === 'prompt') {
      permiso = await PushNotifications.requestPermissions()
    }
    if (permiso.receive !== 'granted') return

    // Permiso aparte para mostrar la notificación nosotros mismos (la
    // necesitamos porque construimos la notificación en la app, no dejamos
    // que Android la muestre solo — ver comentario más abajo).
    try {
      let permisoLocal = await LocalNotifications.checkPermissions()
      if (permisoLocal.display === 'prompt') {
        permisoLocal = await LocalNotifications.requestPermissions()
      }
    } catch (e) { /* no crítico */ }

    // Canal requerido en Android 8+ para que la notificación se muestre
    // con sonido, prioridad alta y contribuya al numerito del ícono.
    try {
      await PushNotifications.createChannel({
        id: 'reportes',
        name: 'Reportes',
        description: 'Reportes nuevos y pendientes',
        importance: 4,
        visibility: 1,
        sound: 'default',
      })
      await LocalNotifications.createChannel({
        id: 'reportes',
        name: 'Reportes',
        description: 'Reportes nuevos y pendientes',
        importance: 4,
        visibility: 1,
        sound: 'default',
      })
    } catch (e) {
      // No crítico: si falla, Android usa un canal por defecto.
    }

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      try {
        await supabase.from('push_tokens').upsert(
          { usuario_id: usuario.id, token: token.value, plataforma: 'android', actualizado_en: new Date().toISOString() },
          { onConflict: 'token' }
        )
      } catch (e) {
        console.error('No se pudo guardar el token de notificaciones:', e)
      }
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Error registrando notificaciones push:', err)
    })

    // El servidor manda un mensaje "solo datos" (sin notification), a
    // propósito: así Android SIEMPRE entrega el mensaje a este código, sin
    // importar si la app está abierta, en segundo plano o cerrada — y
    // nosotros mostramos el aviso Y actualizamos el numerito juntos, en
    // vez de dejar que Android muestre un aviso "mudo" que nunca pasa por
    // nuestro código.
    const mostrarNotificacionYActualizarBadge = async (data) => {
      if (!data) return
      const pendientes = data.pendientes !== undefined ? parseInt(data.pendientes, 10) : undefined
      if (pendientes !== undefined) actualizarBadge(pendientes)

      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: data.title || 'Control Operativo',
            body: data.body || '',
            channelId: 'reportes',
            extra: { reporteId: data.reporte_id },
            // Algunos lanzadores de Android muestran el numerito del ícono
            // directo desde acá (no solo desde Badge.set), como respaldo.
            badge: pendientes,
          }],
        })
      } catch (e) {
        console.error('No se pudo mostrar la notificación local:', e)
      }
    }

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      mostrarNotificacionYActualizarBadge(notification.data)
    })

    // Por si algún mensaje llega igual con bloque "notification" (ej.
    // pruebas manuales): también actualiza el numerito.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const reporteId = action.notification?.data?.reporte_id
      if (reporteId) {
        window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_REPORTE, { detail: { reporteId: parseInt(reporteId, 10) } }))
      }
    })

    // El usuario tocó la notificación que mostramos nosotros: redirige
    // directo al reporte.
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const reporteId = action.notification?.extra?.reporteId
      if (reporteId) {
        window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_REPORTE, { detail: { reporteId: parseInt(reporteId, 10) } }))
      }
    })
  } catch (e) {
    console.error('No se pudo inicializar notificaciones push:', e)
  }
}

export function escucharAperturaDeReporte(callback) {
  const handler = (e) => callback(e.detail.reporteId)
  window.addEventListener(EVENTO_ABRIR_REPORTE, handler)
  return () => window.removeEventListener(EVENTO_ABRIR_REPORTE, handler)
}
