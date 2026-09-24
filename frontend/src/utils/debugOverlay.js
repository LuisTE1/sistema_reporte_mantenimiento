// Recuadro fijo en pantalla para depurar en el celular sin herramientas de
// desarrollador — nada de esto se usa fuera de esta investigación puntual
// (queda controlado por DEBUG_OVERLAY en cada archivo que lo usa).
export function debugLog(msg) {
  console.log('[debug]', msg)
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
