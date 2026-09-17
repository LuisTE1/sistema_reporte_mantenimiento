// Caché de consultas a Supabase, con dos capas:
// 1. Memoria (rápida, se pierde al cerrar la app).
// 2. localStorage (sobrevive a cerrar/reabrir la app) como respaldo, para
//    que si el usuario abre la app SIN internet, los catálogos/formularios
//    no aparezcan vacíos (usa la última copia guardada aunque esté vieja).
const store = new Map()
const LS_PREFIX = 'sm_cache_'

function leerLocalStorage(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function getCached(key, ttlMs) {
  let entry = store.get(key)
  if (!entry) {
    entry = leerLocalStorage(key)
    if (entry) store.set(key, entry)
  }
  if (!entry) return undefined
  if (Date.now() - entry.time > ttlMs) return undefined
  return entry.value
}

// Última copia guardada, sin importar qué tan vieja sea. Es el último
// recurso cuando no hay internet y la consulta fresca falló: mejor mostrar
// datos viejos que una pantalla vacía.
export function getCachedStale(key) {
  const entry = store.get(key) || leerLocalStorage(key)
  return entry ? entry.value : undefined
}

export function setCached(key, value) {
  const entry = { value, time: Date.now() }
  store.set(key, entry)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch (e) {
    // localStorage lleno o no disponible: no es crítico, sigue funcionando en memoria
  }
}

export function invalidateCache(key) {
  store.delete(key)
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch (e) {
    // no crítico
  }
}

// Borra todo lo cacheado (memoria + localStorage). Se usa cuando vuelve la
// conexión, para forzar que la próxima lectura traiga datos frescos en vez
// de seguir mostrando lo que se guardó mientras no había señal.
export function invalidateAllCache() {
  store.clear()
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
  } catch (e) {
    // no crítico
  }
}
