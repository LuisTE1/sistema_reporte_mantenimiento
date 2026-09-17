import React, { useRef, useState, useEffect } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_ZOOM = 2.5
const DOUBLE_TAP_MS = 300
const SWIPE_THRESHOLD_PX = 70

function distancia(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

/**
 * Imagen con gestos estilo WhatsApp: doble toque o pellizco para hacer
 * zoom, arrastre para moverse dentro de la imagen ampliada, y —cuando NO
 * está ampliada— deslizar al costado para pasar a la foto siguiente o
 * anterior (en vez de tener que tocar una flecha).
 */
export default function ZoomableImage({ src, alt, style, onLoad, onError, onContextMenu, onSwipeLeft, onSwipeRight }) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const stateRef = useRef({ pinching: false, startDist: 0, startScale: 1, dragging: false, dragStart: null, lastTap: 0, swiping: false, swipeStartX: 0 })

  // Al cambiar de foto (swipe/prev/next), siempre vuelve a mostrarla sin zoom.
  useEffect(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [src])

  const toggleZoom = (clientX, clientY, rect) => {
    if (scale > 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    } else {
      const offsetX = (rect.width / 2 - (clientX - rect.left)) * (DOUBLE_TAP_ZOOM - 1)
      const offsetY = (rect.height / 2 - (clientY - rect.top)) * (DOUBLE_TAP_ZOOM - 1)
      setScale(DOUBLE_TAP_ZOOM)
      setTranslate({ x: offsetX, y: offsetY })
    }
  }

  const handleTouchStart = (e) => {
    const st = stateRef.current
    if (e.touches.length === 2) {
      st.pinching = true
      st.startDist = distancia(e.touches)
      st.startScale = scale
    } else if (e.touches.length === 1) {
      const now = Date.now()
      const touch = e.touches[0]
      if (now - st.lastTap < DOUBLE_TAP_MS) {
        toggleZoom(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect())
        st.lastTap = 0
      } else {
        st.lastTap = now
      }
      if (scale > 1) {
        st.dragging = true
        st.dragStart = { x: touch.clientX - translate.x, y: touch.clientY - translate.y }
      } else if (onSwipeLeft || onSwipeRight) {
        st.swiping = true
        st.swipeStartX = touch.clientX
      }
    }
  }

  const handleTouchMove = (e) => {
    const st = stateRef.current
    if (st.pinching && e.touches.length === 2) {
      e.preventDefault()
      const dist = distancia(e.touches)
      const nuevaEscala = Math.min(MAX_SCALE, Math.max(MIN_SCALE, st.startScale * (dist / st.startDist)))
      setScale(nuevaEscala)
    } else if (st.dragging && e.touches.length === 1 && scale > 1) {
      e.preventDefault()
      const touch = e.touches[0]
      setTranslate({ x: touch.clientX - st.dragStart.x, y: touch.clientY - st.dragStart.y })
    } else if (st.swiping && e.touches.length === 1) {
      const touch = e.touches[0]
      setTranslate({ x: touch.clientX - st.swipeStartX, y: 0 })
    }
  }

  const handleTouchEnd = (e) => {
    const st = stateRef.current
    if (e.touches.length < 2) st.pinching = false
    if (e.touches.length === 0) {
      st.dragging = false
      if (st.swiping) {
        st.swiping = false
        if (translate.x <= -SWIPE_THRESHOLD_PX && onSwipeLeft) {
          onSwipeLeft()
        } else if (translate.x >= SWIPE_THRESHOLD_PX && onSwipeRight) {
          onSwipeRight()
        } else {
          setTranslate({ x: 0, y: 0 })
        }
      } else if (scale < 1.05) {
        setScale(1)
        setTranslate({ x: 0, y: 0 })
      }
    }
  }

  const handleDoubleClick = (e) => {
    toggleZoom(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onContextMenu={onContextMenu}
      onLoad={onLoad}
      onError={onError}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        ...style,
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        transition: stateRef.current.pinching || stateRef.current.dragging || stateRef.current.swiping ? 'none' : 'transform 0.2s',
        touchAction: 'none',
        cursor: scale > 1 ? 'grab' : 'zoom-in',
      }}
    />
  )
}
