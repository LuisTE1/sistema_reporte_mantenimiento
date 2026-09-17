function normalizar(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim()
}

/**
 * Genera un código de usuario único a partir de nombres y apellidos
 * (ej: "Juan Pérez" -> "JPEREZ"), evitando choques con los que ya existen.
 * Si el código base ya está en uso, le agrega un número (JPEREZ2, JPEREZ3...).
 */
export function generarCodigoUsuario(nombres, apellidos, nombresExistentes) {
  const n = normalizar(nombres).split(/\s+/).filter(Boolean)
  const a = normalizar(apellidos).split(/\s+/).filter(Boolean)
  const inicialNombre = n[0]?.[0] || ''
  const apellidoPrincipal = a[0] || ''
  const base = (inicialNombre + apellidoPrincipal).slice(0, 15) || 'USUARIO'

  const existentesSet = new Set((nombresExistentes || []).map(x => (x || '').toUpperCase()))
  let candidato = base
  let contador = 2
  while (existentesSet.has(candidato)) {
    candidato = `${base}${contador}`
    contador++
  }
  return candidato
}
