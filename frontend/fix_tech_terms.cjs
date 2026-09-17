const fs = require('fs');

// 1. Fix Operario.jsx
let operario = fs.readFileSync('src/components/Operario.jsx', 'utf8');
operario = operario.replace(/'Guardando en Base de Datos\.\.\.'/g, "'Guardando reporte...'");
operario = operario.replace(/'¡Reporte guardado exitosamente en la Base de Datos con Auditoría!'/g, "'¡Reporte guardado exitosamente!'");
fs.writeFileSync('src/components/Operario.jsx', operario);

// 2. Fix Gerencia.jsx
let gerencia = fs.readFileSync('src/components/Gerencia.jsx', 'utf8');
gerencia = gerencia.replace(/Usuarios en la Base de Datos \(Supabase\)/g, "Registro de Usuarios");
fs.writeFileSync('src/components/Gerencia.jsx', gerencia);

// 3. Fix Login.jsx
let login = fs.readFileSync('src/components/Login.jsx', 'utf8');
login = login.replace(/El usuario no existe en la Base de Datos\./g, "El usuario ingresado no existe o es incorrecto.");
fs.writeFileSync('src/components/Login.jsx', login);

// 4. Fix App.jsx
let app = fs.readFileSync('src/App.jsx', 'utf8');
app = app.replace(/Rol no válido en la Base de Datos/g, "Rol no válido en el sistema");
fs.writeFileSync('src/App.jsx', app);
