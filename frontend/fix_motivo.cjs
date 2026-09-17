const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

const targetMotivoSelect = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                  {mantenimientoTipos`;
const replacementMotivoSelect = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                  <option value="" disabled>Seleccione un motivo...</option>
                  {mantenimientoTipos`;
content = content.replace(targetMotivoSelect, replacementMotivoSelect);

fs.writeFileSync('src/components/Operario.jsx', content);
