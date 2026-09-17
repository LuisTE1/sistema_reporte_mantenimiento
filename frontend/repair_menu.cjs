const fs = require('fs');

let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// The broken area is lines 547-551 (0-indexed: 546-550).
// Currently it's:
//   {user.permisos.unidades && (
//     <button ...>Sistema Unidades</button>
//   </button>      <- broken, missing the )
// }                <- this closes the if(!modulo) function but is misplaced
// if (modulo === 'visor') {

// Replace the broken ending with the full correct menu ending
const broken = `            {user.permisos.unidades && (\r\n              <button className="btn-module" onClick={() => handleNewReport('unidades')}>\r\n                <span className="emoji">\uD83D\uDE9B</span><span>Sistema Unidades</span>\r\n              </button>\r\n  }\r\n\r\n  if (modulo === 'visor') {`;

const fixed = `            {user.permisos.unidades && (
              <button className="btn-module" onClick={() => handleNewReport('unidades')}>
                <span className="emoji">🚛</span><span>Sistema Unidades</span>
              </button>
            )}
            <button className="btn-module" onClick={() => setModulo('visor')}>
              <span className="emoji">📚</span><span>Visor de Soluciones</span>
            </button>

            {(user.permisos.dashboard || user.permisos.inventario || user.permisos.config) && (
              <button className="btn-module" style={{background: '#1e3a8a'}} onClick={onSwitchView}>
                <span className="emoji">💻</span><span>Panel Administrativo</span>
              </button>
            )}

            <button className="btn-module" style={{background: '#065f46', fontSize: '0.85rem'}} onClick={async () => {
              const result = await syncOfflineReports()
              if (result.synced > 0) {
                showAlert('✅ Sincronizado', \`\${result.synced} reporte(s) pendientes fueron enviados exitosamente.\`)
              } else if (result.total === 0) {
                showAlert('✅ Al día', 'No hay reportes pendientes de enviar.')
              } else {
                showAlert('⚠️ Sin conexión', 'Aún no hay internet. Los reportes se enviarán automáticamente cuando recuperes señal.')
              }
            }}>
              <span className="emoji">🔄</span><span>Subir Pendientes</span>
            </button>

          </div>
          <button className="btn-text full-width mt-4" onClick={() => window.confirm('¿Desea cerrar sesión?') && onLogout()}>Cerrar Sesión</button>
        </div>
      </div>
    )
  }

  if (modulo === 'visor') {`;

if (content.includes(broken)) {
  content = content.replace(broken, fixed);
  fs.writeFileSync('src/components/Operario.jsx', content);
  console.log('SUCCESS');
} else {
  // Try with \n instead of \r\n
  const brokenAlt = content.substring(content.indexOf('{user.permisos.unidades && ('), content.indexOf('if (modulo === \'visor\') {'));
  console.log('Could not find exact match. Nearby content:');
  console.log(JSON.stringify(brokenAlt.substring(0, 300)));
}
