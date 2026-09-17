const fs = require('fs');
let content = fs.readFileSync('src/components/Gerencia.jsx', 'utf8');

// Remove substring truncation from Chart labels
content = content.replace(/p\.motivo\.length > 15 \? p\.motivo\.substring\(0,15\)\+'\.\.\.' : p\.motivo/g, 'p.motivo');
content = content.replace(/r\.length > 15 \? r\.substring\(0,15\)\+'\.\.\.' : r/g, 'r');

fs.writeFileSync('src/components/Gerencia.jsx', content);
