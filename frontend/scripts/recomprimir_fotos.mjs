// Script de un solo uso: recomprime las fotos que se subieron ANTES de que
// existiera la compresión automática (quedaron pesando varios MB cada una).
// Descarga cada foto pesada, la reduce a 1024px de ancho en WebP calidad 60
// (igual que hace la app ahora al subir), la vuelve a subir, y actualiza el
// reporte para que apunte a la versión liviana.
//
// Uso:  node scripts/recomprimir_fotos.mjs
//
// No borra los archivos viejos del bucket (la llave pública de la app no
// tiene permiso de borrar en Storage) — quedan sueltos y se pueden borrar
// a mano desde el Dashboard de Supabase > Storage > evidencias si se quiere
// recuperar ese espacio.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = 'https://vbbrhzclzrpwzlbqmsvk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYnJoemNsenJwd3psYnFtc3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDk2MTUsImV4cCI6MjEwMzg4NTYxNX0.AMF8Lwb2GkrsF6gvF_rkMItF_-GmXLB5A9aIg7m6K4M'
const UMBRAL_BYTES = 250 * 1024 // solo recomprime fotos de más de 250KB
const MAX_ANCHO = 1024
const CALIDAD_WEBP = 60

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function recomprimirUrl(url, carpeta) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length <= UMBRAL_BYTES) return null // ya es liviana, no hace falta

  const salida = await sharp(buffer)
    .resize({ width: MAX_ANCHO, withoutEnlargement: true })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer()

  const nombre = `${carpeta}/recomprimida_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
  const { error } = await supabase.storage.from('evidencias').upload(nombre, salida, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw error
  const { data } = supabase.storage.from('evidencias').getPublicUrl(nombre)
  return { nuevaUrl: data.publicUrl, antes: buffer.length, despues: salida.length }
}

async function procesarTabla(tabla, carpeta) {
  const { data: filas, error } = await supabase.from(tabla).select('id, fotos')
  if (error) throw error

  let procesadas = 0, bytesAntes = 0, bytesDespues = 0
  for (const fila of filas) {
    if (!fila.fotos || fila.fotos === 'Sin foto') continue
    const urls = fila.fotos.split(',')
    let cambio = false
    const nuevasUrls = []

    for (const url of urls) {
      if (!url.startsWith('http') || url.endsWith('.webp')) {
        nuevasUrls.push(url)
        continue
      }
      try {
        const resultado = await recomprimirUrl(url, carpeta)
        if (resultado) {
          nuevasUrls.push(resultado.nuevaUrl)
          cambio = true
          procesadas++
          bytesAntes += resultado.antes
          bytesDespues += resultado.despues
          console.log(`  ✓ ${tabla}#${fila.id}: ${(resultado.antes/1024/1024).toFixed(2)}MB -> ${(resultado.despues/1024).toFixed(0)}KB`)
        } else {
          nuevasUrls.push(url)
        }
      } catch (err) {
        console.error(`  ✗ ${tabla}#${fila.id} (${url}):`, err.message)
        nuevasUrls.push(url)
      }
    }

    if (cambio) {
      const { error: updateError } = await supabase.from(tabla).update({ fotos: nuevasUrls.join(',') }).eq('id', fila.id)
      if (updateError) console.error(`  ✗ No se pudo actualizar ${tabla}#${fila.id}:`, updateError.message)
    }
  }
  return { procesadas, bytesAntes, bytesDespues }
}

async function main() {
  console.log('Recomprimiendo fotos de reportes...')
  const r1 = await procesarTabla('reportes', 'reportes')
  console.log('Recomprimiendo fotos de seguimiento...')
  const r2 = await procesarTabla('reportes_seguimiento', 'seguimiento')

  const total = r1.procesadas + r2.procesadas
  const antes = r1.bytesAntes + r2.bytesAntes
  const despues = r1.bytesDespues + r2.bytesDespues
  console.log(`\nListo. ${total} foto(s) recomprimidas.`)
  if (total > 0) {
    console.log(`Peso total: ${(antes/1024/1024).toFixed(2)}MB -> ${(despues/1024/1024).toFixed(2)}MB (${(100 - despues/antes*100).toFixed(0)}% menos)`)
  }
  console.log('\nNota: las fotos originales pesadas siguen en el bucket "evidencias" (la app no tiene permiso de borrarlas).')
  console.log('Si quieres recuperar ese espacio, bórralas a mano desde el Dashboard de Supabase > Storage > evidencias,')
  console.log('o pide que se agregue una política de borrado para automatizarlo la próxima vez.')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
