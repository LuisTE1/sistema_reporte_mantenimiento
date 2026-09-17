import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { compressImage } from '../utils/image'
import { colorDeEstado, diasTranscurridos } from '../utils/estado'

/**
 * Historial de seguimiento de un reporte + formulario para actualizar su
 * estado (Pendiente / En Proceso / Resuelto) con una nueva descripción y
 * fotos, sin perder el reporte original. Se usa igual desde Operario y
 * desde Gerencia.
 *
 * Props:
 *  - reporte: el reporte actualmente abierto (reporteModal)
 *  - user: usuario logueado (para creado_por)
 *  - showAlert(title, message): modal de alerta de la pantalla que lo usa
 *  - openPreview(gallery, url): abre el lightbox compartido de fotos
 *  - onEstadoActualizado(nuevoEstado, resueltoEn): notifica al padre para
 *    que actualice su copia local del reporte (lista + modal)
 */
// Solo se puede avanzar de estado, nunca "retroceder" en una actualización normal:
// Pendiente -> En Proceso / Resuelto ; En Proceso -> Resuelto.
// Una vez Resuelto queda bloqueado para todos, excepto quien tenga permiso de
// editar reportes, que puede "reabrir" el caso (volverlo a Pendiente o En Proceso).
const SIGUIENTES_ESTADOS = {
  'Pendiente': ['En Proceso', 'Resuelto'],
  'En Proceso': ['Resuelto'],
  'Resuelto': [],
}
const ESTADOS_REAPERTURA = ['Pendiente', 'En Proceso']

