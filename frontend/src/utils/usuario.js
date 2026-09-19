function normalizar(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim()
}

/**
 * Genera un código de usuario único a partir de nombres y apellidos, en
 * cascada de más simple a más específico (para que el login quede simple
 * en el caso normal, y solo se complique si de verdad hay una coincidencia):
 *   1. Nombre solo            -> "LUIS"
 *   2. Nombre + inicial apellido -> "LUIST"
 *   3. Nombre + apellido completo -> "LUISTATAJE"
 *   4. Lo anterior + número (último recurso) -> "LUISTATAJE2"
 */
export function generarCodigoUsuario(nombres, apellidos, nombresExistentes) {
  const n = normalizar(nombres).split(/\s+/).filter(Boolean)
  const a = normalizar(apellidos).split(/\s+/).filter(Boolean)
  const primerNombre = n[0] || 'USUARIO'
  const apellidoPrincipal = a[0] || ''
  const inicialApellido = apellidoPrincipal[0] || ''

  const existentesSet = new Set((nombresExistentes || []).map(x => (x || '').toUpperCase()))

  const candidatos = [
    primerNombre,
    inicialApellido ? primerNombre + inicialApellido : null,
    apellidoPrincipal ? primerNombre + apellidoPrincipal : null,
  ].filter(Boolean)

  for (const candidato of candidatos) {
    if (!existentesSet.has(candidato)) return candidato
  }

  const base = candidatos[candidatos.length - 1] || primerNombre
  let candidato = base
  let contador = 2
  while (existentesSet.has(candidato)) {
    candidato = `${base}${contador}`
    contador++
  }
  return candidato
}

// Nombre y apellido para mostrar en pantalla (saludo, avatar) — nunca el
// código de acceso (`nombre`), que es solo para iniciar sesión.
export function nombreVisible(user) {
  return user?.nombre_completo || user?.nombre || ''
}

export function iniciales(user) {
  const partes = nombreVisible(user).trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

// Misma regla que usa el servidor (send-report-notification) para decidir a
// quién avisar: si el usuario no la pasa, tampoco debe poder abrir ese
// reporte en la app — ni siquiera llegando por una notificación vieja o
// mal dirigida (deep link con un reporte_id que ya no le corresponde).
export function puedeVerReporte(user, reporte) {
  if (!user?.permisos?.soluciones) return false
  if (reporte.modulo === 'unidades') return user.permisos.verUnidades === true
  if (user.permisos.verGrifos === false) return false
  if (!user.estaciones) return false
  if (user.estaciones === 'Todas') return true
  return user.estaciones.toUpperCase().includes((reporte.estacion_id || '').toUpperCase())
}
