// Caché simple en memoria para evitar repetir la misma consulta a Supabase
// cada vez que el usuario navega entre pantallas (menú -> visor -> menú...).
// Vive mientras la app esté abierta; se pierde al cerrarla, lo cual está bien
// porque son datos que igual se refrescan solos poco después.
const store = new Map()

export function getCached(key, ttlMs) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.time > ttlMs) return undefined
  return entry.value
}

export function setCached(key, value) {
  store.set(key, { value, time: Date.now() })
}

export function invalidateCache(key) {
  store.delete(key)
}
