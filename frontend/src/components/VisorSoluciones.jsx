import React, { useState } from 'react'
import { colorDeEstado, diasTranscurridos } from '../utils/estado'

// Visor de Soluciones: lista de reportes con filtros por módulo (Grifos /
// Unidades) y estación. Es el mismo componente para el modo Operario y para
// el Panel Administrativo (Gerencia) — así ambos se ven y funcionan igual;
// lo único que cambia entre uno y otro es qué puede ver/editar cada usuario,
// según sus permisos (ABAC), no el componente en sí.
export default function VisorSoluciones({ reportes, user, estacionesPermitidas, displayIslaLado, setReporteModal }) {
  const [visorModulo, setVisorModulo] = useState('grifo')
  const [filtroEstaciones, setFiltroEstaciones] = useState([])
  const [busquedaPlaca, setBusquedaPlaca] = useState('')
  const [verTodosPendientes, setVerTodosPendientes] = useState(false)

  const puedeVerGrifos = user.permisos.verGrifos !== false
  const puedeVerUnidades = user.permisos.verUnidades === true

  // Si el usuario solo tiene acceso de vista a uno de los dos módulos, no se
  // le muestra el selector: se manda directo al único módulo que sí puede ver.
  // Si no tiene acceso a ninguno, no se fuerza ningún módulo (se muestra el
  // aviso de que no tiene acceso, en vez de mostrar Unidades por defecto).
  const visorModuloEfectivo = !puedeVerGrifos && !puedeVerUnidades
    ? null
    : !puedeVerGrifos ? 'unidades' : !puedeVerUnidades ? 'grifo' : visorModulo

  const toggleEstacionFiltro = (estNombre) => {
    setFiltroEstaciones(prev => prev.includes(estNombre) ? prev.filter(e => e !== estNombre) : [...prev, estNombre])
  }

  // Solo los pendientes del módulo que se está viendo ahora mismo — si
  // estás en Soluciones Grifos, no tiene sentido que este aviso mezcle
  // pendientes de Unidades (y viceversa).
  const pendientes = reportes
    .filter(r => (r.estado || 'Pendiente') !== 'Resuelto')
    .filter(r => (r.modulo === 'unidades' ? visorModuloEfectivo === 'unidades' : visorModuloEfectivo === 'grifo'))
    .map(r => ({ ...r, dias: diasTranscurridos(r.creado_en, null) }))
    .sort((a, b) => b.dias - a.dias)

  const activeStationsVisor = filtroEstaciones.length > 0 ? filtroEstaciones : estacionesPermitidas
  const reportesVisorFiltrados = visorModuloEfectivo === null ? [] : reportes.filter(r => {
    if (visorModuloEfectivo === 'unidades') {
      if (r.modulo !== 'unidades') return false
      const q = busquedaPlaca.trim().toUpperCase()
      if (q === '') return true
      return (r.tracto_placa || '').toUpperCase().includes(q) || (r.carreta_placa || '').toUpperCase().includes(q)
    }
    return r.modulo !== 'unidades' && activeStationsVisor.includes(r.estacion_id)
  })

  return (
    <div className="table-container">
      <h3 className="mb-4">Visor de Soluciones y Evidencias</h3>

      {pendientes.length > 0 && (
        <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem'}}>
          <p style={{color: 'var(--danger)', fontWeight: 'bold', marginBottom: '0.75rem'}}>⚠️ {pendientes.length} reporte(s) sin resolver — dale prioridad a los más antiguos:</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: verTodosPendientes ? '320px' : 'none', overflowY: verTodosPendientes ? 'auto' : 'visible'}}>
            {(verTodosPendientes ? pendientes : pendientes.slice(0, 5)).map(r => (
              <div key={r.id} onClick={() => setReporteModal(r)} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '0.5rem', flexWrap: 'wrap'}}>
                <span style={{fontSize: '0.85rem', color: 'var(--text-soft)'}}><strong>{r.motivo}</strong> · {r.tracto_placa || r.carreta_placa ? `${r.tracto_placa || ''} ${r.carreta_placa || ''}`.trim() : r.estacion_id}</span>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(r.estado), background: colorDeEstado(r.estado) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px', whiteSpace: 'nowrap'}}>
                  {r.estado || 'Pendiente'} · {r.dias} día(s)
                </span>
              </div>
            ))}
          </div>
          {pendientes.length > 5 && (
            <button type="button" className="btn-text" style={{marginTop: '0.75rem', padding: 0, fontSize: '0.85rem', color: 'var(--danger)'}} onClick={() => setVerTodosPendientes(v => !v)}>
              {verTodosPendientes ? 'Ver menos ▲' : `Ver los ${pendientes.length - 5} restantes ▼`}
            </button>
          )}
        </div>
      )}

      {puedeVerGrifos && puedeVerUnidades && (
        <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', flexWrap: 'wrap'}}>
          <button className={visorModulo === 'grifo' ? 'btn-primary' : 'btn-toggle'} onClick={() => { setVisorModulo('grifo'); setVerTodosPendientes(false) }} style={{flex: 1, minWidth: '140px'}}>
            Soluciones Grifos
          </button>
          <button className={visorModulo === 'unidades' ? 'btn-primary' : 'btn-toggle'} onClick={() => { setVisorModulo('unidades'); setVerTodosPendientes(false) }} style={{flex: 1, minWidth: '140px'}}>
            Soluciones Unidades
          </button>
        </div>
      )}

      {visorModuloEfectivo === 'grifo' && estacionesPermitidas.length > 1 && (
        <div style={{background: 'var(--card-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
          <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Filtrar por Estación:</p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
            {estacionesPermitidas.map(est => (
              <label key={est} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: filtroEstaciones.includes(est) ? 'var(--primary-hover)' : 'var(--bg-elevated)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-pill)', border: filtroEstaciones.includes(est) ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.2s', fontSize: '0.85rem'}}>
                <input type="checkbox" checked={filtroEstaciones.includes(est)} onChange={() => toggleEstacionFiltro(est)} style={{display: 'none'}} />
                <span style={{color: filtroEstaciones.includes(est) ? 'white' : 'var(--text-soft)'}}>{est}</span>
              </label>
            ))}
          </div>
          {filtroEstaciones.length > 0 && (
            <button className="btn-text" style={{marginTop: '0.5rem', padding: '0', fontSize: '0.8rem'}} onClick={() => setFiltroEstaciones([])}>Desmarcar todas (Mostrar {estacionesPermitidas.length})</button>
          )}
        </div>
      )}

      {visorModuloEfectivo === 'unidades' && (
        <div style={{background: 'var(--card-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
          <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Buscar por placa (Tracto o Carreta):</p>
          <input
            type="text"
            value={busquedaPlaca}
            onChange={e => setBusquedaPlaca(e.target.value)}
            placeholder="Ej: ABC-123"
            style={{width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'white', border: '1px solid var(--border-soft)'}}
          />
        </div>
      )}

      {visorModuloEfectivo === null ? (
        <p className="text-muted">No tienes acceso a ver soluciones de ningún módulo. Pide a Gerencia que habilite "Visor: Ver Soluciones Estaciones" o "Visor: Ver Soluciones Unidades" en tus Accesos.</p>
      ) : reportesVisorFiltrados.length === 0 ? (
        <p className="text-muted">No hay soluciones ni reportes registrados aún en las estaciones seleccionadas.</p>
      ) : (
        <div className="cards-grid">
          {reportesVisorFiltrados.map(r => (
            <div key={r.id} className="solution-card" onClick={() => setReporteModal(r)} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                <span style={{fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem'}}>{r.motivo}</span>
                <span style={{fontSize: '0.7rem', fontWeight: 'bold', color: colorDeEstado(r.estado), background: colorDeEstado(r.estado) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px'}}>{r.estado || 'Pendiente'}</span>
              </div>
              <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>{r.creado_en ? new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</p>
              {r.modulo === 'unidades' || r.estacion_id === 'UNIDADES' ? (
                <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-soft)'}}>
                  {r.tracto_placa && <span style={{marginRight: '0.5rem'}}><strong>Tracto:</strong> {r.tracto_placa}</span>}
                  {r.carreta_placa && <span><strong>Carreta:</strong> {r.carreta_placa}</span>}
                </p>
              ) : (
                <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-soft)'}}><strong>Estación:</strong> {r.estacion_id} <br/><strong>Equipo:</strong> {displayIslaLado(r.isla_lado)} | <strong>Prod:</strong> {r.producto}</p>
              )}
              <p style={{color: 'var(--text-soft)', marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.descripcion ? r.descripcion.replace(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/, '').trim() : ''}</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0}}>📸 {r.fotos && r.fotos !== 'Sin foto' ? r.fotos.split(',').length : 0} foto(s)</p>
                <p style={{fontSize: '0.85rem', color: 'var(--accent)', margin: 0}}>Audit: <strong>{r.creado_por}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
