const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Fix encoding for "Seleccione una opción..."
content = content.replace(/Seleccione una opci\ufffdn\.\.\./g, 'Seleccione una opcion...');
content = content.replace(/Seleccione una opcin\.\.\./g, 'Seleccione una opcion...');
content = content.replace(/Seleccione una opci\?n\.\.\./g, 'Seleccione una opcion...');

// Fix Motivo select auto-set
const targetMotivoAuto = `        if (mtData.length > 0 && !reportToEdit) {
          setMotivo(mtData[0].nombre)
        }`;
content = content.replace(targetMotivoAuto, `        // No auto-set motivo`);

// Fix Motivo select placeholder
const targetMotivoSelect = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                  {mantenimientoTipos`;
const replacementMotivoSelect = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                  <option value="" disabled>Seleccione un motivo...</option>
                  {mantenimientoTipos`;
content = content.replace(targetMotivoSelect, replacementMotivoSelect);

// Fix button gap
const targetButtons = `<div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <button type="submit" className="btn-primary full-width" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando en Base de Datos...' : (editingReportId ? 'Actualizar Reporte' : 'Confirmar y Guardar')}
              </button>
              <button type="button" className="btn-secondary mt-2" style={{width: '100%'}} onClick={() => { setModulo(null); setEditingReportId(null); }}>Cancelar</button>
            </div>`;
const replacementButtons = `<div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
              <button type="submit" className="btn-primary full-width" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando en Base de Datos...' : (editingReportId ? 'Actualizar Reporte' : 'Confirmar y Guardar')}
              </button>
              <button type="button" className="btn-secondary" style={{width: '100%'}} onClick={() => { setModulo(null); setEditingReportId(null); }}>Cancelar</button>
            </div>`;
content = content.replace(targetButtons, replacementButtons);

fs.writeFileSync('src/components/Operario.jsx', content);
