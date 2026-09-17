// Estados posibles del ciclo de vida de un reporte, y sus colores.
// "Pendiente" es el estado por defecto de todo reporte nuevo.
export const ESTADOS = ['Pendiente', 'En Proceso', 'Resuelto'];

export const ESTADO_COLOR = {
  'Pendiente': '#ef4444',
  'En Proceso': '#f59e0b',
  'Resuelto': '#10b981',
};

export function colorDeEstado(estado) {
  return ESTADO_COLOR[estado] || '#94a3b8';
}

// Días transcurridos desde que se creó el reporte (o hasta que se resolvió).
export function diasTranscurridos(creadoEn, resueltoEn) {
  if (!creadoEn) return null;
  const inicio = new Date(creadoEn + (creadoEn.endsWith('Z') ? '' : 'Z'));
  const fin = resueltoEn ? new Date(resueltoEn + (resueltoEn.endsWith('Z') ? '' : 'Z')) : new Date();
  const ms = fin - inicio;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
