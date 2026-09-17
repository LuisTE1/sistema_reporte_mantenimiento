const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// 1. Add imports
const importTarget = `import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'`;
const importReplacement = `import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports, initNetworkListener } from '../utils/offlineQueue'`;
content = content.replace(importTarget, importReplacement);

// 2. Add useEffect for network
const useEffectTarget = `useEffect(() => {
      // Cargar estaciones cuando se abre el módulo
      const fetchIniciales = async () => {`;
const useEffectReplacement = `useEffect(() => {
      // Setup offline sync listener
      initNetworkListener();
      syncOfflineReports();

      // Cargar estaciones cuando se abre el módulo
      const fetchIniciales = async () => {`;
content = content.replace(useEffectTarget, useEffectReplacement);

// 3. Update handleSubmit
const submitTarget = `    try {
      let fotosStr = 'Sin foto'
      const uploadedFotos = [...existingFotos]
      for (const fotoObj of fotos) {
        const fileExt = fotoObj.file.name.split('.').pop()`;

const submitReplacement = `    try {
      const dbPayload = {
        estacion_id: estacionSeleccionada,
        isla_lado: islasLados.find(il => il.id === ladoSeleccionado)?.isla_lado_str || 'ID: ' + ladoSeleccionado,
        motivo,
        descripcion: descripcion + (repuestoUsado !== 'Ninguno' ? \`\\n[🔧 Repuesto utilizado: \${repuestoUsado === 'Varios / Todos' ? 'Varios' : inventario.find(i => i.id.toString() === repuestoUsado)?.nombre} x\${cantidadUsada}]\` : ''),
        creado_por: user.nombre,
        modulo: modulo || 'grifo',
        tracto_placa: modulo === 'unidades' ? tractoSeleccionado : null,
        carreta_placa: modulo === 'unidades' ? carretaSeleccionada : null,
        producto: productoAfectado
      }
      
      if (!navigator.onLine) {
        const fotosObj = fotos.map(f => f.file);
        const success = await addToOfflineQueue({ dbPayload, fotosObj });
        if (success) {
          showAlert('⚠️ Modo Offline', 'Sin conexión a Internet. El reporte se guardó localmente y se enviará automáticamente al recuperar la señal.');
          setFotos([])
          setDescripcion('')
          setRepuestoUsado('Ninguno')
          setCantidadUsada(1)
          setLadoSeleccionado('')
          setTractoSeleccionado('')
          setCarretaSeleccionada('')
          if (document.querySelector('input[type="file"]')) document.querySelector('input[type="file"]').value = ''
          setIsSubmitting(false)
          return;
        }
      }

      let fotosStr = 'Sin foto'
      const uploadedFotos = [...existingFotos]
      for (const fotoObj of fotos) {
        const fileExt = fotoObj.file.name.split('.').pop()`;

content = content.replace(submitTarget, submitReplacement);

// Remove the payload building further down because we already built it above for offline fallback
const insertTarget = `      const payload = {
        estacion_id: estacionSeleccionada,
        isla_lado: islasLados.find(il => il.id === ladoSeleccionado)?.isla_lado_str || 'ID: ' + ladoSeleccionado,
        fotos: fotosStr,
        motivo,
        descripcion: descripcion + (repuestoUsado !== 'Ninguno' ? \`\\n[🔧 Repuesto utilizado: \${repuestoUsado === 'Varios / Todos' ? 'Varios' : inventario.find(i => i.id.toString() === repuestoUsado)?.nombre} x\${cantidadUsada}]\` : ''),
        creado_por: user.nombre,
        modulo: modulo || 'grifo',
        tracto_placa: modulo === 'unidades' ? tractoSeleccionado : null,
        carreta_placa: modulo === 'unidades' ? carretaSeleccionada : null,
        producto: productoAfectado
      }
  
      if (editingReportId) {
        const { error } = await supabase.from('reportes').update(payload).eq('id', editingReportId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reportes').insert([payload])
        if (error) throw error
      }`;

const insertReplacement = `      
      dbPayload.fotos = fotosStr;
      
      if (editingReportId) {
        const { error } = await supabase.from('reportes').update(dbPayload).eq('id', editingReportId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reportes').insert([dbPayload])
        if (error) throw error
      }`;

content = content.replace(insertTarget, insertReplacement);

fs.writeFileSync('src/components/Operario.jsx', content);
