import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
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
// Cualquier usuario puede dejar avances (descripción + foto) libremente,
// tanto para pasar a "En Proceso" como para seguir agregando actualizaciones
// una vez ya está en proceso — "En Proceso" nunca se bloquea para nadie.
// "Resuelto" es la única transición restringida (se filtra más abajo según
// permiso). Una vez Resuelto queda bloqueado para todos, excepto quien tenga
// permiso de editar reportes, que puede "reabrir" el caso.
const SIGUIENTES_ESTADOS = {
  'Pendiente': ['En Proceso', 'Resuelto'],
  'En Proceso': ['En Proceso', 'Resuelto'],
  'Resuelto': [],
}

export default function ReporteSeguimiento({ reporte, user, showAlert, openPreview, onEstadoActualizado }) {
  const [seguimientos, setSeguimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState(null)
  const [descripcionUpdate, setDescripcionUpdate] = useState('')
  const [fotosUpdate, setFotosUpdate] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)

  // Edición/eliminación de una entrada puntual del historial (corregir un
  // dato mal puesto) — a diferencia de "Actualizar Estado", esto nunca toca
  // quién la creó ni cuándo, solo corrige descripción/fotos.
  const [editandoId, setEditandoId] = useState(null)
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editFotosExistentes, setEditFotosExistentes] = useState([])
  const [editFotosNuevas, setEditFotosNuevas] = useState([])
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  const puedeEditar = !!user.permiso_editar_reportes
  const esCreador = reporte.creado_por === user.nombre
  // Cualquier usuario puede avanzar un reporte a "En Proceso" y dejar su
  // descripción/foto; pero solo quien lo creó (o tenga permiso de editar
  // reportes) puede marcarlo como "Resuelto" — cerrarlo del todo.
  const puedeResolver = esCreador || puedeEditar
  const estaResuelto = reporte.estado === 'Resuelto'
  const opcionesEstado = (SIGUIENTES_ESTADOS[reporte.estado || 'Pendiente'] || [])
    .filter(e => e !== 'Resuelto' || puedeResolver)

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

  const tomarFotoUpdate = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      })
      const response = await fetch(image.webPath)
      const blob = await response.blob()
      const rawFile = new File([blob], `foto_${Date.now()}.${image.format}`, { type: `image/${image.format}` })
      let comprimido = rawFile
      try { comprimido = await compressImage(rawFile) } catch (err) { console.error(err) }
      setFotosUpdate(prev => [...prev, { file: comprimido, preview: URL.createObjectURL(comprimido) }])
    } catch (error) {
      console.log('Camera error or user cancelled:', error)
    }
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
      // Revisa el estado REAL en el servidor justo antes de guardar — si
      // alguien más ya lo resolvió mientras tenías este formulario abierto
      // (la pantalla no se entera al instante), esto corta el guardado en
      // vez de dejar que se genere una actualización sobre un reporte que
      // ya estaba cerrado.
      const { data: fresco } = await supabase.from('reportes').select('estado, resuelto_en').eq('id', reporte.id).single()
      if (fresco && fresco.estado === 'Resuelto' && reporte.estado !== 'Resuelto') {
        showAlert('Ya fue resuelto', 'Otra persona ya marcó este reporte como Resuelto mientras lo tenías abierto. Se actualizó la pantalla.')
        onEstadoActualizado(fresco.estado, fresco.resuelto_en)
        setMostrarForm(false)
        setGuardando(false)
        return
      }

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
      onEstadoActualizado(nuevoEstado, resueltoEn)
      showAlert('Éxito', 'Se actualizó el estado del reporte.')
    } catch (err) {
      console.error(err)
      showAlert('Error', 'No se pudo guardar la actualización. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Reabrir es una acción directa de un click: solo vuelve el reporte a
  // Pendiente y deja constancia en el historial de quién y cuándo lo reabrió.
  // Quien deba avanzarlo de nuevo lo hace después con "Actualizar Estado",
  // eligiendo ahí el estado que corresponda.
  const handleReabrir = async () => {
    setReabriendo(true)
    try {
      const { data: nuevoRegistro, error: seguimientoError } = await supabase.from('reportes_seguimiento').insert([{
        reporte_id: reporte.id,
        estado_nuevo: 'Pendiente',
        descripcion: 'Reporte reabierto.',
        fotos: 'Sin foto',
        creado_por: user.nombre
      }]).select().single()
      if (seguimientoError) throw seguimientoError

      const { error: updateError } = await supabase.from('reportes').update({ estado: 'Pendiente', resuelto_en: null }).eq('id', reporte.id)
      if (updateError) throw updateError

      setSeguimientos(prev => [...prev, nuevoRegistro])
      onEstadoActualizado('Pendiente', null)
      showAlert('Reporte reabierto', 'El reporte volvió a estado Pendiente.')
    } catch (err) {
      console.error(err)
      showAlert('Error', 'No se pudo reabrir el reporte. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setReabriendo(false)
    }
  }

  // Solo quien creó el REPORTE (no la entrada individual del historial) o
  // quien tenga permiso de editar reportes puede corregir/eliminar CUALQUIER
  // entrada del historial — incluidas las que dejó otra persona. Quien solo
  // aportó un avance (ej. "se pidió el repuesto") no tiene ese poder sobre
  // lo que escribió, únicamente puede seguir agregando información nueva.
  const puedeCorregir = esCreador || puedeEditar

  const iniciarEdicion = (s) => {
    setEditandoId(s.id)
    setEditDescripcion(s.descripcion || '')
    setEditFotosExistentes(s.fotos && s.fotos !== 'Sin foto' ? s.fotos.split(',').filter(f => f.startsWith('http')) : [])
    setEditFotosNuevas([])
  }

  const cancelarEdicion = () => {
    editFotosNuevas.forEach(f => f.preview && URL.revokeObjectURL(f.preview))
    setEditandoId(null)
    setEditFotosNuevas([])
  }

  const handleFotosEdicion = async (e) => {
    const filesArray = Array.from(e.target.files)
    e.target.value = ''
    const nuevas = await Promise.all(filesArray.map(async file => {
      let comprimido = file
      try { comprimido = await compressImage(file) } catch (err) { console.error(err) }
      return { file: comprimido, preview: URL.createObjectURL(comprimido) }
    }))
    setEditFotosNuevas(prev => [...prev, ...nuevas])
  }

  const tomarFotoEdicion = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      })
      const response = await fetch(image.webPath)
      const blob = await response.blob()
      const rawFile = new File([blob], `foto_${Date.now()}.${image.format}`, { type: `image/${image.format}` })
      let comprimido = rawFile
      try { comprimido = await compressImage(rawFile) } catch (err) { console.error(err) }
      setEditFotosNuevas(prev => [...prev, { file: comprimido, preview: URL.createObjectURL(comprimido) }])
    } catch (error) {
      console.log('Camera error or user cancelled:', error)
    }
  }

  const removeFotoExistenteEdicion = (url) => {
    setEditFotosExistentes(prev => prev.filter(f => f !== url))
  }

  const removeFotoNuevaEdicion = (i) => {
    setEditFotosNuevas(prev => {
      const target = prev[i]
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const guardarEdicion = async (s) => {
    if (!editDescripcion.trim()) {
      showAlert('Atención', 'La descripción no puede quedar vacía.')
      return
    }
    setGuardandoEdicion(true)
    try {
      const urlsNuevas = []
      for (const fotoObj of editFotosNuevas) {
        const fileExt = fotoObj.file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `seguimiento/${fileName}`
        const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, fotoObj.file, { cacheControl: '31536000' })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filePath)
        urlsNuevas.push(urlData.publicUrl)
      }
      const fotosFinal = [...editFotosExistentes, ...urlsNuevas]

      // Ojo: nunca se toca creado_por ni creado_en — solo se corrige el
      // contenido, la autoría original del registro queda intacta.
      const { error } = await supabase.from('reportes_seguimiento').update({
        descripcion: editDescripcion,
        fotos: fotosFinal.length > 0 ? fotosFinal.join(',') : 'Sin foto',
      }).eq('id', s.id)
      if (error) throw error

      setSeguimientos(prev => prev.map(x => x.id === s.id ? { ...x, descripcion: editDescripcion, fotos: fotosFinal.length > 0 ? fotosFinal.join(',') : 'Sin foto' } : x))
      cancelarEdicion()
      showAlert('Éxito', 'Se corrigió el registro del historial.')
    } catch (err) {
      console.error(err)
      showAlert('Error', 'No se pudo guardar la corrección. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const eliminarSeguimiento = async (s) => {
    if (!window.confirm('¿Eliminar este registro del historial? Esta acción no se puede deshacer.')) return
    setEliminandoId(s.id)
    try {
      const { error } = await supabase.from('reportes_seguimiento').delete().eq('id', s.id)
      if (error) throw error
      setSeguimientos(prev => prev.filter(x => x.id !== s.id))
    } catch (err) {
      console.error(err)
      showAlert('Error', 'No se pudo eliminar el registro. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setEliminandoId(null)
    }
  }

  const dias = diasTranscurridos(reporte.creado_en, reporte.resuelto_en)

  return (
    <div style={{marginTop: '1.5rem'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
        <small style={{color: 'var(--text-muted)'}}>Historial de Seguimiento</small>
        <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
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
            <div key={s.id} style={{background: 'var(--bg-elevated)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${colorDeEstado(s.estado_nuevo)}`}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(s.estado_nuevo), background: colorDeEstado(s.estado_nuevo) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px'}}>{s.estado_nuevo}</span>
                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{s.creado_en ? new Date(s.creado_en + (s.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''} · {s.creado_por}</span>
              </div>

              {editandoId === s.id ? (
                <div>
                  <textarea
                    value={editDescripcion}
                    onChange={e => setEditDescripcion(e.target.value)}
                    rows={3}
                    style={{width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)', color: 'white', border: '1px solid var(--border-soft)', marginBottom: '0.75rem', resize: 'vertical'}}
                  />
                  {editFotosExistentes.length > 0 && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem'}}>
                      {editFotosExistentes.map((f, i) => (
                        <div key={i} style={{position: 'relative'}}>
                          <img src={f} alt="Evidencia" onClick={() => openPreview(editFotosExistentes, f)} style={{height: '60px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--text-muted)', objectFit: 'cover', cursor: 'pointer'}} />
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFotoExistenteEdicion(f) }} style={{position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer'}}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {editFotosNuevas.length > 0 && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem'}}>
                      {editFotosNuevas.map((f, i) => (
                        <div key={i} style={{position: 'relative'}}>
                          <img src={f.preview} alt="Nueva evidencia" onClick={() => openPreview([f.preview], f.preview)} style={{height: '60px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', objectFit: 'cover', cursor: 'pointer'}} />
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFotoNuevaEdicion(i) }} style={{position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer'}}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap'}}>
                    <button type="button" onClick={tomarFotoEdicion} className="btn-toggle" style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}>📸 Tomar Foto</button>
                    <label className="btn-toggle" style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0}}>
                      Subir Archivo
                      <input type="file" multiple accept="image/*" onChange={handleFotosEdicion} style={{display: 'none'}} />
                    </label>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button type="button" className="btn-primary" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem'}} disabled={guardandoEdicion} onClick={() => guardarEdicion(s)}>
                      {guardandoEdicion ? 'Guardando...' : 'Guardar Corrección'}
                    </button>
                    <button type="button" className="btn-toggle" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem'}} disabled={guardandoEdicion} onClick={cancelarEdicion}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{margin: 0, color: 'var(--text-soft)', fontSize: '0.9rem', whiteSpace: 'pre-wrap'}}>{s.descripcion}</p>
                  {s.fotos && s.fotos !== 'Sin foto' && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                      {(() => {
                        const lista = s.fotos.split(',')
                        const galeria = lista.filter(f => f.startsWith('http'))
                        return lista.map((f, i) => f.startsWith('http') && (
                          <div key={i} onClick={() => openPreview(galeria, f)} onContextMenu={(e) => e.preventDefault()} style={{cursor: 'pointer'}}>
                            <img src={f} alt="Evidencia de seguimiento" loading="lazy" draggable={false} style={{height: '70px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--text-muted)', objectFit: 'cover', pointerEvents: 'none'}} />
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                  {puedeCorregir && (
                    <div style={{display: 'flex', gap: '1rem', marginTop: '0.5rem'}}>
                      <button type="button" className="btn-text" style={{padding: 0, fontSize: '0.75rem', color: 'var(--primary)'}} onClick={() => iniciarEdicion(s)}>✏️ Corregir</button>
                      <button type="button" className="btn-text" style={{padding: 0, fontSize: '0.75rem', color: 'var(--danger)'}} disabled={eliminandoId === s.id} onClick={() => eliminarSeguimiento(s)}>
                        {eliminandoId === s.id ? 'Eliminando...' : '🗑️ Eliminar'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        estaResuelto ? (
          puedeEditar ? (
            <button type="button" className="btn-toggle full-width" style={{borderColor: 'var(--warning)', color: 'var(--warning)'}} disabled={reabriendo} onClick={handleReabrir}>
              {reabriendo ? 'Reabriendo...' : '🔓 Reabrir Reporte'}
            </button>
          ) : (
            <p className="text-muted" style={{fontSize: '0.85rem', textAlign: 'center'}}>✅ Este reporte ya fue resuelto. Solo un usuario con permiso de editar reportes puede reabrirlo.</p>
          )
        ) : (
          <button type="button" className="btn-toggle full-width" onClick={() => { setNuevoEstado(null); setMostrarForm(true) }}>
            🔄 Actualizar Estado
          </button>
        )
      ) : (
        <div style={{background: 'var(--card-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)'}}>
          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Nuevo estado</label>
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap'}}>
            {opcionesEstado.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setNuevoEstado(e)}
                style={{
                  flex: '1 1 100px', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: `1px solid ${colorDeEstado(e)}`,
                  background: nuevoEstado === e ? colorDeEstado(e) : 'transparent',
                  color: nuevoEstado === e ? 'var(--card-bg)' : colorDeEstado(e),
                  fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >{e}</button>
            ))}
          </div>

          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>¿Qué pasó? (obligatorio)</label>
          <textarea
            value={descripcionUpdate}
            onChange={e => setDescripcionUpdate(e.target.value)}
            placeholder="Ej: Llegó la batería nueva, se instaló y quedó operativo."
            rows={3}
            style={{width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'white', border: '1px solid var(--border-soft)', marginBottom: '1rem', resize: 'vertical'}}
          />

          <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Fotos (opcional)</label>
          <button type="button" onClick={tomarFotoUpdate} className="btn-primary" style={{width: '100%', padding: '0.6rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
            📸 Tomar Foto Nativa
          </button>
          <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>O subir desde archivos:</div>
          <input type="file" multiple accept="image/*" onChange={handleFotosUpdate} style={{color: 'white', width: '100%', marginBottom: '0.75rem'}} />
          {fotosUpdate.length > 0 && (
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
              {fotosUpdate.map((f, i) => (
                <div key={i} style={{position: 'relative'}}>
                  <img src={f.preview} alt="Nueva evidencia" onClick={() => openPreview([f.preview], f.preview)} style={{height: '60px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', objectFit: 'cover', cursor: 'pointer'}} />
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeFotoUpdate(i) }} style={{position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer'}}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display: 'flex', gap: '0.75rem'}}>
            <button type="button" className="btn-primary" style={{flex: 1}} disabled={guardando} onClick={handleGuardar}>
              {guardando ? 'Guardando...' : 'Guardar Actualización'}
            </button>
            <button type="button" className="btn-toggle" style={{flex: 1}} disabled={guardando} onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
