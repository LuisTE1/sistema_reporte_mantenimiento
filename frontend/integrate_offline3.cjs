const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// 1. Add imports if they don't exist
if (!content.includes('addToOfflineQueue')) {
  const importTarget = `import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'`;
  const importReplacement = `import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports, initNetworkListener } from '../utils/offlineQueue'`;
  content = content.replace(importTarget, importReplacement);
}

// 2. Add useEffect for network if it doesn't exist
if (!content.includes('initNetworkListener()')) {
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
}

// 3. Inject offline check in handleSubmit
const submitReplacement = `    setIsSubmitting(true)

    const estName = modulo === 'unidades' ? 'UNIDADES' : (estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada)
    let ladoText = 'General'
    if (modulo === 'grifo' && ladoSeleccionado) {
      const il = islasLados.find(i => i.id === parseInt(ladoSeleccionado))
      if (il) ladoText = \`Isla \${il.isla} - Lado \${il.lado}\`
    } else if (modulo === 'unidades') {
      ladoText = 'Unidades'
    }

    let invItemNew = null
    if (repuestoUsado !== 'Ninguno') {
      invItemNew = inventario.find(i => i.id === parseInt(repuestoUsado))
    }
    const descFinalOffline = descripcion + (invItemNew ? \`\\n[📦 Repuesto utilizado: \${invItemNew.nombre} x\${cantidadUsada}]\` : '')

    if (!navigator.onLine) {
      const dbPayload = {
        modulo: modulo || 'grifo',
        estacion_id: estName,
        isla_lado: ladoText,
        tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
        carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
        producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
        motivo: motivo,
        descripcion: descFinalOffline,
        creado_por: user.nombre,
        fotos: 'Pendiente offline'
      }

      const fotosObj = fotos.map(f => f.file);
      await addToOfflineQueue({ dbPayload, fotosObj });
      
      showAlert('⚠️ Modo Offline', 'Sin conexión a Internet. El reporte se guardó localmente y se enviará automáticamente cuando recuperes la señal.');
      setFotos([])
      setDescripcion('')
      setMotivo('')
      setRepuestoUsado('Ninguno')
      setCantidadUsada(1)
      setLadoSeleccionado('')
      setTractoSeleccionado('')
      setCarretaSeleccionada('')
      if (document.querySelector('input[type="file"]')) document.querySelector('input[type="file"]').value = ''
      setIsSubmitting(false)
      return;
    }

    const uploadedFotos = [...existingFotos]`;

if (!content.includes('(!navigator.onLine)')) {
  content = content.replace(/setIsSubmitting\(true\)[\s\S]*?const uploadedFotos = \[\.\.\.existingFotos\]/m, submitReplacement);
}

fs.writeFileSync('src/components/Operario.jsx', content);
