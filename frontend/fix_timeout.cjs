const fs = require('fs');

let operario = fs.readFileSync('src/components/Operario.jsx', 'utf8');

const targetFunction = `    const uploadedFotos = [...existingFotos]
    for (const fotoObj of fotos) {
      const fileExt = fotoObj.file.name.split('.').pop()
      const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`
      const filePath = \`reportes/\${fileName}\`
      
      const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, fotoObj.file)
      if (uploadError) {
        setIsSubmitting(false)
        showAlert('Error de Subida', 'No se pudo subir la foto ' + fotoObj.file.name + ': ' + uploadError.message)
        return
      }
      
      const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(filePath)
      uploadedFotos.push(publicUrlData.publicUrl)
    }
    const fotosNombres = uploadedFotos.join(',') || 'Sin foto'

    estName = modulo === 'unidades' ? 'UNIDADES' : (estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada)

    let descFinal = descripcion
    invItemNew = null
    if (repuestoUsado !== 'Ninguno') {
      invItemNew = inventario.find(i => i.id === parseInt(repuestoUsado))
      if (invItemNew) {
        // En edición, si es el mismo repuesto, el stock disponible es stock actual + qty vieja
        const stockDisponible = editingReportId && oldRepuestoText && oldRepuestoText.nombre === invItemNew.nombre 
          ? invItemNew.stock + oldRepuestoText.qty 
          : invItemNew.stock
          
        if (cantidadUsada > stockDisponible) {
          setIsSubmitting(false)
          showAlert('Stock Insuficiente', \`No hay stock suficiente de \${invItemNew.nombre}. Disponible: \${stockDisponible}\`)
          return
        }
        descFinal += \`\\n[📦 Repuesto utilizado: \${invItemNew.nombre} x\${cantidadUsada}]\`
      }
    }

    let finalError = null
    
    ladoText = 'General'
    if (modulo === 'grifo' && ladoSeleccionado) {
      const il = islasLados.find(i => i.id === parseInt(ladoSeleccionado))
      if (il) ladoText = \`Isla \${il.isla} - Lado \${il.lado}\`
    } else if (modulo === 'unidades') {
      ladoText = 'Unidades'
    }
    
    if (editingReportId) {
      // 1. Devolver el stock del repuesto antiguo si existía
      if (oldRepuestoText) {
        const { data: oldItem } = await supabase.from('inventario').select('*').eq('estacion', estName.toUpperCase()).eq('nombre', oldRepuestoText.nombre).single()
        if (oldItem) {
          await supabase.from('inventario').update({ stock: oldItem.stock + oldRepuestoText.qty }).eq('id', oldItem.id)
        }
      }
      
      // 2. Descontar el stock del repuesto nuevo (obtenemos stock fresco)
      if (invItemNew) {
        const { data: newItem } = await supabase.from('inventario').select('*').eq('id', invItemNew.id).single()
        if (newItem) {
          await supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id)
        }
      }

      const { error } = await supabase.from('reportes').update({
        modulo: modulo,
        estacion_id: estName,
        isla_lado: ladoText,
        tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
        carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
        producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
        motivo: motivo,
        descripcion: descFinal,
        fotos: fotosNombres,
        creado_por: user.nombre,
        creado_en: new Date(fechaSuceso).toISOString()
      }).eq('id', editingReportId)
      finalError = error
    } else {
      const { error } = await supabase.from('reportes').insert([{
        modulo: modulo,
        estacion_id: estName,
        isla_lado: ladoText,
        tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
        carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
        producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
        motivo: motivo,
        descripcion: descFinal,
        fotos: fotosNombres,
        creado_por: user.nombre,
        creado_en: new Date(fechaSuceso).toISOString()
      }])
      finalError = error
      
      if (!error && invItemNew) {
        // Descontar inventario en registro nuevo
        const { data: newItem } = await supabase.from('inventario').select('*').eq('id', invItemNew.id).single()
        if (newItem) {
          await supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id)
        }
      }
    }

    if (finalError) {
      showAlert('Error', 'Error guardando reporte: ' + finalError.message)
    } else {
      const isEdit = !!editingReportId
      showAlert('Éxito', isEdit ? '¡Reporte actualizado exitosamente!' : '¡Reporte guardado exitosamente!', isEdit)
      setFotos([])
      setDescripcion('')
      setMotivo('')
      setRepuestoUsado('Ninguno')
      setCantidadUsada(1)
      setLadoSeleccionado('')
      setProductoAfectado('')
      setOldRepuestoText(null)
      setEditingReportId(null)
      setExistingFotos([])
      setFechaSuceso(formatDateTimeLocal(new Date()))
    }
    
    setIsSubmitting(false)`;


