import { supabase } from '../supabaseClient'

// Monitoreo de errores simple, sin depender de un servicio externo: cualquier
// error de JavaScript no controlado en producción queda guardado en la tabla
// error_logs, visible para Gerencia en Mantenimiento del Sistema.
let usuarioActual = null
export function setUsuarioParaErrores(nombre) {
  usuarioActual = nombre
}

let inicializado = false
export function initErrorLogger() {
  if (inicializado) return
  inicializado = true
  window.addEventListener('error', (event) => {
    registrarError(event.error?.message || event.message, event.error?.stack)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    registrarError(reason?.message || String(reason), reason?.stack)
  })
}

async function registrarError(mensaje, stack) {
  try {
    await supabase.from('error_logs').insert([{
      mensaje: String(mensaje || 'Error desconocido').slice(0, 2000),
      stack: String(stack || '').slice(0, 4000),
      usuario: usuarioActual,
      pantalla: window.location.href,
    }])
  } catch (e) {
    // Si falla el registro de errores no hacemos nada más (evita bucles).
  }
}
