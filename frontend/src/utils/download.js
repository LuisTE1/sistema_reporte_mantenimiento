import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Descarga una foto de evidencia al dispositivo.
 * - En el celular (APK): la guarda en la carpeta Documentos de la app,
 *   accesible desde cualquier explorador de archivos del teléfono.
 * - En navegador (PC): la descarga como cualquier archivo normal.
 */
export async function descargarImagen(url, showAlert) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('No se pudo descargar la imagen')
    const blob = await res.blob()
    const ext = blob.type.includes('webp') ? 'webp' : (blob.type.includes('png') ? 'png' : 'jpg')
    const fileName = `evidencia_${Date.now()}.${ext}`

    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(blob)
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents })
      showAlert?.('Foto descargada', `Se guardó como "${fileName}" en la carpeta Documentos del celular (visible desde un explorador de archivos).`)
    } else {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    }
  } catch (err) {
    console.error('Error descargando imagen:', err)
    showAlert?.('Error', 'No se pudo descargar la foto. Verifica tu conexión e intenta de nuevo.')
  }
}

/**
 * Descarga un archivo de texto (ej: un respaldo JSON) al dispositivo,
 * igual que descargarImagen pero para contenido generado en la app en vez
 * de una URL remota.
 */
export async function descargarTexto(fileName, contenido, mime, showAlert) {
  try {
    const blob = new Blob([contenido], { type: mime })
    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(blob)
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents })
      showAlert?.('Respaldo descargado', `Se guardó como "${fileName}" en la carpeta Documentos del celular.`)
    } else {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    }
  } catch (err) {
    console.error('Error descargando archivo:', err)
    showAlert?.('Error', 'No se pudo generar la descarga.')
  }
}
