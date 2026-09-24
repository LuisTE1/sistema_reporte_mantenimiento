// Manejador centralizado del botón "Atrás" — funciona con el botón físico
// de Android (App.jsx lo llama desde el listener de Capacitor) y con el
// gesto de deslizar desde el borde del iPhone en la versión PWA (ver
// ensurePopstateListener más abajo), usando el mismo mecanismo para los dos.
// Cada pantalla/modal se registra con una prioridad; al retroceder se
// ejecuta el handler activo de mayor prioridad (ej: cerrar un lightbox de
// imagen antes que salir de un formulario).
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

const stack = []
let uid = 0
let popstateListenerAdded = false

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

// En navegador (no en la app nativa de Android, que ya tiene su propio
// botón físico) escucha el evento "popstate" — lo dispara el gesto de
// deslizar desde el borde del iPhone (o el botón atrás de Android Chrome)
// cuando hay una entrada de historial que "consumir".
function ensurePopstateListener() {
  if (popstateListenerAdded || Capacitor.isNativePlatform()) return
  popstateListenerAdded = true
  window.addEventListener('popstate', () => {
    handleBack()
  })
}

/**
 * Registra una acción para "Atrás" mientras `active` sea true — ya sea el
 * botón físico de Android o el gesto de deslizar en la versión PWA.
 * Prioridad mayor = se ejecuta primero (ej: cerrar un modal por encima
 * de retroceder en un formulario).
 */
export function useBackHandler(active, onBack, priority = 0) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const idRef = useRef(null)

  useEffect(() => {
    if (!active) return
    ensurePopstateListener()
    if (!idRef.current) idRef.current = `bh-${uid++}`
    const id = idRef.current
    pushBackHandler(id, () => onBackRef.current(), priority)

    // En web, deja una entrada en el historial para que el gesto de
    // deslizar tenga algo a lo que "volver" — sin esto, no hay nada que el
    // gesto pueda deshacer y no pasa nada al deslizar.
    //
    // A propósito NO se intenta "deshacer" esta entrada cuando se cierra
    // con un botón en pantalla (en vez del gesto): tratar de sincronizar
    // el historial del navegador con cada cierre programático es frágil —
    // si un cierre dispara otro en cadena, se puede terminar retrocediendo
    // de más y saliendo de la app de golpe. Es preferible que, a veces,
    // sobre una entrada "muerta" (un deslizón que no hace nada) a que el
    // gesto saque a alguien de la app sin querer.
    if (!Capacitor.isNativePlatform()) {
      window.history.pushState({ backHandlerId: id }, '')
    }

    return () => {
      popBackHandler(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, priority])
}
