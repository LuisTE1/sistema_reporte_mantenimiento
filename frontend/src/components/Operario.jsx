import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports } from '../utils/offlineQueue'
import { Network } from '@capacitor/network'
import { useBackHandler } from '../utils/backButton'
import { getCached, setCached, invalidateCache } from '../utils/cache'
import { compressImage } from '../utils/image'
import { colorDeEstado } from '../utils/estado'
import ReporteSeguimiento from './ReporteSeguimiento'


export default function Operario({ onLogout, user, onSwitchView, reportToEdit, setReportToEdit }) {
  const [modulo, setModulo] = useState(null)
  const [isSyncingBtn, setIsSyncingBtn] = useState(false)
  
  // Datos Reales de Supabase
  const [estaciones, setEstaciones] = useState([])
  const [islasLados, setIslasLados] = useState([])
  const [unidadesTractos, setUnidadesTractos] = useState([])
  const [unidadesCarretas, setUnidadesCarretas] = useState([])
  
  // Selecciones del Formulario
  const [estacionSeleccionada, setEstacionSeleccionada] = useState('')
  const [ladoSeleccionado, setLadoSeleccionado] = useState('')
  const [tieneTracto, setTieneTracto] = useState(true)
  const [tieneCarreta, setTieneCarreta] = useState(false)
  const [tractoSeleccionado, setTractoSeleccionado] = useState('')
  const [carretaSeleccionada, setCarretaSeleccionada] = useState('')
  const [productosDisponibles, setProductosDisponibles] = useState([])
  const [productoAfectado, setProductoAfectado] = useState('')
  const [oldRepuestoText, setOldRepuestoText] = useState(null)
  
  const formatDateTimeLocal = (date) => {
    try {
      const d = new Date(date)
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0,16)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      return d.toISOString().slice(0,16)
    } catch(e) {
      return new Date().toISOString().slice(0,16)
    }
  }
  const [fechaSuceso, setFechaSuceso] = useState(formatDateTimeLocal(new Date()))
  
  const [motivo, setMotivo] = useState('')
  const [mantenimientoTipos, setMantenimientoTipos] = useState([])
  
  const displayIslaLado = (val) => {
    if (val && val.startsWith('ID: ')) {
      const id = parseInt(val.replace('ID: ', ''))
      const match = islasLados.find(il => il.id === id)
      return match ? `Isla ${match.isla} - Lado ${match.lado}` : val
    }
    return val || 'General'
  }
  const [descripcion, setDescripcion] = useState('')
  const [fotos, setFotos] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [previewGallery, setPreviewGallery] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Abre el visor de fotos a pantalla completa. Si el reporte tiene varias
  // evidencias, permite pasar de una a otra sin cerrar y volver a abrir
  // (como en WhatsApp) en vez de solo mostrar la que se tocó.
  const openPreview = (gallery, url) => {
    const idx = Math.max(0, gallery.indexOf(url))
    setPreviewGallery(gallery)
    setPreviewIndex(idx)
    setPreviewLoading(true)
    setPreviewImage(url)
  }
  const showPrevPreview = (e) => {
    e.stopPropagation()
    if (previewGallery.length < 2) return
    const idx = (previewIndex - 1 + previewGallery.length) % previewGallery.length
    setPreviewIndex(idx)
    setPreviewLoading(true)
    setPreviewImage(previewGallery[idx])
  }
  const showNextPreview = (e) => {
    e.stopPropagation()
    if (previewGallery.length < 2) return
    const idx = (previewIndex + 1) % previewGallery.length
    setPreviewIndex(idx)
    setPreviewLoading(true)
    setPreviewImage(previewGallery[idx])
  }
  const [reportes, setReportes] = useState([])
  
  const [editingReportId, setEditingReportId] = useState(null)

  // Estado Modal Universal para evitar alertas nativas
  const [appModal, setAppModal] = useState({ isOpen: false, title: '', message: '', isEditSuccess: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)

  useEffect(() => {
    if (reportToEdit && estaciones.length > 0) {
      setModulo(reportToEdit.modulo || (reportToEdit.estacion_id === 'UNIDADES' ? 'unidades' : 'grifo'))
      setEditingReportId(reportToEdit.id)
      
      if (reportToEdit.tracto_placa) setTractoSeleccionado(reportToEdit.tracto_placa)
      if (reportToEdit.carreta_placa) setCarretaSeleccionada(reportToEdit.carreta_placa)
      
      const normalize = (s) => (s || '').replace(/\s+/g, '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      
      const targetEstId = estaciones.find(e => normalize(e.nombre) === normalize(reportToEdit.estacion_id))?.id || ''
      setEstacionSeleccionada(targetEstId)
      
      if (reportToEdit.isla_lado !== 'General') {
        setPendingLadoText(normalize(reportToEdit.isla_lado))
      } else {
        setLadoSeleccionado('')
      }
      
      setPendingProductoText(normalize(reportToEdit.producto))
      setMotivo(reportToEdit.motivo)
      
      let cleanDesc = reportToEdit.descripcion || ''
      const repuestoMatch = cleanDesc.match(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/)
      if (repuestoMatch) {
        setOldRepuestoText({ nombre: repuestoMatch[1], qty: parseInt(repuestoMatch[2]) })
        cleanDesc = cleanDesc.replace(repuestoMatch[0], '').trim()
      } else {
        setOldRepuestoText(null)
      }
      setDescripcion(cleanDesc)
      setFechaSuceso(reportToEdit.creado_en ? formatDateTimeLocal(new Date(reportToEdit.creado_en + (reportToEdit.creado_en.endsWith('Z') ? '' : 'Z'))) : formatDateTimeLocal(new Date()))
      
      if (reportToEdit.fotos && reportToEdit.fotos !== 'Sin foto') {
        setExistingFotos(reportToEdit.fotos.split(','))
      } else {
        setExistingFotos([])
      }
      
      setReportToEdit(null)
    }
  }, [reportToEdit, estaciones, islasLados, setReportToEdit])
  
  const showAlert = (title, message, isEditSuccess = false) => setAppModal({ isOpen: true, title, message, isEditSuccess })

  // Visor de Soluciones
  const [visorModulo, setVisorModulo] = useState('grifo')
  const [filtroEstacion, setFiltroEstacion] = useState('Todas')
  const [busquedaPlaca, setBusquedaPlaca] = useState('')
  const [reporteModal, setReporteModal] = useState(null)

  // Botón físico "Atrás": cierra primero lo más "encima" (lightbox > modales > vista de detalle),
  // y solo al final retrocede del formulario/visor al menú principal.
  useBackHandler(!!previewImage, () => setPreviewImage(null), 100)
  useBackHandler(!!reporteModal, () => setReporteModal(null), 90)
  useBackHandler(appModal.isOpen, () => setAppModal(prev => ({ ...prev, isOpen: false })), 80)
  useBackHandler(!!modulo, () => { setModulo(null); setEditingReportId(null) }, 10)

  // Inventario
  const [inventario, setInventario] = useState([])
  const [repuestoUsado, setRepuestoUsado] = useState('Ninguno')
  const [cantidadUsada, setCantidadUsada] = useState(1)
  
  // Fotos existentes al editar
  const [existingFotos, setExistingFotos] = useState([])

  // Targets pendientes para la edición (evita condiciones de carrera en useEffects)
  const [pendingLadoText, setPendingLadoText] = useState(null)
  const [pendingProductoText, setPendingProductoText] = useState(null)

  useEffect(() => {
    // Cargar estaciones cuando se abre el módulo (en paralelo para reducir el tiempo de carga inicial).
    // Estos catálogos casi no cambian, así que se cachean unos minutos para
    // no volver a pedirlos cada vez que se entra/sale de un módulo.
    const fetchIniciales = async () => {
      const cacheKey = 'operario_catalogos'
      let catalogos = getCached(cacheKey, 5 * 60 * 1000)
      if (!catalogos) {
        const [estRes, mtRes, trRes, caRes] = await Promise.all([
          supabase.from('estaciones').select('*'),
          supabase.from('mantenimiento_tipos').select('*').order('id'),
          supabase.from('unidades_tractos').select('*').order('placa'),
          supabase.from('unidades_carretas').select('*').order('placa'),
        ])
        catalogos = { estaciones: estRes.data, mantenimiento: mtRes.data, tractos: trRes.data, carretas: caRes.data }
        setCached(cacheKey, catalogos)
      }
      if (catalogos.estaciones) {
        const permitidas = user.estaciones === 'Todas' ? catalogos.estaciones : catalogos.estaciones.filter(e => user.estaciones.includes(e.nombre))
        setEstaciones(permitidas)
      }
      if (catalogos.mantenimiento) setMantenimientoTipos(catalogos.mantenimiento)
      if (catalogos.tractos) setUnidadesTractos(catalogos.tractos)
      if (catalogos.carretas) setUnidadesCarretas(catalogos.carretas)
    }
    fetchIniciales()
  }, [])

  useEffect(() => {
    if (modulo === 'visor') {
      const fetchReportes = async () => {
        const cacheKey = 'operario_reportes'
        let data = getCached(cacheKey, 60 * 1000)
        if (!data) {
          const res = await supabase.from('reportes').select('*').order('creado_en', { ascending: false })
          data = res.data
          if (data) setCached(cacheKey, data)
        }
        if (data) {
          if (user.estaciones !== 'Todas') {
            const permitidas = user.estaciones.split(',').map(s => s.trim())
            setReportes(data.filter(r => permitidas.includes(r.estacion_id) || (user.permisos.unidades && r.modulo === 'unidades')))
          } else {
            setReportes(data)
          }
        }
      }
      fetchReportes()
    }
  }, [modulo])

  useEffect(() => {
    let isMounted = true;
    
    const fetchLados = async () => {
      if (modulo === 'unidades') {
        if (isMounted) setIslasLados([])
        return
      }
      if (!estacionSeleccionada) {
        if (isMounted) setIslasLados([])
        return
      }
      const { data } = await supabase
        .from('islas_lados')
        .select('*')
        .eq('estacion_id', estacionSeleccionada)
      
      if (data && isMounted) {
        setIslasLados(data)
        if (data.length > 0) {
          if (pendingLadoText) {
            let foundLado = null
            if (pendingLadoText.startsWith('ID:')) {
              const parsedId = parseInt(pendingLadoText.replace('ID:', '').trim())
              foundLado = data.find(il => il.id === parsedId)
            } else {
              const normalize = (s) => (s || '').replace(/\s+/g, '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              foundLado = data.find(il => normalize(`Isla ${il.isla} - Lado ${il.lado}`) === pendingLadoText)
            }
            
            if (foundLado) {
              setLadoSeleccionado(foundLado.id.toString())
            } else {
              setLadoSeleccionado(data[0]?.id || '')
            }
          }
        } else {
          if (data.length > 0) {
            if (!ladoSeleccionado || !data.find(d => d.id.toString() === ladoSeleccionado.toString())) {
              setLadoSeleccionado('')
            }
          } else {
            setLadoSeleccionado('')
            setProductosDisponibles([])
          }
        }
      }
    }
    
    const fetchInventario = async () => {
      let query = supabase.from('inventario').select('*').eq('modulo', modulo || 'grifo')
      
      if (modulo !== 'unidades') {
        const estName = estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada
        if (typeof estName === 'string') {
          query = query.eq('estacion', estName.toUpperCase())
        } else {
          return // Necesitamos estación válida para grifo
        }
      }
      
      const { data } = await query
      
      if (data && isMounted) {
        setInventario(data)
        if (oldRepuestoText && editingReportId) {
          const normalize = (s) => (s || '').replace(/\s+/g, '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          const invItem = data.find(i => normalize(i.nombre) === normalize(oldRepuestoText.nombre))
          if (invItem) {
            setRepuestoUsado(invItem.id.toString())
            setCantidadUsada(oldRepuestoText.qty)
          } else {
            setRepuestoUsado('Ninguno')
            setCantidadUsada(1)
          }
        } else {
          setRepuestoUsado('Ninguno')
          setCantidadUsada(1)
        }
      }
    }

    fetchLados()
    fetchInventario()
    
    return () => { isMounted = false; }
  }, [estacionSeleccionada, estaciones, modulo, oldRepuestoText, editingReportId])

  useEffect(() => {
    // Actualizar los productos cuando se elige un lado específico
    if (!ladoSeleccionado || islasLados.length === 0) return
    const ladoInfo = islasLados.find(il => il.id === parseInt(ladoSeleccionado))
    if (ladoInfo && ladoInfo.productos) {
      const normalize = (s) => (s || '').replace(/\s+/g, '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const prods = ladoInfo.productos.split(',').map(p => p.trim())
      setProductosDisponibles(prods)
      
      if (pendingProductoText) {
        const matchingProd = prods.find(p => normalize(p) === pendingProductoText)
        if (matchingProd) {
          setProductoAfectado(matchingProd)
        } else {
          setProductoAfectado('')
        }
        setPendingProductoText(null)
      } else {
        // Solo sobreescribir producto si el actual no es válido
        if (!productoAfectado || !prods.includes(productoAfectado)) {
          setProductoAfectado('')
        }
      }
    }
  }, [ladoSeleccionado, islasLados, pendingProductoText, productoAfectado])

  const removeFoto = (index) => {
    setFotos(prev => {
      const target = prev[index]
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleFileChange = async (e) => {
    const filesArray = Array.from(e.target.files)
    e.target.value = ''
    // Comprimimos cada foto antes de guardarla en memoria: reduce drásticamente
    // el tiempo de subida en datos móviles y el peso al listar evidencias.
    const newFotos = await Promise.all(filesArray.map(async file => {
      let compressed = file
      try {
        compressed = await compressImage(file)
      } catch (err) {
        console.error('No se pudo comprimir la imagen, se usará el original:', err)
      }
      return { file: compressed, preview: URL.createObjectURL(compressed) }
    }))
    setFotos(prev => [...prev, ...newFotos])
  }

  const tomarFotoNativa = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });

      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const rawFile = new File([blob], "foto_" + Date.now() + "." + image.format, { type: "image/" + image.format });

      let compressed = rawFile
      try {
        compressed = await compressImage(rawFile)
      } catch (err) {
        console.error('No se pudo comprimir la foto de cámara, se usará el original:', err)
      }

      const newFoto = {
        file: compressed,
        preview: URL.createObjectURL(compressed)
      };
      setFotos(prev => [...prev, newFoto]);
    } catch (error) {
      console.log('Camera error or user cancelled:', error);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (modulo === 'unidades' && !tractoSeleccionado && !carretaSeleccionada) {
      showAlert('Atención', 'Debes seleccionar un tracto o una carreta como mínimo.')
      return
    }

    if (fotos.length === 0 && existingFotos.length === 0) {
      showAlert('Atención', 'Por favor, adjunta al menos una foto de evidencia.')
      return
    }

    // Guard sincrónico anti-doble-envío: por más rápido que se toque el botón dos veces,
    // esto se evalúa antes de que React re-renderice el disabled del botón.
    if (submitLockRef.current) return
    submitLockRef.current = true
    setIsSubmitting(true)

    // Función auxiliar: wrappea una promesa con timeout
    const withTimeout = (promise, ms) => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), ms))
      return Promise.race([promise, timeout])
    }

    const currentEstName = modulo === 'unidades' ? 'UNIDADES' : (estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada)
    let currentLadoText = 'General'
    if (modulo === 'grifo' && ladoSeleccionado) {
      const il = islasLados.find(i => i.id === parseInt(ladoSeleccionado))
      if (il) currentLadoText = `Isla ${il.isla} - Lado ${il.lado}`
    } else if (modulo === 'unidades') {
      currentLadoText = 'Unidades'
    }

    let finalInvItem = null
    if (repuestoUsado !== 'Ninguno') {
      finalInvItem = inventario.find(i => i.id === parseInt(repuestoUsado))
    }

    // Validar stock ANTES de subir ninguna foto: si esto falla, no queremos
    // fotos huérfanas ocupando espacio en el Storage sin ningún reporte que las use.
    let descFinal = descripcion
    if (finalInvItem) {
      const stockDisponible = editingReportId && oldRepuestoText && oldRepuestoText.nombre === finalInvItem.nombre
        ? finalInvItem.stock + oldRepuestoText.qty
        : finalInvItem.stock

      if (cantidadUsada > stockDisponible) {
        showAlert('Stock Insuficiente', `No hay stock suficiente de ${finalInvItem.nombre}. Disponible: ${stockDisponible}`)
        submitLockRef.current = false
        setIsSubmitting(false)
        return
      }
      descFinal += `\n[📦 Repuesto utilizado: ${finalInvItem.nombre} x${cantidadUsada}]`
    }
    const descOffline = descripcion + (finalInvItem ? `\n[📦 Repuesto utilizado: ${finalInvItem.nombre} x${cantidadUsada}]` : '')

    // Fotos ya subidas con éxito a Storage en este intento (para no volver a
    // subirlas si algo falla más adelante y se cae a modo offline).
    let uploadedFotos = [...existingFotos]
    let fotosPendientes = [...fotos]

    const guardarOffline = async (msg) => {
      const dbPayload = {
        modulo: modulo || 'grifo',
        estacion_id: currentEstName,
        isla_lado: currentLadoText,
        tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
        carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
        producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
        motivo,
        descripcion: descOffline,
        creado_por: user.nombre,
        // Si ya se alcanzaron a subir fotos, se guardan sus URLs reales para
        // no volver a subirlas cuando se sincronice la cola offline.
        fotos: uploadedFotos.length > 0 ? uploadedFotos.join(',') : 'Pendiente offline'
      }
      const fotosObj = fotosPendientes.map(f => f.file)
      await addToOfflineQueue({ dbPayload, fotosObj })
      showAlert('⚠️ Sin Conexión', msg || 'El reporte se guardó localmente y se enviará cuando recuperes señal.')
      setFotos([])
      setDescripcion('')
      setMotivo('')
      setRepuestoUsado('Ninguno')
      setCantidadUsada(1)
      setLadoSeleccionado('')
      setTractoSeleccionado('')
      setCarretaSeleccionada('')
      setProductoAfectado('')
    }

    try {
      // Verificar conexión real con Capacitor Network
      const networkStatus = await withTimeout(Network.getStatus(), 3000)
      if (!networkStatus.connected) {
        await guardarOffline('Sin conexión a internet. El reporte se guardó localmente y se enviará automáticamente cuando recuperes la señal.')
        return
      }

      while (fotosPendientes.length > 0) {
        const fotoObj = fotosPendientes[0]
        const fileExt = fotoObj.file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `reportes/${fileName}`

        const { error: uploadError } = await withTimeout(
          supabase.storage.from('evidencias').upload(filePath, fotoObj.file),
          12000
        )
        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(filePath)
        uploadedFotos.push(publicUrlData.publicUrl)
        // Recién ahora la quitamos de "pendientes": si algo revienta a mitad
        // de la subida siguiente, esta foto ya no se reintentará ni se subirá doble.
        fotosPendientes = fotosPendientes.slice(1)
      }
      const fotosNombres = uploadedFotos.join(',') || 'Sin foto'

      let finalError = null
      
      if (editingReportId) {
        if (oldRepuestoText) {
          const { data: oldItem } = await withTimeout(supabase.from('inventario').select('*').eq('estacion', currentEstName.toUpperCase()).eq('nombre', oldRepuestoText.nombre).single(), 10000)
          if (oldItem) await withTimeout(supabase.from('inventario').update({ stock: oldItem.stock + oldRepuestoText.qty }).eq('id', oldItem.id), 10000)
        }
        if (finalInvItem) {
          const { data: newItem } = await withTimeout(supabase.from('inventario').select('*').eq('id', finalInvItem.id).single(), 10000)
          if (newItem) await withTimeout(supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id), 10000)
        }
        const { error } = await withTimeout(supabase.from('reportes').update({
          modulo, estacion_id: currentEstName, isla_lado: currentLadoText,
          tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
          carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
          producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
          motivo, descripcion: descFinal, fotos: fotosNombres,
          creado_por: user.nombre, creado_en: new Date(fechaSuceso).toISOString()
        }).eq('id', editingReportId), 12000)
        finalError = error
      } else {
        const { error } = await withTimeout(supabase.from('reportes').insert([{
          modulo, estacion_id: currentEstName, isla_lado: currentLadoText,
          tracto_placa: modulo === 'unidades' ? (tractoSeleccionado || null) : null,
          carreta_placa: modulo === 'unidades' ? (carretaSeleccionada || null) : null,
          producto: modulo === 'unidades' ? 'N/A' : (productoAfectado || 'General'),
          motivo, descripcion: descFinal, fotos: fotosNombres,
          creado_por: user.nombre, creado_en: new Date(fechaSuceso).toISOString()
        }]), 12000)
        finalError = error
        
        if (!error && finalInvItem) {
          const { data: newItem } = await withTimeout(supabase.from('inventario').select('*').eq('id', finalInvItem.id).single(), 10000)
          if (newItem) await withTimeout(supabase.from('inventario').update({ stock: newItem.stock - cantidadUsada }).eq('id', newItem.id), 10000)
        }
      }

      if (finalError) {
        showAlert('Error', 'No se pudo guardar. Verifica tu conexión e intenta de nuevo.')
      } else {
        const isEdit = !!editingReportId
        invalidateCache('operario_reportes')
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
    } catch (err) {
      // Timeout o error de red — guardar offline automáticamente
      await guardarOffline('Tu conexión era inestable. El reporte se guardó localmente y se enviará cuando recuperes señal.')
    } finally {
      // SIEMPRE desbloquear el botón — este bloque se ejecuta pase lo que pase
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleNewReport = (type) => {
    setEditingReportId(null)
    setOldRepuestoText(null)
    setDescripcion('')
    setFotos([])
    setExistingFotos([])
    setFechaSuceso(formatDateTimeLocal(new Date()))
    setModulo(type)
  }

  // Este componente renderiza una pantalla distinta según "modulo" con varios
  // "return" separados. Antes, el modal de alertas y el visor de fotos a
  // pantalla completa solo estaban dentro de UNO de esos "return": si se
  // abrían desde otra pantalla (ej: una foto desde el Visor de Soluciones),
  // el estado cambiaba pero no había nada ahí para mostrarlo — recién se
  // veía si luego se entraba a una pantalla que sí los incluía. Por eso se
  // sacan aquí como funciones y se agregan a CADA pantalla.
  const renderAppModal = () => appModal.isOpen && (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem'}}>
      <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', width: '100%', maxWidth: '400px', textAlign: 'center'}}>
        <h3 style={{marginBottom: '1rem', color: appModal.title === 'Error' || appModal.title === 'Atención' || appModal.title === 'Stock Insuficiente' ? '#ef4444' : '#3b82f6'}}>{appModal.title}</h3>
        <p style={{marginBottom: '2rem', color: '#e2e8f0'}}>{appModal.message}</p>
        <div style={{display: 'flex', gap: '1rem'}}>
          {appModal.isEditSuccess ? (
            <button className="btn-primary" style={{flex: 1}} onClick={() => {
              setAppModal({...appModal, isOpen: false})
              if (user.rol !== 'Operario' && onSwitchView) onSwitchView()
              else setModulo(null)
            }}>Volver al Visor de Soluciones</button>
          ) : (
            <>
              <button className="btn-primary" style={{flex: 1}} onClick={() => setAppModal({...appModal, isOpen: false})}>Entendido</button>
              {appModal.title === 'Éxito' && (
                <button className="btn-secondary" style={{flex: 1}} onClick={() => { setAppModal({...appModal, isOpen: false}); setModulo(null); }}>Volver al Menú</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  const renderPreviewLightbox = () => previewImage && (
    <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={() => setPreviewImage(null)}>
      <button style={{position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1}} onClick={() => setPreviewImage(null)}>×</button>
      {previewGallery.length > 1 && (
        <>
          <div style={{position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: '0.9rem', background: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.75rem', borderRadius: '999px'}}>
            {previewIndex + 1} / {previewGallery.length}
          </div>
          <button onClick={showPrevPreview} style={{position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.8rem', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px'}}>‹</button>
          <button onClick={showNextPreview} style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.8rem', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px'}}>›</button>
        </>
      )}
      {previewLoading && (
        <div style={{position: 'absolute', color: 'white', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'}}>
          <div style={{width: '38px', height: '38px', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite'}} />
          Cargando foto...
        </div>
      )}
      <img
        src={previewImage}
        alt="Fullscreen Preview"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoad={() => setPreviewLoading(false)}
        onError={() => setPreviewLoading(false)}
        style={{maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', opacity: previewLoading ? 0 : 1, transition: 'opacity 0.15s'}}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )

  if (!modulo) {
    return (
      <div className="flex-center">
        <div className="login-card" style={{padding: '2rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
            <div>
              <h2 style={{fontSize: '1.25rem'}}>Hola, {user.nombre}</h2>
              <p className="subtitle">¿Qué deseas reportar hoy?</p>
            </div>
            <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{user.nombre.substring(0,2)}</div>
          </div>
          <div className="module-buttons">
            {user.permisos.grifos && (
              <button className="btn-module" onClick={() => handleNewReport('grifo')}>
                <span className="emoji">⛽</span><span>Sistema Grifo</span>
              </button>
            )}
            {user.permisos.unidades && (
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

            <button 
              className="btn-module" 
              style={{background: '#065f46', fontSize: '0.85rem', opacity: isSyncingBtn ? 0.7 : 1}}
              disabled={isSyncingBtn}
              onClick={async () => {
                setIsSyncingBtn(true)
                const result = await syncOfflineReports()
                setIsSyncingBtn(false)
                if (result.alreadyRunning) {
                  showAlert('⏳ Espera', 'Ya se está sincronizando en segundo plano. Espera un momento.')
                } else if (result.offline) {
                  showAlert('⚠️ Sin conexión', 'Aún no hay internet. Los reportes se enviarán automáticamente cuando recuperes señal.')
                } else if (result.synced > 0) {
                  showAlert('✅ Sincronizado', `${result.synced} reporte(s) pendientes fueron enviados exitosamente.`)
                } else if (result.total === 0) {
                  showAlert('✅ Al día', 'No tienes reportes pendientes de enviar.')
                } else {
                  showAlert('⚠️ Error', 'Hubo un problema al sincronizar. Intenta de nuevo.')
                }
              }}
            >
              <span className="emoji">{isSyncingBtn ? '⏳' : '🔄'}</span>
              <span>{isSyncingBtn ? 'Sincronizando...' : 'Subir Pendientes'}</span>
            </button>

          </div>
          <button className="btn-text full-width mt-4" onClick={() => window.confirm('¿Desea cerrar sesión?') && onLogout()}>Cerrar Sesión</button>
        </div>
        {renderAppModal()}
      </div>
    )
  }

  if (modulo === 'visor') {
    const reportesDelModulo = reportes.filter(r => visorModulo === 'unidades' ? r.modulo === 'unidades' : r.modulo !== 'unidades')
    const reportesFiltrados = visorModulo === 'unidades'
      ? (busquedaPlaca.trim() === ''
          ? reportesDelModulo
          : reportesDelModulo.filter(r => {
              const q = busquedaPlaca.trim().toUpperCase()
              return (r.tracto_placa || '').toUpperCase().includes(q) || (r.carreta_placa || '').toUpperCase().includes(q)
            }))
      : (filtroEstacion === 'Todas' ? reportesDelModulo : reportesDelModulo.filter(r => r.estacion_id === filtroEstacion))
    const opcionesEstaciones = ['Todas', ...Array.from(new Set(reportesDelModulo.map(r => r.estacion_id)))]

    return (
      <div className="mobile-view">
        <header>
          <div className="header-content">
            <h1>Base de Conocimiento</h1>
            <p className="subtitle text-accent">Soluciones Previas</p>
          </div>
          <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{user.nombre.substring(0,2)}</div>
        </header>
        <main style={{padding: '1.5rem'}}>
          
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem'}}>
            {user.permisos.grifos && (
              <button className={visorModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVisorModulo('grifo')} style={{flex: 1, padding: '0.5rem', fontSize: '0.9rem'}}>
                Grifos
              </button>
            )}
            {user.permisos.unidades && (
              <button className={visorModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVisorModulo('unidades')} style={{flex: 1, padding: '0.5rem', fontSize: '0.9rem'}}>
                Unidades
              </button>
            )}
          </div>

          {visorModulo === 'grifo' && (
            <div style={{marginBottom: '1.5rem'}}>
              <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem'}}>Filtrar por Estación</label>
              <select value={filtroEstacion} onChange={e => setFiltroEstacion(e.target.value)} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}>
                {opcionesEstaciones.map(est => <option key={est} value={est}>{est}</option>)}
              </select>
            </div>
          )}

          {visorModulo === 'unidades' && (
            <div style={{marginBottom: '1.5rem'}}>
              <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem'}}>Buscar por placa (Tracto o Carreta)</label>
              <input
                type="text"
                value={busquedaPlaca}
                onChange={e => setBusquedaPlaca(e.target.value)}
                placeholder="Ej: ABC-123"
                style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}
              />
            </div>
          )}

          {reportesFiltrados.length === 0 ? (
            <p className="text-muted text-center mt-4">No hay soluciones ni reportes registrados para esta selección.</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {reportesFiltrados.map(r => (
                <div key={r.id} onClick={() => setReporteModal(r)} style={{background: '#1e293b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer', transition: 'transform 0.2s'}} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'}}>
                      <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.1rem'}}>{r.motivo}</span>
                      <span style={{fontSize: '0.7rem', fontWeight: 'bold', color: colorDeEstado(r.estado), background: colorDeEstado(r.estado) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px'}}>{r.estado || 'Pendiente'}</span>
                    </div>
                    <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{r.creado_en ? new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</span>
                  </div>
                  {r.modulo === 'unidades' || r.estacion_id === 'UNIDADES' ? (
                    <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: '#cbd5e1'}}>
                      {r.tracto_placa && <span style={{marginRight: '0.5rem'}}><strong>Tracto:</strong> {r.tracto_placa}</span>}
                      {r.carreta_placa && <span><strong>Carreta:</strong> {r.carreta_placa}</span>}
                    </p>
                  ) : (
                    <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: '#cbd5e1'}}><strong>Estación:</strong> {r.estacion_id} | <strong>Equipo:</strong> {displayIslaLado(r.isla_lado)}</p>
                  )}
                  <p style={{color: '#e2e8f0', marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.descripcion ? r.descripcion.replace(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/, '').trim() : ''}</p>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                    <p style={{fontSize: '0.8rem', color: '#64748b', margin: 0}}>📸 {r.fotos && r.fotos !== 'Sin foto' ? r.fotos.split(',').length : 0} foto(s)</p>
                    <p style={{fontSize: '0.85rem', color: '#10b981', margin: 0}}>Audit: <strong>{r.creado_por}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn-secondary full-width mt-4" onClick={() => setModulo(null)}>Volver al Menú</button>
        </main>

        {/* Modal de Detalle de Reporte */}
        {reporteModal && (
          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem'}}>
            <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'}}>
                  <h3 style={{color: '#3b82f6', margin: 0}}>{reporteModal.motivo}</h3>
                  <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(reporteModal.estado), background: colorDeEstado(reporteModal.estado) + '22', padding: '0.2rem 0.7rem', borderRadius: '999px'}}>{reporteModal.estado || 'Pendiente'}</span>
                </div>
                <button onClick={() => setReporteModal(null)} style={{background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1}}>×</button>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem'}}>
                <div><small style={{color: '#94a3b8', display: 'block'}}>Fecha y Hora</small><strong>{reporteModal.creado_en ? new Date(reporteModal.creado_en + (reporteModal.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</strong></div>
                <div><small style={{color: '#94a3b8', display: 'block'}}>Autor (Auditoría)</small><strong style={{color: '#10b981'}}>{reporteModal.creado_por}</strong></div>
                {reporteModal.modulo === 'unidades' || reporteModal.estacion_id === 'UNIDADES' ? (
                  <>
                    {reporteModal.tracto_placa && <div><small style={{color: '#94a3b8', display: 'block'}}>Tracto</small><strong>{reporteModal.tracto_placa}</strong></div>}
                    {reporteModal.carreta_placa && <div><small style={{color: '#94a3b8', display: 'block'}}>Carreta</small><strong>{reporteModal.carreta_placa}</strong></div>}
                  </>
                ) : (
                  <>
                    <div><small style={{color: '#94a3b8', display: 'block'}}>Estación</small><strong>{reporteModal.estacion_id}</strong></div>
                    <div><small style={{color: '#94a3b8', display: 'block'}}>Equipo / Producto</small><strong>{displayIslaLado(reporteModal.isla_lado)} | {reporteModal.producto}</strong></div>
                  </>
                )}
              </div>

              <div style={{marginBottom: '1.5rem'}}>
                <small style={{color: '#94a3b8', display: 'block', marginBottom: '0.5rem'}}>Descripción</small>
                {(() => {
                  const desc = reporteModal.descripcion || '';
                  const match = desc.match(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/);

                  if (match) {
                    const cleanDesc = desc.replace(match[0], '').trim();
                    return (
                      <>
                        <div style={{background: '#1e293b', padding: '1rem', borderRadius: '8px', whiteSpace: 'pre-wrap', color: '#e2e8f0', marginBottom: '1.5rem'}}>
                          {cleanDesc}
                        </div>
                        <small style={{color: '#94a3b8', display: 'block', marginBottom: '0.5rem'}}>Repuesto Utilizado (Del Inventario)</small>
                        <div style={{display: 'inline-block', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #3b82f6'}}>
                          📦 <strong>{match[1]}</strong> <span style={{background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginLeft: '0.5rem'}}>Cantidad: {match[2]}</span>
                        </div>
                      </>
                    );
                  }

                  return (
                    <div style={{background: '#1e293b', padding: '1rem', borderRadius: '8px', whiteSpace: 'pre-wrap', color: '#e2e8f0'}}>
                      {desc}
                    </div>
                  );
                })()}
              </div>

              <div>
                <small style={{color: '#94a3b8', display: 'block', marginBottom: '0.5rem'}}>Evidencias Fotográficas</small>
                <div style={{background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px dashed #334155', display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                  {reporteModal.fotos && reporteModal.fotos !== 'Sin foto' ? (() => {
                    const lista = reporteModal.fotos.split(',')
                    const galeria = lista.filter(f => f.startsWith('http'))
                    return lista.map((f, i) => (
                      f.startsWith('http') ?
                        <div key={i} onClick={() => openPreview(galeria, f)} onContextMenu={(e) => e.preventDefault()} style={{cursor: 'pointer'}}>
                          <img src={f} alt="Evidencia" loading="lazy" draggable={false} style={{height: '100px', borderRadius: '8px', border: '1px solid #475569', objectFit: 'cover', pointerEvents: 'none'}} />
                        </div>
                      : <span key={i} style={{color: '#cbd5e1'}}>{f}</span>
                    ))
                  })() : <span className="text-muted">No hay evidencias</span>}
                </div>
              </div>

              <ReporteSeguimiento
                reporte={reporteModal}
                user={user}
                showAlert={showAlert}
                openPreview={openPreview}
                onEstadoActualizado={(estado, resuelto_en) => {
                  setReporteModal(prev => prev ? { ...prev, estado, resuelto_en } : prev)
                  setReportes(prev => prev.map(r => r.id === reporteModal.id ? { ...r, estado, resuelto_en } : r))
                  invalidateCache('operario_reportes')
                }}
              />
            </div>
          </div>
        )}
        
        {renderAppModal()}
        {renderPreviewLightbox()}
      </div>
    )
  }

  return (
    <div className="mobile-view">
      <header>
        <div className="header-content">
          <h1>{modulo === 'grifo' ? 'Reporte de Grifo' : 'Reporte de Unidades'}</h1>
          <p className="subtitle">Llenado rápido</p>
        </div>
        <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{user.nombre.substring(0,2)}</div>
      </header>
      <main className="standard-form">
        <form onSubmit={handleSubmit}>
          
          {modulo === 'grifo' ? (
            <div className="grid-2">
              <div className="form-group">
                <label>Estación / Grifo</label>
                <select value={estacionSeleccionada} onChange={e => setEstacionSeleccionada(e.target.value)} required>
                  <option value="" disabled>Seleccione una opcion...</option>{estaciones.length === 0 && <option value="">Sin Estaciones</option>}
                  {estaciones.map(est => (
                    <option key={est.id} value={est.id}>{est.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Surtidor / Lado</label>
                <select value={ladoSeleccionado} onChange={e => setLadoSeleccionado(e.target.value)} required>
                  <option value="" disabled>Seleccione un Surtidor/Lado...</option>{islasLados.length === 0 && <option value="">No hay lados configurados</option>}
                  {islasLados.map(il => (
                    <option key={il.id} value={il.id}>Isla {il.isla} - Lado {il.lado}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="form-group" style={{background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155'}}>
              <label style={{display: 'block', marginBottom: '1rem', color: '#3b82f6'}}>Configuración de la Unidad</label>
              
              <div className="grid-2">
                <div>
                  <label>Placa del Tracto</label>
                  <select value={tractoSeleccionado} onChange={e => setTractoSeleccionado(e.target.value)}>
                    <option value="">(Ningún Tracto)</option>
                    {unidadesTractos.map(t => <option key={t.id} value={t.placa}>{t.placa}</option>)}
                  </select>
                </div>
                
                <div>
                  <label>Placa de la Carreta</label>
                  <select value={carretaSeleccionada} onChange={e => setCarretaSeleccionada(e.target.value)}>
                    <option value="">(Ninguna Carreta)</option>
                    {unidadesCarretas.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                  </select>
                </div>
              </div>
              
              {!tractoSeleccionado && !carretaSeleccionada && (
                <p style={{color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem'}}>⚠️ Debes seleccionar al menos un Tracto o una Carreta para continuar.</p>
              )}
            </div>
          )}
          
          {modulo === 'grifo' && (
            <div className="form-group">
              <label>Producto Afectado (Automático)</label>
              <select value={productoAfectado} onChange={e => setProductoAfectado(e.target.value)}>
                <option value="" disabled>Seleccione un producto...</option>
                {productosDisponibles.map(prod => (
                  <option key={prod} value={prod}>{prod}</option>
                ))}
                {productosDisponibles.length > 1 && <option value="Varios / Todos">Varios / Todos</option>}
              </select>
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label>Motivo de Intervención</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} required>
                <option value="" disabled>Seleccione un motivo...</option>
                {mantenimientoTipos.filter(mt => mt.modulo === (modulo || 'grifo')).length === 0 && <option value="">(Sin catálogo para este módulo)</option>}
                {mantenimientoTipos.filter(mt => mt.modulo === (modulo || 'grifo')).map(mt => (
                  <option key={mt.id} value={mt.nombre}>{mt.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Repuesto Utilizado (Del Inventario)</label>
              <select value={repuestoUsado} onChange={e => setRepuestoUsado(e.target.value)}>
                <option value="Ninguno">Ninguno / No requirió</option>
                {inventario.filter(i => i.stock > 0 || i.id.toString() === repuestoUsado).map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.nombre} (Stock: {inv.stock})</option>
                ))}
              </select>
            </div>
          </div>

          {repuestoUsado !== 'Ninguno' && (
            <div className="form-group">
              <label>Cantidad Utilizada de {inventario.find(i => i.id === parseInt(repuestoUsado))?.nombre}</label>
              <input type="number" min="1" value={cantidadUsada} onChange={e => setCantidadUsada(parseInt(e.target.value))} required style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} />
            </div>
          )}

          <div className="form-group">
            <label>Fecha y Hora del Suceso</label>
            <input type="datetime-local" value={fechaSuceso} onChange={e => setFechaSuceso(e.target.value)} required readOnly={!(user.permiso_config || user.rol === 'Gerencia')} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: (user.permiso_config || user.rol === 'Gerencia') ? '#1e293b' : '#0f172a', color: (user.permiso_config || user.rol === 'Gerencia') ? 'white' : '#94a3b8', border: '1px solid #334155', cursor: (user.permiso_config || user.rol === 'Gerencia') ? 'text' : 'not-allowed'}} />
          </div>

          <div className="form-group">
            <label>Evidencia Fotográfica (Obligatorio)</label>
            <div style={{background: '#1e293b', padding: '1rem', borderRadius: '4px', border: '1px dashed #334155'}}>
              {existingFotos.length > 0 && (
                <div style={{marginBottom: '1rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1'}}>Fotos guardadas anteriormente:</label>
                  <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                    {existingFotos.map((url, i) => (
                      <div key={i} style={{position: 'relative', cursor: 'pointer'}} onClick={() => openPreview(existingFotos, url)} onContextMenu={(e) => e.preventDefault()}>
                        <img src={url} alt="Evidencia previa" draggable={false} style={{height: '80px', borderRadius: '8px', border: '1px solid #475569', objectFit: 'cover', pointerEvents: 'none'}} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setExistingFotos(existingFotos.filter((_, index) => index !== i)); }} style={{position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold'}}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8'}}>{existingFotos.length > 0 ? 'Agregar más fotos:' : 'Subir foto (Obligatorio):'}</label>
              
              <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                <button type="button" onClick={tomarFotoNativa} className="btn-primary" style={{flex: 1, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                  📸 Tomar Foto Nativa
                </button>
              </div>
              
              <div style={{fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem'}}>O subir desde archivos:</div>
              <input type="file" multiple accept="image/*" onChange={handleFileChange} required={existingFotos.length === 0 && fotos.length === 0} style={{color: 'white', width: '100%'}} />
              
              {fotos.length > 0 && (
                <div style={{marginTop: '1rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#10b981'}}>Nuevas fotos seleccionadas ({fotos.length}):</label>
                  <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                    {fotos.map((fotoObj, i) => (
                      <div key={i} style={{position: 'relative', cursor: 'pointer'}} onClick={() => openPreview(fotos.map(fo => fo.preview), fotoObj.preview)} onContextMenu={(e) => e.preventDefault()}>
                        <img src={fotoObj.preview} alt="Preview" draggable={false} style={{height: '80px', borderRadius: '8px', border: '1px solid #10b981', objectFit: 'cover', pointerEvents: 'none'}} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeFoto(i); }} style={{position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold'}}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Descripción / Observaciones</label>
            <textarea placeholder="Detalla qué repuestos usaste o si notaste algo inusual..." value={descripcion} onChange={e => setDescripcion(e.target.value)} required></textarea>
          </div>

          <div className="form-actions" style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem'}}>
            <button type="submit" className="btn-primary full-width" style={{padding: '1rem', fontSize: '1.1rem'}} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando reporte...' : (editingReportId ? 'Actualizar Reporte' : 'Confirmar y Guardar')}
            </button>
            <button type="button" className="btn-secondary" style={{width: '100%', padding: '1rem', fontSize: '1.1rem'}} onClick={() => { setModulo(null); setEditingReportId(null); }}>Cancelar</button>
          </div>
        </form>
      </main>

      {renderAppModal()}
      {renderPreviewLightbox()}
    </div>
  )
}