const replacement = `
    const tryOnlineSave = async () => {
      const uploadedFotos = [...existingFotos]
      for (const fotoObj of fotos) {
        const fileExt = fotoObj.file.name.split('.').pop()
        const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`
        const filePath = \`reportes/\${fileName}\`
        
        const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, fotoObj.file)
        if (uploadError) {
          throw new Error('Error subiendo foto: ' + uploadError.message);
        }
        
        const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(filePath)
        uploadedFotos.push(publicUrlData.publicUrl)
      }
      const fotosNombres = uploadedFotos.join(',') || 'Sin foto'

      estName = modulo === 'unidades' ? 'UNIDADES' : (estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada)

      let descFinal = descripcion
      invItemNew = null
      if (repuestoUsado !== 'Ninguno') {
        invItemNew = inventario.find(i => i.id === parseInt(repuestoUsado))
        if (invItemNew) {
          const stockDisponible = editingReportId && oldRepuestoText && oldRepuestoText.nombre === invItemNew.nombre 
            ? invItemNew.stock + oldRepuestoText.qty 
            : invItemNew.stock
            
          if (cantidadUsada > stockDisponible) {
            throw new Error(\`No hay stock suficiente de \${invItemNew.nombre}. Disponible: \${stockDisponible}\`);
          }
          descFinal += \`\\n[📦 Repuesto utilizado: \${invItemNew.nombre} x\${cantidadUsada}]\`
        }
      }

      let finalError = null
      ladoText = 'General'
      if (modulo === 'grifo' && ladoSeleccionado) {
        const il = islasLados.find(i => i.id === parseInt(ladoSeleccionado))
        if (il) ladoText = \`Isla \${il.isla} - Lado \${il.lado}\`
      } else if (modulo === 'unidades') {
        ladoText = 'Unidades'
      }
      
      if (editingReportId) {
        if (oldRepuestoText) {
          const { data: oldItem } = await supabase.from('inventario').select('*').eq('estacion', estName.toUpperCase()).eq('nombre', oldRepuestoText.nombre).single()
          if (oldItem) {
            await supabase.from('inventario').update({ stock: oldItem.stock + oldRepuestoText.qty }).eq('id', oldItem.id)
          }
        }
        if (invItemNew) {
          const { data: newItem } = await supabase.from('inventario').select('*').eq('id', invItemNew.id).single()
          if (newItem) {
            await supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id)
          }
        }
        const { error } = await supabase.from('reportes').update({
          modulo: modulo,
          estacion_id: estName,
          isla_lado: ladoText,
          tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
          carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
          producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
          motivo: motivo,
          descripcion: descFinal,
          fotos: fotosNombres,
          creado_por: user.nombre,
          creado_en: new Date(fechaSuceso).toISOString()
        }).eq('id', editingReportId)
        finalError = error
      } else {
        const { error } = await supabase.from('reportes').insert([{
          modulo: modulo,
          estacion_id: estName,
          isla_lado: ladoText,
          tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
          carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
          producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
          motivo: motivo,
          descripcion: descFinal,
          fotos: fotosNombres,
          creado_por: user.nombre,
          creado_en: new Date(fechaSuceso).toISOString()
        }])
        finalError = error
        
        if (!error && invItemNew) {
          const { data: newItem } = await supabase.from('inventario').select('*').eq('id', invItemNew.id).single()
          if (newItem) {
            await supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id)
          }
        }
      }

      if (finalError) throw new Error(finalError.message);
      return true;
    };

    try {
      const isEdit = !!editingReportId;
      // Timeout de 15 segundos para la conexion a supabase
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_INTERNET')), 15000));
      await Promise.race([tryOnlineSave(), timeoutPromise]);
      
      showAlert('Éxito', isEdit ? '¡Reporte actualizado exitosamente!' : '¡Reporte guardado exitosamente!', isEdit)
      setFotos([])
      setDescripcion('')
      setMotivo('')
      setRepuestoUsado('Ninguno')
      setCantidadUsada(1)
      setLadoSeleccionado('')
      setProductoAfectado('')
      setOldRepuestoText(null)
      setEditingReportId(null)
      setExistingFotos([])
      setFechaSuceso(formatDateTimeLocal(new Date()))
    } catch (err) {
      if (err.message === 'TIMEOUT_INTERNET' || err.message.includes('Failed to fetch') || err.message.includes('Network Error')) {
        // Forzar guardado offline si hubo un timeout o caída de red disfrazada
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
        
        showAlert('⚠️ Modo Offline de Respaldo', 'Tu red era muy débil o inestable. El reporte se guardó localmente y se enviará automáticamente luego.');
        setFotos([])
        setDescripcion('')
        setMotivo('')
        setRepuestoUsado('Ninguno')
        setCantidadUsada(1)
        setLadoSeleccionado('')
        setTractoSeleccionado('')
        setCarretaSeleccionada('')
        if (document.querySelector('input[type="file"]')) document.querySelector('input[type="file"]').value = ''
      } else {
        showAlert('Error', err.message);
      }
    }
    setIsSubmitting(false)
`;

operario = operario.replace(targetFunction, replacement);
fs.writeFileSync('src/components/Operario.jsx', operario);