export default function ReporteSeguimiento({ reporte, user, showAlert, openPreview, onEstadoActualizado }) {
  const [seguimientos, setSeguimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState(null)
  const [descripcionUpdate, setDescripcionUpdate] = useState('')
  const [fotosUpdate, setFotosUpdate] = useState([])
  const [guardando, setGuardando] = useState(false)

  const puedeEditar = !!user.permiso_editar_reportes
  const estaResuelto = reporte.estado === 'Resuelto'
  const opcionesEstado = estaResuelto ? ESTADOS_REAPERTURA : (SIGUIENTES_ESTADOS[reporte.estado || 'Pendiente'] || [])

  useEffect(() => {
    let activo = true
    setCargando(true)
    supabase.from('reportes_seguimiento').select('*').eq('reporte_id', reporte.id).order('creado_en', { ascending: true })
      .then(({ data }) => {
        if (activo && data) setSeguimientos(data)
        if (activo) setCargando(false)
      })
    return () => { activo = false }
  }, [reporte.id])

  const handleFotosUpdate = async (e) => {
    const filesArray = Array.from(e.target.files)
    e.target.value = ''
    const nuevas = await Promise.all(filesArray.map(async file => {
      let comprimido = file
      try { comprimido = await compressImage(file) } catch (err) { console.error(err) }
      return { file: comprimido, preview: URL.createObjectURL(comprimido) }
    }))
    setFotosUpdate(prev => [...prev, ...nuevas])
  }

  const removeFotoUpdate = (i) => {
    setFotosUpdate(prev => {
      const target = prev[i]
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleGuardar = async () => {
    if (!nuevoEstado) {
      showAlert('Atención', 'Selecciona el nuevo estado.')
      return
    }
    if (!descripcionUpdate.trim()) {
      showAlert('Atención', 'Describe brevemente qué pasó (ej: "Llegó la batería, se instaló correctamente").')
      return
    }
    setGuardando(true)
    try {
      const urls = []
      for (const fotoObj of fotosUpdate) {
        const fileExt = fotoObj.file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `seguimiento/${fileName}`
        // cacheControl largo: cada foto es un archivo único e inmutable (nunca se
        // sobreescribe), así que el navegador la puede guardar en caché mucho
        // tiempo y no se vuelve a descargar cada vez que se abre.
        const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, fotoObj.file, { cacheControl: '31536000' })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filePath)
        urls.push(urlData.publicUrl)
      }

      const { data: nuevoRegistro, error: seguimientoError } = await supabase.from('reportes_seguimiento').insert([{
        reporte_id: reporte.id,
        estado_nuevo: nuevoEstado,
        descripcion: descripcionUpdate,
        fotos: urls.length > 0 ? urls.join(',') : 'Sin foto',
        creado_por: user.nombre
      }]).select().single()
      if (seguimientoError) throw seguimientoError

      const resueltoEn = nuevoEstado === 'Resuelto' ? new Date().toISOString() : null
      const { error: updateError } = await supabase.from('reportes').update({ estado: nuevoEstado, resuelto_en: resueltoEn }).eq('id', reporte.id)
      if (updateError) throw updateError

      setSeguimientos(prev => [...prev, nuevoRegistro])
      setDescripcionUpdate('')
      setFotosUpdate([])
      setNuevoEstado(null)
      setMostrarForm(false)
      setReabriendo(false)
      onEstadoActualizado(nuevoEstado, resueltoEn)
      showAlert('Éxito', 'Se actualizó el estado del reporte.')
    } catch (err) {
      console.error(err)
      showAlert('Error', 'No se pudo guardar la actualización. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const dias = diasTranscurridos(reporte.creado_en, reporte.resuelto_en)

  return (
    <div style={{marginTop: '1.5rem'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
        <small style={{color: '#94a3b8'}}>Historial de Seguimiento</small>
        <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>
          {reporte.estado === 'Resuelto' ? `Resuelto en ${dias} día(s)` : `${dias} día(s) sin resolver`}
        </span>
      </div>

      {cargando ? (
        <p className="text-muted" style={{fontSize: '0.85rem'}}>Cargando historial...</p>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem'}}>
          {seguimientos.length === 0 && (
            <p className="text-muted" style={{fontSize: '0.85rem'}}>Aún no hay actualizaciones para este reporte.</p>
          )}
          {seguimientos.map(s => (
            <div key={s.id} style={{background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `3px solid ${colorDeEstado(s.estado_nuevo)}`}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(s.estado_nuevo), background: colorDeEstado(s.estado_nuevo) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px'}}>{s.estado_nuevo}</span>
                <span style={{fontSize: '0.75rem', color: '#64748b'}}>{s.creado_en ? new Date(s.creado_en + (s.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''} · {s.creado_por}</span>
              </div>
              <p style={{margin: 0, color: '#e2e8f0', fontSize: '0.9rem', whiteSpace: 'pre-wrap'}}>{s.descripcion}</p>
              {s.fotos && s.fotos !== 'Sin foto' && (
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                  {(() => {
                    const lista = s.fotos.split(',')
                    const galeria = lista.filter(f => f.startsWith('http'))
                    return lista.map((f, i) => f.startsWith('http') && (
                      <div key={i} onClick={() => openPreview(galeria, f)} onContextMenu={(e) => e.preventDefault()} style={{cursor: 'pointer'}}>
                        <img src={f} alt="Evidencia de seguimiento" loading="lazy" draggable={false} style={{height: '70px', borderRadius: '6px', border: '1px solid #475569', objectFit: 'cover', pointerEvents: 'none'}} />
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        estaResuelto ? (
          puedeEditar ? (
            <button type="button" className="btn-secondary full-width" style={{borderColor: '#f59e0b', color: '#f59e0b'}} onClick={() => { setNuevoEstado(null); setReabriendo(true); setMostrarForm(true) }}>
              🔓 Reabrir Reporte
            </button>
          ) : (
            <p className="text-muted" style={{fontSize: '0.85rem', textAlign: 'center'}}>✅ Este reporte ya fue resuelto. Solo un usuario con permiso de editar reportes puede reabrirlo.</p>
          )
        ) : (
          <button type="button" className="btn-secondary full-width" onClick={() => { setNuevoEstado(null); setReabriendo(false); setMostrarForm(true) }}>
            🔄 Actualizar Estado
          </button>
        )
      ) : (
        <div style={{background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155'}}>
          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8'}}>{reabriendo ? 'Reabrir con estado' : 'Nuevo estado'}</label>
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap'}}>
            {opcionesEstado.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setNuevoEstado(e)}
                style={{
                  flex: '1 1 100px', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
                  border: `1px solid ${colorDeEstado(e)}`,
                  background: nuevoEstado === e ? colorDeEstado(e) : 'transparent',
                  color: nuevoEstado === e ? '#0f172a' : colorDeEstado(e),
                  fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >{e}</button>
            ))}
          </div>

          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8'}}>¿Qué pasó? (obligatorio)</label>
          <textarea
            value={descripcionUpdate}
            onChange={e => setDescripcionUpdate(e.target.value)}
            placeholder="Ej: Llegó la batería nueva, se instaló y quedó operativo."
            rows={3}
            style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155', marginBottom: '1rem', resize: 'vertical'}}
          />

          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8'}}>Fotos (opcional)</label>
          <input type="file" multiple accept="image/*" onChange={handleFotosUpdate} style={{color: 'white', width: '100%', marginBottom: '0.75rem'}} />
          {fotosUpdate.length > 0 && (
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
              {fotosUpdate.map((f, i) => (
                <div key={i} style={{position: 'relative'}}>
                  <img src={f.preview} alt="Nueva evidencia" style={{height: '60px', borderRadius: '6px', border: '1px solid #10b981', objectFit: 'cover'}} />
                  <button type="button" onClick={() => removeFotoUpdate(i)} style={{position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer'}}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display: 'flex', gap: '0.75rem'}}>
            <button type="button" className="btn-primary" style={{flex: 1}} disabled={guardando} onClick={handleGuardar}>
              {guardando ? 'Guardando...' : 'Guardar Actualización'}
            </button>
            <button type="button" className="btn-secondary" style={{flex: 1}} disabled={guardando} onClick={() => { setMostrarForm(false); setReabriendo(false) }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
