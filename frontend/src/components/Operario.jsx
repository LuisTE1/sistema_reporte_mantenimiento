import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports } from '../utils/offlineQueue'
import { Network } from '@capacitor/network'
import { useBackHandler } from '../utils/backButton'
import { getCached, setCached, invalidateCache, getCachedStale } from '../utils/cache'
import { compressImage } from '../utils/image'
import { ESTADOS, colorDeEstado } from '../utils/estado'
import ZoomableImage from './ZoomableImage'
import { descargarImagen } from '../utils/download'
import { GasPumpIcon, TruckIcon, BookIcon, ChartIcon, RefreshIcon, ClockIcon } from '../utils/icons'
import { actualizarBadge } from '../utils/push'
import { nombreVisible, iniciales, puedeVerReporte } from '../utils/usuario'
import VisorSoluciones from './VisorSoluciones'
import ReporteDetalleModal from './ReporteDetalleModal'


export default function Operario({ onLogout, user, onSwitchView, reportToEdit, setReportToEdit, pendingReportId, onPendingReportHandled }) {
  const [modulo, setModulo] = useState(null)
  const [isSyncingBtn, setIsSyncingBtn] = useState(false)
  // Se incrementa cada vez que vuelve la conexión (evento 'sm-reconectado'
  // disparado desde offlineQueue.js) para forzar que los efectos de abajo
  // vuelvan a pedir datos frescos, sin que el usuario tenga que salir y
  // volver a entrar a la pantalla.
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    const onReconectado = () => setReloadTick(t => t + 1)
    window.addEventListener('sm-reconectado', onReconectado)
    return () => window.removeEventListener('sm-reconectado', onReconectado)
  }, [])

  // Suscripción en tiempo real a reportes: sin esto, la lista de Operario
  // dependía solo de la caché de 60s, así que si alguien más resolvía un
  // reporte, acá se seguía viendo "Pendiente"/"En Proceso" por casi un
  // minuto — suficiente para alcanzar a generar una actualización sobre un
  // reporte que ya estaba cerrado. Con esto se entera casi al instante.
  useEffect(() => {
    let timer = null
    const channel = supabase.channel('operario-reportes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          invalidateCache('operario_reportes')
          setReloadTick(t => t + 1)
        }, 800)
      })
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [])

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
  const [estadoInicial, setEstadoInicial] = useState('Pendiente')
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
    e?.stopPropagation()
    if (previewGallery.length < 2) return
    const idx = (previewIndex - 1 + previewGallery.length) % previewGallery.length
    setPreviewIndex(idx)
    setPreviewLoading(true)
    setPreviewImage(previewGallery[idx])
  }
  const showNextPreview = (e) => {
    e?.stopPropagation()
    if (previewGallery.length < 2) return
    const idx = (previewIndex + 1) % previewGallery.length
    setPreviewIndex(idx)
    setPreviewLoading(true)
    setPreviewImage(previewGallery[idx])
  }
  const [reportes, setReportes] = useState([])

  // Numerito del ícono de la app (como WhatsApp): refleja los reportes
  // pendientes cada vez que la lista se actualiza — solo cuenta los que
  // este usuario realmente puede ver (misma regla que usa el servidor al
  // mandar la notificación), no el total de la empresa.
  useEffect(() => {
    actualizarBadge(reportes.filter(r => (r.estado || 'Pendiente') !== 'Resuelto' && puedeVerReporte(user, r)).length)
  }, [reportes, user])

  // Notificación push tocada: abre ese reporte directo, sin que el
  // usuario tenga que buscarlo.
  useEffect(() => {
    if (!pendingReportId) return
    if (modulo !== 'visor') { setModulo('visor'); return }
    const encontrado = reportes.find(r => r.id === pendingReportId)
    if (encontrado) {
      // Una notificación vieja o de otro dispositivo podría apuntar a un
      // reporte que ya no le corresponde ver a este usuario (o nunca le
      // correspondió) — no se abre si no tiene permiso.
      if (puedeVerReporte(user, encontrado)) setReporteModal(encontrado)
      onPendingReportHandled && onPendingReportHandled()
    }
  }, [pendingReportId, reportes, modulo])

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
        try {
          const [estRes, mtRes, trRes, caRes] = await Promise.all([
            supabase.from('estaciones').select('*'),
            supabase.from('mantenimiento_tipos').select('*').order('id'),
            supabase.from('unidades_tractos').select('*').order('placa'),
            supabase.from('unidades_carretas').select('*').order('placa'),
          ])
          if (estRes.data && mtRes.data && trRes.data && caRes.data) {
            catalogos = { estaciones: estRes.data, mantenimiento: mtRes.data, tractos: trRes.data, carretas: caRes.data }
            setCached(cacheKey, catalogos)
          }
        } catch (err) {
          console.error('No se pudo conectar para cargar catálogos:', err)
        }
        // Sin internet (o Supabase no respondió): usamos la última copia
        // guardada en el celular, aunque esté vieja, para no dejar el
        // formulario vacío. Se refresca sola en cuanto vuelva la señal.
        if (!catalogos) catalogos = getCachedStale(cacheKey)
      }
      if (!catalogos) return
      if (catalogos.estaciones) {
        const permitidas = user.estaciones === 'Todas' ? catalogos.estaciones : catalogos.estaciones.filter(e => user.estaciones.includes(e.nombre))
        setEstaciones(permitidas)
      }
      if (catalogos.mantenimiento) setMantenimientoTipos(catalogos.mantenimiento)
      if (catalogos.tractos) setUnidadesTractos(catalogos.tractos)
      if (catalogos.carretas) setUnidadesCarretas(catalogos.carretas)
    }
    fetchIniciales()
    // user.estaciones también como dependencia: si Gerencia le cambia las
    // estaciones asignadas a alguien que ya tiene la app abierta, esto tiene
    // que recalcularse solo — si no, se queda con el alcance viejo (menos
    // estaciones) aunque el permiso ya se haya actualizado en vivo.
  }, [reloadTick, user.estaciones])

  useEffect(() => {
    // También en el menú principal (modulo === null), no solo dentro del
    // Visor: si no, el numerito del ícono se calcula con la lista vacía
    // apenas se abre la app (antes de entrar al Visor) y borra el badge
    // aunque sigan pendientes de verdad sin resolver.
    if (modulo === 'visor' || modulo === null) {
      const fetchReportes = async () => {
        const cacheKey = 'operario_reportes'
        let data = getCached(cacheKey, 60 * 1000)
        if (!data) {
          try {
            const res = await supabase.from('reportes').select('*').order('creado_en', { ascending: false })
            data = res.data
            if (data) setCached(cacheKey, data)
          } catch (err) {
            console.error('No se pudo conectar para cargar reportes:', err)
          }
          if (!data) data = getCachedStale(cacheKey)
        }
        if (data) {
          if (user.estaciones !== 'Todas') {
            const permitidas = user.estaciones.split(',').map(s => s.trim())
            setReportes(data.filter(r => permitidas.includes(r.estacion_id) || ((user.permisos.unidades || user.permisos.verUnidades) && r.modulo === 'unidades')))
          } else {
            setReportes(data)
          }
        }
      }
      fetchReportes()
    }
  }, [modulo, reloadTick])

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
      // Cacheado (con respaldo offline): sin esto, en modo avión el
      // desplegable de isla/lado (surtidor) quedaba vacío y no dejaba
      // avanzar con el reporte.
      const cacheKey = `operario_islas_${estacionSeleccionada}`
      let data = getCached(cacheKey, 10 * 60 * 1000)
      if (!data) {
        try {
          const res = await supabase.from('islas_lados').select('*').eq('estacion_id', estacionSeleccionada)
          data = res.data
          if (data) setCached(cacheKey, data)
        } catch (err) {
          console.error('No se pudo conectar para cargar islas/lados:', err)
        }
        if (!data) data = getCachedStale(cacheKey)
      }

      if (!data && isMounted) {
        // Esta estación nunca se cargó con internet antes, así que no hay
        // nada guardado para mostrar sin conexión: se limpia en vez de dejar
        // los surtidores de la estación anterior seleccionada.
        setIslasLados([])
        setLadoSeleccionado('')
        setProductosDisponibles([])
        return
      }

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
      let estName = null
      let query = supabase.from('inventario').select('*').eq('modulo', modulo || 'grifo')

      if (modulo !== 'unidades') {
        estName = estaciones.find(e => e.id === estacionSeleccionada)?.nombre || estacionSeleccionada
        if (typeof estName === 'string') {
          query = query.eq('estacion', estName.toUpperCase())
        } else {
          return // Necesitamos estación válida para grifo
        }
      }

      const cacheKey = `operario_inventario_${modulo || 'grifo'}_${estName || 'unidades'}`
      let data = getCached(cacheKey, 2 * 60 * 1000)
      if (!data) {
        try {
          const res = await query
          data = res.data
          if (data) setCached(cacheKey, data)
        } catch (err) {
          console.error('No se pudo conectar para cargar inventario:', err)
        }
        if (!data) data = getCachedStale(cacheKey)
      }

      if (!data && isMounted) {
        // Igual que con islas/lados: sin caché para esta estación, se limpia
        // en vez de mostrar el inventario de la estación anterior.
        setInventario([])
        return
      }

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
  }, [estacionSeleccionada, estaciones, modulo, oldRepuestoText, editingReportId, reloadTick])

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
        estado: estadoInicial,
        resuelto_en: estadoInicial === 'Resuelto' ? new Date().toISOString() : null,
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
          supabase.storage.from('evidencias').upload(filePath, fotoObj.file, { cacheControl: '31536000' }),
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
          creado_por: user.nombre, creado_en: new Date(fechaSuceso).toISOString(),
          estado: estadoInicial,
          resuelto_en: estadoInicial === 'Resuelto' ? new Date().toISOString() : null
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
        setEstadoInicial('Pendiente')
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
    setEstadoInicial('Pendiente')
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
      <div style={{background: 'var(--card-bg)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-float)', width: '100%', maxWidth: '400px', textAlign: 'center'}}>
        <h3 style={{marginBottom: '1rem', color: appModal.title === 'Error' || appModal.title === 'Atención' || appModal.title === 'Stock Insuficiente' ? 'var(--danger)' : 'var(--primary)'}}>{appModal.title}</h3>
        <p style={{marginBottom: '2rem', color: 'var(--text-soft)'}}>{appModal.message}</p>
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
                <button className="btn-toggle" style={{flex: 1}} onClick={() => { setAppModal({...appModal, isOpen: false}); setModulo(null); }}>Volver al Menú</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  const renderPreviewLightbox = () => previewImage && (
    <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}} onClick={() => setPreviewImage(null)}>
      <div style={{position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '0.5rem', zIndex: 1}}>
        <button title="Descargar foto" onClick={(e) => { e.stopPropagation(); descargarImagen(previewImage, showAlert) }} style={{background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>⬇</button>
        <button style={{background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setPreviewImage(null)}>×</button>
      </div>
      {previewGallery.length > 1 && (
        <div style={{position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: '0.9rem', background: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.75rem', borderRadius: '999px'}}>
          {previewIndex + 1} / {previewGallery.length}
        </div>
      )}
      {previewLoading && (
        <div style={{position: 'absolute', color: 'white', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'}}>
          <div style={{width: '38px', height: '38px', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite'}} />
          Cargando foto...
        </div>
      )}
      <ZoomableImage
        src={previewImage}
        alt="Fullscreen Preview"
        onContextMenu={(e) => e.preventDefault()}
        onLoad={() => setPreviewLoading(false)}
        onError={() => setPreviewLoading(false)}
        onSwipeLeft={previewGallery.length > 1 ? showNextPreview : undefined}
        onSwipeRight={previewGallery.length > 1 ? showPrevPreview : undefined}
        style={{maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 'var(--radius-md)', opacity: previewLoading ? 0 : 1, transition: 'opacity 0.15s'}}
      />
    </div>
  )

  if (!modulo) {
    return (
      <div className="flex-center">
        <div className="login-card menu-card" style={{padding: '2rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
            <div>
              <h2 style={{fontSize: '1.25rem'}}>Hola, {nombreVisible(user)}</h2>
              <p className="subtitle">¿Qué deseas reportar hoy?</p>
            </div>
            <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{iniciales(user)}</div>
          </div>
          <div className="module-buttons">
            {user.permisos.grifos && (
              <button className="btn-module" onClick={() => handleNewReport('grifo')}>
                <GasPumpIcon size={22} /><span>Sistema Grifo</span>
              </button>
            )}
            {user.permisos.unidades && (
              <button className="btn-module" onClick={() => handleNewReport('unidades')}>
                <TruckIcon size={22} /><span>Sistema Unidades</span>
              </button>
            )}
            {user.permisos.soluciones && (
              <button className="btn-module" onClick={() => setModulo('visor')}>
                <BookIcon size={22} /><span>Visor de Soluciones</span>
              </button>
            )}

            {(user.permisos.dashboard || user.permisos.inventario || user.permisos.config) && (
              <button className="btn-module" style={{background: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.4)'}} onClick={onSwitchView}>
                <ChartIcon size={22} /><span>Panel Administrativo</span>
              </button>
            )}

            {(user.permisos.grifos || user.permisos.unidades) && (
              <button
                className="btn-module"
                style={{background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.35)', fontSize: '0.85rem', opacity: isSyncingBtn ? 0.7 : 1}}
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
                {isSyncingBtn ? <ClockIcon size={22} /> : <RefreshIcon size={22} />}
                <span>{isSyncingBtn ? 'Sincronizando...' : 'Subir Pendientes'}</span>
              </button>
            )}

          </div>
          <button className="btn-text full-width mt-4" onClick={() => window.confirm('¿Desea cerrar sesión?') && onLogout()}>Cerrar Sesión</button>
        </div>
        {renderAppModal()}
      </div>
    )
  }

  if (modulo === 'visor') {
    return (
      <div className="mobile-view mobile-view--wide">
        <header>
          <div className="header-content">
            <h1>Base de Conocimiento</h1>
            <p className="subtitle text-accent">Soluciones Previas</p>
          </div>
          <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{iniciales(user)}</div>
        </header>
        <main style={{padding: '1.5rem'}}>
          <VisorSoluciones
            reportes={reportes}
            user={user}
            estacionesPermitidas={estaciones.map(e => e.nombre)}
            displayIslaLado={displayIslaLado}
            setReporteModal={setReporteModal}
          />
          <button className="btn-toggle full-width mt-4" onClick={() => setModulo(null)}>Volver al Menú</button>
        </main>

        <ReporteDetalleModal
          reporteModal={reporteModal}
          setReporteModal={setReporteModal}
          user={user}
          setReportes={(updater) => {
            setReportes(updater)
            invalidateCache('operario_reportes')
          }}
          showAlert={showAlert}
          openPreview={openPreview}
          displayIslaLado={displayIslaLado}
          onEditReport={(reporte) => { setReporteModal(null); setReportToEdit(reporte) }}
        />

        {renderAppModal()}
        {renderPreviewLightbox()}
      </div>
    )
  }

  return (
    <div className="mobile-view mobile-view--form">
      <header>
        <div className="header-content">
          <h1>{modulo === 'grifo' ? 'Reporte de Grifo' : 'Reporte de Unidades'}</h1>
          <p className="subtitle">Llenado rápido</p>
        </div>
        <div className="user-avatar" onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{iniciales(user)}</div>
      </header>
      <main className="standard-form">
        <form onSubmit={handleSubmit}>
          
          <div className="form-columns">
            <div className="form-section">
              <h3 className="form-section-title">{modulo === 'grifo' ? 'Datos del Grifo' : 'Configuración de la Unidad'}</h3>
              {modulo === 'grifo' ? (
                <div className="form-grid">
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
                      <option value="" disabled>Seleccione un Surtidor/Lado...</option>{islasLados.length === 0 && <option value="">No hay lados configurados (si estás sin internet, entra aquí una vez con señal para guardarlos)</option>}
                      {islasLados.map(il => (
                        <option key={il.id} value={il.id}>Isla {il.isla} - Lado {il.lado}</option>
                      ))}
                    </select>
                  </div>

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
                </div>
              ) : (
                <>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Placa del Tracto</label>
                      <select value={tractoSeleccionado} onChange={e => setTractoSeleccionado(e.target.value)}>
                        <option value="">(Ningún Tracto)</option>
                        {unidadesTractos.map(t => <option key={t.id} value={t.placa}>{t.placa}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Placa de la Carreta</label>
                      <select value={carretaSeleccionada} onChange={e => setCarretaSeleccionada(e.target.value)}>
                        <option value="">(Ninguna Carreta)</option>
                        {unidadesCarretas.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                      </select>
                    </div>
                  </div>

                  {!tractoSeleccionado && !carretaSeleccionada && (
                    <p style={{color: 'var(--danger)', fontSize: '0.85rem', marginTop: '1rem'}}>⚠️ Debes seleccionar al menos un Tracto o una Carreta para continuar.</p>
                  )}
                </>
              )}
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Detalles del Reporte</h3>
              <div className="form-grid">
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

                {repuestoUsado !== 'Ninguno' && (
                  <div className="form-group">
                    <label>Cantidad Utilizada de {inventario.find(i => i.id === parseInt(repuestoUsado))?.nombre}</label>
                    <input type="number" min="1" value={cantidadUsada} onChange={e => setCantidadUsada(parseInt(e.target.value))} required />
                  </div>
                )}

                <div className="form-group">
                  <label>Fecha y Hora del Suceso</label>
                  <input type="datetime-local" value={fechaSuceso} onChange={e => setFechaSuceso(e.target.value)} required readOnly={!(user.permiso_config || user.rol === 'Gerencia')} style={{color: (user.permiso_config || user.rol === 'Gerencia') ? 'var(--text-main)' : 'var(--text-muted)', cursor: (user.permiso_config || user.rol === 'Gerencia') ? 'text' : 'not-allowed'}} />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Evidencia Fotográfica (Obligatorio)</h3>
            <div style={{background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-soft)'}}>
              {existingFotos.length > 0 && (
                <div style={{marginBottom: '1rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-soft)'}}>Fotos guardadas anteriormente:</label>
                  <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                    {existingFotos.map((url, i) => (
                      <div key={i} style={{position: 'relative', cursor: 'pointer'}} onClick={() => openPreview(existingFotos, url)} onContextMenu={(e) => e.preventDefault()}>
                        <img src={url} alt="Evidencia previa" draggable={false} style={{height: '80px', borderRadius: 'var(--radius-md)', border: '1px solid var(--text-muted)', objectFit: 'cover', pointerEvents: 'none'}} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setExistingFotos(existingFotos.filter((_, index) => index !== i)); }} style={{position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold'}}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>{existingFotos.length > 0 ? 'Agregar más fotos:' : 'Subir foto (Obligatorio):'}</label>
              
              <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                <button type="button" onClick={tomarFotoNativa} className="btn-primary" style={{flex: 1, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                  📸 Tomar Foto Nativa
                </button>
              </div>
              
              <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>O subir desde archivos:</div>
              <input type="file" multiple accept="image/*" onChange={handleFileChange} required={existingFotos.length === 0 && fotos.length === 0} style={{color: 'white', width: '100%'}} />
              
              {fotos.length > 0 && (
                <div style={{marginTop: '1rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--accent)'}}>Nuevas fotos seleccionadas ({fotos.length}):</label>
                  <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                    {fotos.map((fotoObj, i) => (
                      <div key={i} style={{position: 'relative', cursor: 'pointer'}} onClick={() => openPreview(fotos.map(fo => fo.preview), fotoObj.preview)} onContextMenu={(e) => e.preventDefault()}>
                        <img src={fotoObj.preview} alt="Preview" draggable={false} style={{height: '80px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', objectFit: 'cover', pointerEvents: 'none'}} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeFoto(i); }} style={{position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold'}}>×</button>
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

          {!editingReportId && (
            <div className="form-group">
              <label>Estado del Reporte</label>
              <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                {ESTADOS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEstadoInicial(e)}
                    style={{
                      flex: '1 1 100px', padding: '0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: `1px solid ${colorDeEstado(e)}`,
                      background: estadoInicial === e ? colorDeEstado(e) : 'transparent',
                      color: estadoInicial === e ? 'var(--card-bg)' : colorDeEstado(e),
                      fontWeight: 'bold', fontSize: '0.85rem'
                    }}
                  >{e}</button>
                ))}
              </div>
              <small style={{color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem'}}>Si ya lo resolviste en el momento, márcalo directamente como Resuelto.</small>
            </div>
          )}

          <div className="form-actions" style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem'}}>
            <button type="submit" className="btn-primary full-width" style={{padding: '1rem', fontSize: '1.1rem'}} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando reporte...' : (editingReportId ? 'Actualizar Reporte' : 'Confirmar y Guardar')}
            </button>
            <button type="button" className="btn-toggle" style={{width: '100%', padding: '1rem', fontSize: '1.1rem'}} onClick={() => { setModulo(null); setEditingReportId(null); }}>Cancelar</button>
          </div>
        </form>
      </main>

      {renderAppModal()}
      {renderPreviewLightbox()}
    </div>
  )
}
