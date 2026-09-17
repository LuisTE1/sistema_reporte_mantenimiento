const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// 1. Remove auto-select for Lado
content = content.replace(/setLadoSeleccionado\(data\[0\]\.id\)/g, "setLadoSeleccionado('')");

// 2. Remove auto-select for Producto
content = content.replace(/setProductoAfectado\(prods\[0\] \|\| ''\)/g, "setProductoAfectado('')");

// 3. Fix Motivo select
const motivoTarget = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                {mantenimientoTipos`;
const motivoReplacement = `<select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                <option value="" disabled>Seleccione un motivo...</option>
                {mantenimientoTipos`;
content = content.replace(motivoTarget, motivoReplacement);

// 4. Fix Producto select UI
const prodTarget = `<select value={productoAfectado} onChange={e => setProductoAfectado(e.target.value)}>
                {productosDisponibles.length === 0 && <option value="" disabled>Seleccione un producto...</option>}
                {productosDisponibles.map(prod => (`;
const prodReplacement = `<select value={productoAfectado} onChange={e => setProductoAfectado(e.target.value)} required>
                <option value="" disabled>Seleccione un producto...</option>
                {productosDisponibles.map(prod => (`;
content = content.replace(prodTarget, prodReplacement);

fs.writeFileSync('src/components/Operario.jsx', content);
