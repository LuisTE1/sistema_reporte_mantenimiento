import { Capacitor, registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Plugin nativo propio (android/.../GallerySaverPlugin.java): guarda un
// archivo directo en la Galería de Fotos de Android usando MediaStore, sin
// pasar por el selector de "Compartir" y sin pedir permisos en Android 10+.
const GallerySaver = registerPlugin('GallerySaver')

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Android 10+ ya no permite escribir directo a la carpeta pública "Documentos"
// sin permisos especiales (almacenamiento con ámbito/"scoped storage"). Para
// fotos usamos el plugin nativo propio GallerySaver, que las inserta directo
// en la Galería vía MediaStore (sin permisos, sin selector de por medio).
async function guardarImagenNativa(fileName, blob) {
  const base64 = await blobToBase64(blob)
  await GallerySaver.saveBase64Image({ data: base64, fileName, mimeType: blob.type || 'image/jpeg' })
}

// Para archivos que no son fotos (ej: el respaldo JSON) no aplica MediaStore
// de imágenes: se guarda en la caché privada de la app y se abre el selector
// nativo "Compartir/Guardar" para que el usuario elija dónde ponerlo.
async function guardarArchivoNativo(fileName, blob) {
  const base64 = await blobToBase64(blob)
  await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
  await Share.share({ url: uri, dialogTitle: 'Guardar o compartir' })
}

function descargarWeb(fileName, blob) {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Descarga una foto de evidencia al dispositivo.
 * - En el celular (APK): la guarda directo en la Galería de Fotos (álbum
 *   "ControlOperativo"), sin selector ni permisos de por medio.
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
      await guardarImagenNativa(fileName, blob)
      showAlert?.('Foto guardada', 'Se guardó en la Galería, en el álbum "ControlOperativo".')
    } else {
      descargarWeb(fileName, blob)
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
      await guardarArchivoNativo(fileName, blob)
    } else {
      descargarWeb(fileName, blob)
    }
  } catch (err) {
    console.error('Error descargando archivo:', err)
    showAlert?.('Error', 'No se pudo generar la descarga.')
  }
}
