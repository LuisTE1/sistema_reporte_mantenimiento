import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { descargarTexto } from '../utils/download'
import { DownloadIcon, TrashIcon, CheckCircleIcon, PulseIcon } from '../utils/icons'

// Convierte una URL pública de Supabase Storage de vuelta al "path" interno
// que necesita storage.remove() para borrar el archivo.
function urlAPath(url) {
  const marcador = '/object/public/evidencias/'
  const idx = url.indexOf(marcador)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marcador.length))
}

export default function MantenimientoSistema({ user, showAlert, showConfirm }) {
  const [errores, setErrores] = useState([])
  const [cargandoErrores, setCargandoErrores] = useState(true)
  const [diasUmbral, setDiasUmbral] = useState(90)
  const [candidatos, setCandidatos] = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [buscando, setBuscando] = useState(false)
  const [limpiando, setLimpiando] = useState(false)
  const [generandoRespaldo, setGenerandoRespaldo] = useState(false)

  const cargarErrores = async () => {
    setCargandoErrores(true)
    const { data } = await supabase.from('error_logs').select('*').order('creado_en', { ascending: false }).limit(50)
    setErrores(data || [])
    setCargandoErrores(false)
  }

  useEffect(() => { cargarErrores() }, [])

  const buscarCandidatos = async () => {
    setBuscando(true)
    setCandidatos(null)
    const limite = new Date(Date.now() - diasUmbral * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('reportes')
      .select('id, motivo, estacion_id, resuelto_en, fotos')
      .eq('estado', 'Resuelto')
      .lt('resuelto_en', limite)

    if (error) {
      showAlert('Error', 'No se pudo buscar: ' + error.message)
    } else {
      const conFotos = (data || []).filter(r => r.fotos && r.fotos.startsWith('http'))
      setCandidatos(conFotos)
      setSeleccionados(new Set(conFotos.map(r => r.id)))
    }
    setBuscando(false)
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ejecutarLimpieza = () => {
    if (seleccionados.size === 0) return
    showConfirm(
      'Confirmar eliminación',
      `Vas a borrar las fotos de ${seleccionados.size} reporte(s) resuelto(s) hace más de ${diasUmbral} días. El texto del reporte y su historial NO se borran, solo las fotos. Esta acción no se puede deshacer. ¿Continuar?`,
      async () => {
        setLimpiando(true)
        let ok = 0, fallidos = 0
        for (const reporte of candidatos.filter(r => seleccionados.has(r.id))) {
          try {
            const paths = reporte.fotos.split(',').map(urlAPath).filter(Boolean)
            if (paths.length > 0) {
              const { error: removeError } = await supabase.storage.from('evidencias').remove(paths)
              if (removeError) throw removeError
            }
            const fecha = new Date().toLocaleDateString()
            await supabase.from('reportes').update({ fotos: `Archivado (fotos eliminadas el ${fecha} para liberar espacio)` }).eq('id', reporte.id)
            ok++
          } catch (err) {
            console.error(err)
            fallidos++
          }
        }
        setLimpiando(false)
        setCandidatos(null)
        showAlert('Listo', `${ok} reporte(s) depurados.${fallidos > 0 ? ` ${fallidos} tuvieron error.` : ''}`)
      }
    )
  }

  const generarRespaldo = async () => {
    setGenerandoRespaldo(true)
    try {
      const [reportes, seguimiento, inventario, movimientos, usuarios] = await Promise.all([
        supabase.from('reportes').select('*'),
        supabase.from('reportes_seguimiento').select('*'),
        supabase.from('inventario').select('*'),
        supabase.from('inventario_movimientos').select('*'),
        supabase.from('usuarios').select('id, nombre, nombre_completo, rol, estaciones, permiso_dashboard, permiso_soluciones, permiso_inventario, permiso_config, permiso_editar_reportes, permiso_grifos, permiso_unidades'),
      ])
      const respaldo = {
        generado_en: new Date().toISOString(),
        generado_por: user.nombre,
        reportes: reportes.data,
        reportes_seguimiento: seguimiento.data,
        inventario: inventario.data,
        inventario_movimientos: movimientos.data,
        usuarios: usuarios.data,
      }
      await descargarTexto(`respaldo_${Date.now()}.json`, JSON.stringify(respaldo, null, 2), 'application/json', showAlert)
    } catch (err) {
      showAlert('Error', 'No se pudo generar el respaldo: ' + err.message)
    } finally {
      setGenerandoRespaldo(false)
    }
  }

  return (
    <div className="table-container">
      <h3 className="mb-4">Mantenimiento del Sistema</h3>

      <div style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
        <h4 style={{marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><DownloadIcon size={18} /> Respaldo de Datos</h4>
        <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '1rem'}}>Descarga un archivo con todos los reportes, seguimientos, inventario y usuarios (sin contraseñas). Las fotos NO se incluyen en el archivo (siguen en Supabase Storage); esto es un respaldo de los datos, no de las imágenes.</p>
        <button className="btn-primary" style={{width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}} disabled={generandoRespaldo} onClick={generarRespaldo}>
          <DownloadIcon size={16} /> {generandoRespaldo ? 'Generando...' : 'Descargar Respaldo (JSON)'}
        </button>
      </div>

      <div style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
        <h4 style={{marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><TrashIcon size={18} /> Depurar Fotos Antiguas</h4>
        <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '1rem'}}>
          Busca reportes ya <strong>Resueltos</strong> hace más de cierto tiempo y permite borrar sus fotos para liberar espacio (el texto del reporte y su historial se conservan). No se ejecuta solo — tú decides cuándo y revisas la lista antes de confirmar.
        </p>
        <div style={{display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap'}}>
          <label style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Resueltos hace más de</label>
          <input type="number" min="1" value={diasUmbral} onChange={e => setDiasUmbral(parseInt(e.target.value) || 1)} style={{width: '80px', padding: '0.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'white', border: '1px solid var(--border-soft)'}} />
          <label style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>días</label>
          <button className="btn-toggle" style={{width: 'auto'}} disabled={buscando} onClick={buscarCandidatos}>{buscando ? 'Buscando...' : 'Buscar'}</button>
        </div>

        {candidatos !== null && (
          candidatos.length === 0 ? (
            <p className="text-muted">No hay reportes que cumplan ese criterio.</p>
          ) : (
            <>
              <div style={{maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem'}}>
                {candidatos.map(r => (
                  <label key={r.id} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem'}}>
                    <input type="checkbox" checked={seleccionados.has(r.id)} onChange={() => toggleSeleccion(r.id)} />
                    <span>#{r.id} · {r.motivo} · {r.estacion_id} · resuelto {r.resuelto_en ? new Date(r.resuelto_en + (r.resuelto_en.endsWith('Z') ? '' : 'Z')).toLocaleDateString() : '?'}</span>
                  </label>
                ))}
              </div>
              <button className="btn-toggle" style={{borderColor: 'var(--danger)', color: 'var(--danger)', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}} disabled={limpiando || seleccionados.size === 0} onClick={ejecutarLimpieza}>
                <TrashIcon size={16} /> {limpiando ? 'Eliminando...' : `Eliminar fotos de ${seleccionados.size} seleccionado(s)`}
              </button>
            </>
          )
        )}
      </div>

      <div style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
          <h4 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><PulseIcon size={18} /> Errores Recientes de la App</h4>
          <button className="btn-text" onClick={cargarErrores}>Actualizar</button>
        </div>
        {cargandoErrores ? (
          <p className="text-muted">Cargando...</p>
        ) : errores.length === 0 ? (
          <p className="text-muted" style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><CheckCircleIcon size={16} style={{color: 'var(--accent)'}} /> Sin errores registrados.</p>
        ) : (
          <div style={{maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            {errores.map(err => (
              <div key={err.id} style={{background: 'var(--bg-elevated)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--danger)', fontSize: '0.8rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                  <span>{err.usuario || 'Anónimo'}</span>
                  <span>{err.creado_en ? new Date(err.creado_en + (err.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</span>
                </div>
                <div style={{color: 'var(--text-soft)'}}>{err.mensaje}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
