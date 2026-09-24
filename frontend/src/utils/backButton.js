// Manejador centralizado del botón físico "Atrás" de Android.
// Cada pantalla/modal se registra con una prioridad; al presionar
// Atrás se ejecuta el handler activo de mayor prioridad (ej: cerrar
// un lightbox de imagen antes que salir de un formulario).
//
// NOTA: se intentó conectar esto también al gesto de deslizar del iPhone
// en la versión PWA (empujando una entrada al historial del navegador por
// cada pantalla/modal que se abre), pero en el modo "instalado como app"
// de iOS eso generaba lentitud y congelamientos notorios al navegar — un
// problema conocido de Safari en modo standalone con manejo de historial.
// Se revirtió: en la PWA de iPhone se navega con los botones en pantalla
// (Cancelar/Volver/X), igual que siempre funcionó ahí.
import { useEffect, useRef } from 'react'

const stack = []
let uid = 0

export function pushBackHandler(id, handler, priority) {
  const idx = stack.findIndex(h => h.id === id)
  const entry = { id, handler, priority }
  if (idx !== -1) stack[idx] = entry
  else stack.push(entry)
}

export function popBackHandler(id) {
  const idx = stack.findIndex(h => h.id === id)
  if (idx !== -1) stack.splice(idx, 1)
}

// Devuelve true si algún handler activo manejó el "atrás".
export function handleBack() {
  if (stack.length === 0) return false
  let best = stack[0]
  for (const h of stack) {
    if (h.priority > best.priority) best = h
  }
  best.handler()
  return true
}

/**
 * Registra una acción para el botón "Atrás" mientras `active` sea true.
 * Prioridad mayor = se ejecuta primero (ej: cerrar un modal por encima
 * de retroceder en un formulario).
 */
export function useBackHandler(active, onBack, priority = 0) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const idRef = useRef(null)

  useEffect(() => {
    if (!active) return
    if (!idRef.current) idRef.current = `bh-${uid++}`
    const id = idRef.current
    pushBackHandler(id, () => onBackRef.current(), priority)
    return () => popBackHandler(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, priority])
}
