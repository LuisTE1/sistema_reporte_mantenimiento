const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Fix estName
content = content.replace(/const estName = modulo === 'unidades'/g, 'estName = modulo === \'unidades\'');
content = content.replace(/let estName = modulo === 'unidades'/g, 'estName = modulo === \'unidades\''); // just in case

// Fix invItemNew
content = content.replace(/let invItemNew = null/g, 'invItemNew = null');

// Fix ladoText
content = content.replace(/let ladoText = 'General'/g, 'ladoText = \'General\'');

fs.writeFileSync('src/components/Operario.jsx', content);
