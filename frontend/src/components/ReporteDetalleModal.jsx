import React from 'react'
import { supabase } from '../supabaseClient'
import { colorDeEstado } from '../utils/estado'
import ReporteSeguimiento from './ReporteSeguimiento'

// Modal de detalle de un reporte: mismo componente para el modo Operario y
// para el Panel Administrativo. La única diferencia entre lo que ve un
// usuario u otro es si tiene permiso_editar_reportes — solo ahí aparecen los
// botones de Editar/Eliminar; para todos los demás es de solo lectura.
export default function ReporteDetalleModal({ reporteModal, setReporteModal, user, setReportes, showAlert, openPreview, displayIslaLado, onEditReport }) {
  if (!reporteModal) return null

  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar este reporte permanentemente?')) return
    const { error } = await supabase.from('reportes').delete().eq('id', reporteModal.id)
    if (error) {
      showAlert('Error', error.message)
      return
    }
    setReportes(prev => prev.filter(r => r.id !== reporteModal.id))
    setReporteModal(null)
    showAlert('Éxito', 'Reporte eliminado.')
  }

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem'}}>
      <div style={{background: 'var(--card-bg)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-float)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'}}>
            <h3 style={{color: 'var(--primary)', margin: 0}}>{reporteModal.motivo}</h3>
            <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(reporteModal.estado), background: colorDeEstado(reporteModal.estado) + '22', padding: '0.2rem 0.7rem', borderRadius: '999px'}}>{reporteModal.estado || 'Pendiente'}</span>
          </div>
          <button onClick={() => setReporteModal(null)} style={{background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1}}>×</button>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem'}}>
          <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Fecha y Hora</small><strong>{reporteModal.creado_en ? new Date(reporteModal.creado_en + (reporteModal.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</strong></div>
          <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Autor (Auditoría)</small><strong style={{color: 'var(--accent)'}}>{reporteModal.creado_por}</strong></div>
          {reporteModal.modulo === 'unidades' || reporteModal.estacion_id === 'UNIDADES' ? (
            <>
              {reporteModal.tracto_placa && <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Tracto</small><strong>{reporteModal.tracto_placa}</strong></div>}
              {reporteModal.carreta_placa && <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Carreta</small><strong>{reporteModal.carreta_placa}</strong></div>}
            </>
          ) : (
            <>
              <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Estación</small><strong>{reporteModal.estacion_id}</strong></div>
              <div><small style={{color: 'var(--text-muted)', display: 'block'}}>Equipo / Producto</small><strong>{displayIslaLado(reporteModal.isla_lado)} | {reporteModal.producto}</strong></div>
            </>
          )}
        </div>

        <small style={{color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem'}}>Descripción</small>
        {(() => {
          const desc = reporteModal.descripcion || '';
          const match = desc.match(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/);

          if (match) {
            const cleanDesc = desc.replace(match[0], '').trim();
            return (
              <>
                <div style={{background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', color: 'var(--text-soft)', marginBottom: '1.5rem'}}>
                  {cleanDesc}
                </div>
                <small style={{color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem'}}>Repuesto Utilizado (Del Inventario)</small>
                <div style={{display: 'inline-block', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.4)'}}>
                  📦 <strong>{match[1]}</strong> <span style={{background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-lg)', fontSize: '0.9rem', marginLeft: '0.5rem'}}>Cantidad: {match[2]}</span>
                </div>
              </>
            );
          }

          return (
            <div style={{background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', color: 'var(--text-soft)'}}>
              {desc}
            </div>
          );
        })()}

        <div>
          <small style={{color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem'}}>Evidencias Fotográficas</small>
          <div style={{background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-soft)', display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
            {reporteModal.fotos && reporteModal.fotos !== 'Sin foto' ? (() => {
              const lista = reporteModal.fotos.split(',')
              const galeria = lista.filter(f => f.startsWith('http'))
              return lista.map((f, i) => (
                f.startsWith('http') ?
                  <div key={i} onClick={() => openPreview(galeria, f)} onContextMenu={(e) => e.preventDefault()} style={{cursor: 'pointer'}}>
                    <img src={f} alt="Evidencia" loading="lazy" draggable={false} style={{height: '100px', borderRadius: 'var(--radius-md)', border: '1px solid var(--text-muted)', objectFit: 'cover', pointerEvents: 'none'}} />
                  </div>
                : <span key={i} style={{color: 'var(--text-soft)'}}>{f}</span>
              ))
            })() : <span className="text-muted">No hay evidencias</span>}
          </div>
        </div>

        <ReporteSeguimiento
          reporte={reporteModal}
          user={user}
          showAlert={showAlert}
          openPreview={openPreview}
          onEstadoActualizado={(estado, resuelto_en) => {
            setReporteModal(prev => prev ? { ...prev, estado, resuelto_en } : prev)
            setReportes(prev => prev.map(r => r.id === reporteModal.id ? { ...r, estado, resuelto_en } : r))
          }}
        />

        {user.permiso_editar_reportes && (
          <div style={{marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem'}}>
            <button className="btn-toggle" style={{borderColor: 'var(--danger)', color: 'var(--danger)'}} onClick={handleDelete}>🗑️ Eliminar</button>
            <button className="btn-primary" onClick={() => onEditReport && onEditReport(reporteModal)}>✏️ Editar</button>
          </div>
        )}
      </div>
    </div>
  )
}
