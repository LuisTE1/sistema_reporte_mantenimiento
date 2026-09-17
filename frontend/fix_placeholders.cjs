const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Remove setMotivo auto-select
content = content.replace(/if \(mtData\.length > 0 && !reportToEdit\) \{\s*setMotivo\(mtData\[0\]\.nombre\)\s*\}/g, 'if (mtData.length > 0 && !reportToEdit) { /* No auto set */ }');

// Update placeholders
content = content.replace(/<option value="" disabled>Seleccione un lado\.\.\.<\/option>/g, '<option value="" disabled>Seleccione un Surtidor/Lado...</option>');
content = content.replace(/<option>Seleccione un lado primero<\/option>/g, '<option value="" disabled>Seleccione un producto...</option>');

fs.writeFileSync('src/components/Operario.jsx', content);
