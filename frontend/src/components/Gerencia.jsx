import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useBackHandler } from '../utils/backButton'
import { colorDeEstado, diasTranscurridos } from '../utils/estado'
import ReporteSeguimiento from './ReporteSeguimiento'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler
} from 'chart.js'
import { Bar, Doughnut, Line, Radar, Chart } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler,
  ChartDataLabels
)

export default function Gerencia({ onLogout, user, onSwitchView, onEditReport }) {
  const [tab, setTab] = useState(() => localStorage.getItem('gerencia_tab') || 'dashboard')

  useEffect(() => {
    localStorage.setItem('gerencia_tab', tab)
  }, [tab])
  
  // Estados Reales desde Supabase
  const [usuarios, setUsuarios] = useState([])
  const [estaciones, setEstaciones] = useState([])
  const [islasLados, setIslasLados] = useState([])
  const [unidadesTractos, setUnidadesTractos] = useState([])
  const [unidadesCarretas, setUnidadesCarretas] = useState([])
  const [inventario, setInventario] = useState([])
  const [mantenimientoTipos, setMantenimientoTipos] = useState([])
  const [nuevoMantenimiento, setNuevoMantenimiento] = useState('')
  const [nuevoTracto, setNuevoTracto] = useState('')
  const [nuevaCarreta, setNuevaCarreta] = useState('')
  
  // Visor
  const [reporteModal, setReporteModal] = useState(null)
  
  // Kardex
  const [movimientos, setMovimientos] = useState([])
  const [kardexModal, setKardexModal] = useState(null)
  
  const [reportes, setReportes] = useState([])
  const [filtroEstacion, setFiltroEstacion] = useState('Todas')
  const [invModulo, setInvModulo] = useState('grifo')
  
  // Dashboard Filters
  const [dashModulo, setDashModulo] = useState('grifo')
  const [mantModulo, setMantModulo] = useState('grifo')
  const [configModulo, setConfigModulo] = useState('grifo')
  const [visorModulo, setVisorModulo] = useState('grifo')
  const [isTractosExpanded, setIsTractosExpanded] = useState(true)
  const [isCarretasExpanded, setIsCarretasExpanded] = useState(true)
  const [dashFiltroEstaciones, setDashFiltroEstaciones] = useState([])
  const [dashFiltroProducto, setDashFiltroProducto] = useState('Todos')
  const [dashFiltroFecha, setDashFiltroFecha] = useState({ inicio: '', fin: '' })
  const [dashFiltroRepuesto, setDashFiltroRepuesto] = useState('Todos')
  const [visorBusquedaPlaca, setVisorBusquedaPlaca] = useState('')

  const estacionesPermitidas = user.estaciones === 'Todas' ? estaciones.map(e => e.nombre) : user.estaciones.split(',').map(s=>s.trim()).filter(Boolean)
  
  const toggleEstacionFiltro = (estNombre) => {
    if (dashFiltroEstaciones.includes(estNombre)) {
      setDashFiltroEstaciones(dashFiltroEstaciones.filter(e => e !== estNombre))
    } else {
      setDashFiltroEstaciones([...dashFiltroEstaciones, estNombre])
    }
  }

  // Mobile layout state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  const displayIslaLado = (val) => {
    if (val && val.startsWith('ID: ')) {
      const id = parseInt(val.replace('ID: ', ''))
      const match = islasLados.find(il => il.id === id)
      return match ? `Isla ${match.isla} - Lado ${match.lado}` : val
    }
    return val || 'General'
  }
  
  const [editingUser, setEditingUser] = useState(null)
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', password: '', rol: 'Operario', estaciones: 'Todas' })

  // Estado para Modal de Crear Estación
  const [estacionModal, setEstacionModal] = useState({ 
    isOpen: false, 
    nombre: '', 
    productosStr: '',
    productosList: [],
    cantidadIslas: 1
  })

  // Estado Modal Universal para evitar alertas nativas
  const [appModal, setAppModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: null
  })
  const [previewImage, setPreviewImage] = useState(null)
  const [previewGallery, setPreviewGallery] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Abre el visor de fotos a pantalla completa; si el reporte tiene varias
  // evidencias permite pasar de una a otra (como en WhatsApp) sin cerrar
  // y volver a tocar cada miniatura.
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
  
  const showAlert = (title, message) => setAppModal({ isOpen: true, title, message, type: 'alert', onConfirm: null })
  const showConfirm = (title, message, onConfirm) => setAppModal({ isOpen: true, title, message, type: 'confirm', onConfirm })

  // Estado para controlar qué estaciones están expandidas (visibles)
  const [expandedEstaciones, setExpandedEstaciones] = useState([])
  const [selectedInvEstacion, setSelectedInvEstacion] = useState('')

  useEffect(() => {
    if (tab === 'inventario' && !selectedInvEstacion) {
      const estacionesArray = user.estaciones === 'Todas' ? estaciones.map(e => e.nombre) : user.estaciones.split(',').map(s=>s.trim()).filter(Boolean)
      const opciones = Array.from(new Set(estacionesArray.map(e => e.toUpperCase())))
      setSelectedInvEstacion(opciones.length > 0 ? opciones[0] : '')
    }
  }, [tab, user.estaciones, estaciones, selectedInvEstacion])

  // Estado para Modal de Isla/Lado
  const [islaModal, setIslaModal] = useState({
    isOpen: false,
    estacion: null,
    isla: '',
    ladosStr: '',
    productos: []
  })

  // Botón físico "Atrás": cierra primero lo más "encima" (lightbox e imagen
  // de evidencia > modales de detalle/edición > menú lateral móvil).
  useBackHandler(!!previewImage, () => setPreviewImage(null), 100)
  useBackHandler(!!reporteModal, () => setReporteModal(null), 90)
  useBackHandler(!!kardexModal, () => setKardexModal(null), 90)
  useBackHandler(estacionModal.isOpen, () => setEstacionModal({ isOpen: false, nombre: '', productosStr: '', productosList: [], cantidadIslas: 1 }), 85)
  useBackHandler(islaModal.isOpen, () => setIslaModal({ ...islaModal, isOpen: false }), 85)
  useBackHandler(appModal.isOpen, () => setAppModal(prev => ({ ...prev, isOpen: false })), 80)
  useBackHandler(isMobileMenuOpen, () => setIsMobileMenuOpen(false), 20)
  useBackHandler(tab !== 'dashboard', () => setTab('dashboard'), 5)

  const fetchReportes = async () => {
    const { data } = await supabase.from('reportes').select('*').order('creado_en', { ascending: false })
    if (data) {
      if (user.estaciones !== 'Todas') {
        const permitidas = user.estaciones.split(',').map(s => s.trim())
        setReportes(data.filter(r => permitidas.includes(r.estacion_id)))
      } else {
        setReportes(data)
      }
    }
  }

  const fetchMovimientos = async () => {
    const { data } = await supabase.from('inventario_movimientos').select('*').order('creado_en', { ascending: false })
    if (data) setMovimientos(data)
  }

  const fetchInventario = async () => {
    const { data } = await supabase.from('inventario').select('*')
    if (data) setInventario(data)
  }

  // Catálogos: se cargan una sola vez al entrar (en paralelo, no en cascada)
  // en vez de repetirse completos cada vez que se cambia de pestaña.
  useEffect(() => {
    const fetchCatalogos = async () => {
      const [usersRes, estRes, ilRes, tractosRes, carretasRes] = await Promise.all([
        supabase.from('usuarios').select('*').order('id'),
        supabase.from('estaciones').select('*'),
        supabase.from('islas_lados').select('*').order('isla'),
        supabase.from('unidades_tractos').select('*').order('placa'),
        supabase.from('unidades_carretas').select('*').order('placa'),
      ])
      if (usersRes.data) setUsuarios(usersRes.data)
      if (estRes.data) setEstaciones(estRes.data)
      if (ilRes.data) setIslasLados(ilRes.data.filter(il => il.activo !== false))
      if (tractosRes.data) setUnidadesTractos(tractosRes.data)
      if (carretasRes.data) setUnidadesCarretas(carretasRes.data)
      fetchInventario()
    }
    fetchCatalogos()
  }, [])

  // Datos según la pestaña activa
  useEffect(() => {
    if (tab === 'soluciones' || tab === 'dashboard') fetchReportes()
    if (tab === 'inventario') fetchMovimientos()
    if (tab === 'mantenimiento') {
      supabase.from('mantenimiento_tipos').select('*').order('id').then(({ data }) => {
        if (data) setMantenimientoTipos(data)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Suscripción en tiempo real: cada tabla refresca únicamente su propio dato
  // (nunca todo el catálogo) y con debounce, para no saturar a todas las
  // sesiones de Gerencia abiertas cada vez que alguien crea un reporte o
  // mueve inventario.
  useEffect(() => {
    const timers = {
      reportes: { current: null },
      inventario: { current: null },
      movimientos: { current: null },
      catalogos: { current: null },
      estaciones: { current: null },
      islasLados: { current: null },
    }

    const debounced = (timerRef, fn, ms = 1000) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fn, ms)
    }

    const channel = supabase.channel('gerencia-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => {
        debounced(timers.reportes, fetchReportes)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, () => {
        debounced(timers.inventario, fetchInventario)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_movimientos' }, () => {
        debounced(timers.movimientos, fetchMovimientos)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => {
        debounced(timers.catalogos, () => supabase.from('usuarios').select('*').order('id').then(({ data }) => { if (data) setUsuarios(data) }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, () => {
        debounced(timers.estaciones, () => supabase.from('estaciones').select('*').then(({ data }) => { if (data) setEstaciones(data) }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'islas_lados' }, () => {
        debounced(timers.islasLados, () => supabase.from('islas_lados').select('*').order('isla').then(({ data }) => { if (data) setIslasLados(data.filter(il => il.activo !== false)) }))
      })
      .subscribe()

    return () => {
      Object.values(timers).forEach(t => clearTimeout(t.current))
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.estaciones])

  // CRUD USUARIOS
  const handleCreateUser = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.from('usuarios').insert([nuevoUsuario]).select()
    if (error) {
      showAlert('Error', 'Error creando usuario: ' + error.message)
    } else {
      setUsuarios([...usuarios, data[0]])
      setNuevoUsuario({ nombre: '', password: '', rol: 'Operario', estaciones: 'Todas' })
      showAlert('Éxito', 'Usuario creado exitosamente')
    }
  }

  const handleSaveUserPermissions = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('usuarios')
      .update({
        rol: editingUser.rol,
        estaciones: editingUser.estaciones,
        permiso_config: editingUser.permiso_config,
        permiso_inventario: editingUser.permiso_inventario,
        permiso_dashboard: editingUser.permiso_dashboard,
        permiso_soluciones: editingUser.permiso_soluciones,
        permiso_editar_reportes: editingUser.permiso_editar_reportes,
        permiso_grifos: editingUser.permiso_grifos,
        permiso_unidades: editingUser.permiso_unidades
      })
      .eq('id', editingUser.id)

    if (error) {
      showAlert('Error', 'Error guardando permisos: ' + error.message)
    } else {
      showAlert('Éxito', `Información actualizada para ${editingUser.nombre}`)
      setEditingUser(null)
    }
  }

  const handleDeleteUser = (id) => {
    showConfirm('Eliminar Usuario', '¿Estás seguro de que deseas eliminar este usuario permanentemente?', async () => {
      const { error } = await supabase.from('usuarios').delete().eq('id', id)
      if (error) showAlert('Error', 'Error eliminando usuario: ' + error.message)
      else setEditingUser(null)
    })
  }

  const handleAddProductoToEstacion = (e) => {
    e.preventDefault()
    if (estacionModal.productosStr.trim()) {
      const newProd = estacionModal.productosStr.trim().toUpperCase()
      if (!estacionModal.productosList.includes(newProd)) {
        setEstacionModal({...estacionModal, productosList: [...estacionModal.productosList, newProd], productosStr: ''})
      }
    }
  }

  const handleSaveEstacionModal = async (e) => {
    e.preventDefault()
    if (!estacionModal.nombre || estacionModal.productosList.length === 0 || estacionModal.cantidadIslas < 1) {
      return showAlert('Aviso', 'Debe completar el nombre, añadir al menos un producto, y tener mínimo 1 isla.')
    }
    const id = estacionModal.nombre.toLowerCase().replace(/\s/g, '_')
    const { error } = await supabase.from('estaciones').insert([{ 
      id, 
      nombre: estacionModal.nombre,
      productos_disponibles: estacionModal.productosList.join(','),
      cantidad_islas: estacionModal.cantidadIslas
    }])
    if (!error) {
      setEstacionModal({ isOpen: false, nombre: '', productosStr: '', productosList: [], cantidadIslas: 1 })
      showAlert('Éxito', 'Estación creada exitosamente.')
    } else {
      showAlert('Error', 'Error creando estación: ' + error.message)
    }
  }

  const openIslaModal = (estacion, numIsla) => {
    setIslaModal({
      isOpen: true,
      estacion,
      isla: numIsla || '',
      ladosStr: '',
      productos: []
    })
  }

  const handleSaveIslaModal = async (e) => {
    e.preventDefault()
    if (!islaModal.isla || !islaModal.ladosStr || islaModal.productos.length === 0) {
      return showAlert('Aviso', 'Debe completar el número de isla, ingresar al menos un lado (ej: 1, 2) y seleccionar al menos un producto.')
    }
    
    // Parsear los lados separados por coma (ej: "1, 2, 20" -> [1, 2, 20])
    const lados = islaModal.ladosStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    if (lados.length === 0) return showAlert('Error', 'Formato de lados inválido. Ingrese números separados por coma.')

    // VALIDACIÓN DE DUPLICADOS ACTIVOS
    for (let lado of lados) {
      const existe = islasLados.find(il => il.estacion_id === islaModal.estacion.id && il.isla === parseInt(islaModal.isla) && il.lado === lado)
      if (existe) {
        return showAlert('Aviso', `El Lado ${lado} de la Isla ${islaModal.isla} ya está configurado y activo. Por favor, desactívalo primero de la tabla si quieres reconfigurarlo.`)
      }
    }

    // Insertar un registro por cada lado ingresado
    const insertData = lados.map(lado => ({
      estacion_id: islaModal.estacion.id,
      isla: parseInt(islaModal.isla),
      lado: lado,
      productos: islaModal.productos.join(', ')
    }))

    const { error } = await supabase.from('islas_lados').insert(insertData)
    if (error) {
      showAlert('Error', 'Error al guardar: ' + error.message)
    } else {
      setIslaModal({ isOpen: false, estacion: null, isla: '', ladosStr: '', productos: [] })
    }
  }

  const handleDisableIslaLado = (id) => {
    showConfirm('Desactivar Lado', '¿Desactivar este lado? Quedará en el historial de la base de datos pero desaparecerá de la vista operativa.', async () => {
      const { error } = await supabase.from('islas_lados').update({ activo: false }).eq('id', id)
      if (!error) setIslasLados(islasLados.filter(il => il.id !== id))
      else showAlert('Error', 'Error: ' + error.message)
    })
  }

  const handleAddIslaToEstacion = (est) => {
    showConfirm('Añadir Isla', `¿Agregar una isla adicional a ${est.nombre}?`, async () => {
      const nuevaCantidad = (est.cantidad_islas || 0) + 1
      const { error } = await supabase.from('estaciones').update({ cantidad_islas: nuevaCantidad }).eq('id', est.id)
      if (error) showAlert('Error', 'Error añadiendo isla: ' + error.message)
    })
  }

  const toggleEstacion = (id) => {
    if (expandedEstaciones.includes(id)) {
      setExpandedEstaciones(expandedEstaciones.filter(eId => eId !== id))
    } else {
      setExpandedEstaciones([...expandedEstaciones, id])
    }
  }

  // Helper: parsear repuestos de la descripción
  const getRepuestosFromDesc = (desc) => {
    const matches = [...(desc || '').matchAll(/\[📦 Repuesto utilizado:\s*(.*?)\sx(\d+)\]/g)]
    return matches.map(m => ({ nombre: m[1].trim(), cantidad: parseInt(m[2], 10) }))
  }

  return (
    <div className="desktop-layout">
      {/* Mobile Overlay */}
      <div 
        className={`mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`} 
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {!isSidebarCollapsed && <h2>Administración del Sistema</h2>}
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
        </div>
        <nav>
          {user.permisos.dashboard && <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { setTab('dashboard'); setIsMobileMenuOpen(false) }}>📊 {!isSidebarCollapsed && 'Dashboard KPI'}</button>}
          {user.permisos.soluciones && (() => {
            const pendientesCount = reportes.filter(r => (r.estado || 'Pendiente') !== 'Resuelto').length
            return (
              <button className={tab === 'soluciones' ? 'active' : ''} onClick={() => { setTab('soluciones'); setIsMobileMenuOpen(false) }} style={{display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between'}}>
                <span>📚 {!isSidebarCollapsed && 'Visor de Soluciones'}</span>
                {pendientesCount > 0 && (
                  <span title={`${pendientesCount} reporte(s) sin resolver`} style={{background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '999px', padding: isSidebarCollapsed ? '0' : '0.1rem 0.5rem', minWidth: isSidebarCollapsed ? '0' : '1.4rem', textAlign: 'center'}}>
                    {isSidebarCollapsed ? '' : pendientesCount}
                  </span>
                )}
              </button>
            )
          })()}
          {user.permisos.inventario && <button className={tab === 'inventario' ? 'active' : ''} onClick={() => { setTab('inventario'); setIsMobileMenuOpen(false) }}>📦 {!isSidebarCollapsed && 'Inventario Estaciones'}</button>}
          {user.permisos.config && <button className={tab === 'usuarios' ? 'active' : ''} onClick={() => { setTab('usuarios'); setIsMobileMenuOpen(false) }}>👥 {!isSidebarCollapsed && 'Accesos (ABAC)'}</button>}
          {user.permisos.config && <button className={tab === 'mantenimiento' ? 'active' : ''} onClick={() => { setTab('mantenimiento'); setIsMobileMenuOpen(false) }}>🛠️ {!isSidebarCollapsed && 'Catálogo de Mantenimiento'}</button>}
          {user.permisos.config && <button className={tab === 'config' ? 'active' : ''} onClick={() => { setTab('config'); setIsMobileMenuOpen(false) }}>⚙️ {!isSidebarCollapsed && 'Configuración Estaciones'}</button>}
          
          <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0'}}></div>
          <button onClick={onSwitchView} style={{background: '#1e293b', border: '1px solid #3b82f6'}}>📱 {!isSidebarCollapsed && 'Modo Operario'}</button>
          
        </nav>
        <button className="btn-text" style={{marginTop: 'auto'}} onClick={() => window.confirm('�Desea cerrar sesi�n?') && onLogout()}>{!isSidebarCollapsed ? 'Cerrar Sesión' : '🚪'}</button>
      </aside>

      <main className="dashboard-main">
        <header className="desktop-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>☰</button>
            <button style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', padding: '0.5rem'}} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title="Colapsar Menú" className="desktop-collapse-btn">☰</button>
            <h1 id="gerencia-title">
              {tab === 'dashboard' && 'Dashboard Operativo'}
              {tab === 'soluciones' && 'Visor de Soluciones'}
              {tab === 'usuarios' && 'Gestión de Accesos (ABAC)'}
              {tab === 'inventario' && 'Inventario Global por Estación'}
              {tab === 'config' && 'Configuración de Estaciones'}
            </h1>
          </div>
          <div className="user-avatar">{user.nombre.substring(0,2)}</div>
        </header>
        
        <div className="dashboard-content">
          
          {tab === 'dashboard' && (
            (() => {
              const reportesDelModulo = reportes.filter(r => (r.modulo || 'grifo') === dashModulo)
              
              const activeStations = dashFiltroEstaciones.length > 0 ? dashFiltroEstaciones : estacionesPermitidas
              
              // FILTRO EN CASCADA: Opciones basadas solo en estaciones activas y módulo
              const reportesBaseFiltro = reportesDelModulo.filter(r => dashModulo === 'unidades' || activeStations.includes(r.estacion_id))
              
              const todosLosRepuestos = new Set()
              reportesBaseFiltro.forEach(r => {
                const repuestos = getRepuestosFromDesc(r.descripcion)
                repuestos.forEach(rep => todosLosRepuestos.add(rep.nombre))
              })
              const repuestosUnicos = ['Todos', ...Array.from(todosLosRepuestos)]
              const productosUnicos = ['Todos', ...Array.from(new Set(reportesBaseFiltro.map(r => r.producto)))]
              
              const ahora = new Date()

              const reportesFiltrados = reportesDelModulo.filter(r => {
                const passEstacion = dashModulo === 'unidades' ? true : activeStations.includes(r.estacion_id)
                const passProducto = dashFiltroProducto === 'Todos' || r.producto === dashFiltroProducto
                
                // Filtro Fecha
                let passFecha = true
                if (r.creado_en) {
                  const rDate = new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z'))
                  if (dashFiltroFecha.inicio) {
                    const start = new Date(dashFiltroFecha.inicio + 'T00:00:00')
                    if (rDate < start) passFecha = false
                  }
                  if (dashFiltroFecha.fin) {
                    const end = new Date(dashFiltroFecha.fin + 'T23:59:59')
                    if (rDate > end) passFecha = false
                  }
                }

                // Filtro Repuesto
                let passRepuesto = true
                if (dashFiltroRepuesto !== 'Todos') {
                  const repuestosEnReporte = getRepuestosFromDesc(r.descripcion).map(rep => rep.nombre)
                  passRepuesto = repuestosEnReporte.includes(dashFiltroRepuesto)
                }

                return passEstacion && passProducto && passFecha && passRepuesto
              })

              // Data Processing for Charts
              const reportesPorEstacion = activeStations.reduce((acc, est) => {
                acc[est] = reportesFiltrados.filter(r => r.estacion_id === est).length
                return acc
              }, {})

              // BI: Pareto de Motivos
              const motivosCount = reportesFiltrados.reduce((acc, r) => {
                acc[r.motivo] = (acc[r.motivo] || 0) + 1
                return acc
              }, {})
              const sortedMotivos = Object.entries(motivosCount).sort((a,b) => b[1]-a[1])
              const totalMotivos = sortedMotivos.reduce((sum, [, count]) => sum + count, 0)
              let paretoAcumulado = 0
              const paretoData = sortedMotivos.slice(0, 10).map(([motivo, count]) => {
                paretoAcumulado += count
                return {
                  motivo,
                  count,
                  cumPercent: totalMotivos > 0 ? (paretoAcumulado / totalMotivos) * 100 : 0
                }
              })

              // BI: MTBF (Mean Time Between Failures)
              let mtbf = 'N/A'
              if (reportesFiltrados.length > 1) {
                const fechas = reportesFiltrados.map(r => r.creado_en ? new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z')) : null).filter(Boolean)
                if (fechas.length > 1) {
                  const maxDate = new Date(Math.max(...fechas))
                  const minDate = new Date(Math.min(...fechas))
                  const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24)
                  mtbf = daysDiff > 0 ? (daysDiff / reportesFiltrados.length).toFixed(1) : '< 1'
                }
              }

              // BI: Top Repuestos Global
              const repuestosCount = reportesFiltrados.reduce((acc, r) => {
                const reps = getRepuestosFromDesc(r.descripcion)
                reps.forEach(rep => {
                  acc[rep.nombre] = (acc[rep.nombre] || 0) + rep.cantidad
                })
                return acc
              }, {})
              const topRepuesto = Object.entries(repuestosCount).sort((a,b)=>b[1]-a[1])[0]

              // BI: Tendencia y Regresión Lineal (Pronóstico)
              const fechasCount = reportesFiltrados.reduce((acc, r) => {
                const date = r.creado_en ? new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleDateString() : 'Sin Fecha'
                acc[date] = (acc[date] || 0) + 1
                return acc
              }, {})
              const sortedFechas = Object.entries(fechasCount)
                .filter(a => a[0] !== 'Sin Fecha')
                .sort((a,b) => new Date(a[0]) - new Date(b[0]))
              
              let regressionLine = []
              let predictionText = "Insuficientes datos históricos"
              let extendedLabels = []
              let realData = []
              let predictedNext7Days = 0;
              
              if (sortedFechas.length > 2) {
                // OLS Linear Regression
                const x = sortedFechas.map((_, i) => i)
                const y = sortedFechas.map(f => f[1])
                const n = x.length
                let sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0
                for (let i = 0; i < n; i++) {
                  sum_x += x[i]
                  sum_y += y[i]
                  sum_xy += (x[i] * y[i])
                  sum_xx += (x[i] * x[i])
                }
                const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
                const intercept = (sum_y - slope * sum_x) / n
                
                regressionLine = x.map(xi => slope * xi + intercept)
                
                // Forecast next 3 points
                extendedLabels = [...sortedFechas.map(f => f[0]), '+1 Día', '+2 Días', '+3 Días']
                realData = [...y, null, null, null]
                regressionLine.push(slope * n + intercept)
                regressionLine.push(slope * (n + 1) + intercept)
                regressionLine.push(slope * (n + 2) + intercept)
                
                // Forecast next 7 days KPI
                for (let i = n; i < n + 7; i++) {
                  const pred = slope * i + intercept
                  predictedNext7Days += pred > 0 ? pred : 0
                }
                predictionText = `Tendencia: ~${Math.round(predictedNext7Days)} fallas en los próximos 7 días`
              } else {
                extendedLabels = sortedFechas.map(f => f[0])
                realData = sortedFechas.map(f => f[1])
              }

              // BI: Matriz Repuestos vs Producto
              const top5RepuestosList = Object.entries(repuestosCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0])
              const repMatrixLabels = productosUnicos.filter(p => p !== 'Todos')
              const repMatrixColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
              
              const repMatrixDatasets = repMatrixLabels.map((prod, i) => ({
                label: prod,
                data: top5RepuestosList.map(repName => {
                  const reportesProd = reportesFiltrados.filter(r => r.producto === prod)
                  return reportesProd.reduce((sum, r) => {
                    const found = getRepuestosFromDesc(r.descripcion).find(rep => rep.nombre === repName)
                    return sum + (found ? found.cantidad : 0)
                  }, 0)
                }),
                backgroundColor: repMatrixColors[i % repMatrixColors.length]
              }))

              // BI: Drill-down Dinámico (Estaciones vs Producto -> Isla vs Producto)
              const isDrillDown = dashModulo === 'unidades' ? true : activeStations.length === 1;
              let drillDownAxis = [];
              let stackedDatasets = [];
              const stackLabels = dashModulo === 'unidades' ? [...new Set(reportesFiltrados.map(r => r.motivo))] : productosUnicos.filter(p => p !== 'Todos');
              const stackColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

              if (dashModulo === 'unidades') {
                const uniqueUnidades = [...new Set(reportesFiltrados.map(r => r.tracto_placa || r.carreta_placa || 'Desconocido'))].filter(Boolean);
                drillDownAxis = uniqueUnidades.slice(0, 7);
                
                stackedDatasets = stackLabels.map((motivo, i) => ({
                  label: motivo,
                  data: drillDownAxis.map(unidad => reportesFiltrados.filter(r => (r.tracto_placa || r.carreta_placa || 'Desconocido') === unidad && r.motivo === motivo).length),
                  backgroundColor: stackColors[i % stackColors.length]
                }))
              } else if (isDrillDown) {
                const uniqueIslas = [...new Set(reportesFiltrados.map(r => r.isla_lado ? displayIslaLado(r.isla_lado) : 'General'))].filter(Boolean);
                drillDownAxis = uniqueIslas.slice(0, 7);
                
                stackedDatasets = stackLabels.map((prod, i) => ({
                  label: prod,
                  data: drillDownAxis.map(isla => reportesFiltrados.filter(r => (r.isla_lado ? displayIslaLado(r.isla_lado) : 'General') === isla && r.producto === prod).length),
                  backgroundColor: stackColors[i % stackColors.length]
                }))
              } else {
                drillDownAxis = activeStations.slice(0, 5);
                stackedDatasets = stackLabels.map((prod, i) => ({
                  label: prod,
                  data: drillDownAxis.map(est => reportesFiltrados.filter(r => r.estacion_id === est && r.producto === prod).length),
                  backgroundColor: stackColors[i % stackColors.length]
                }))
              }
              const chartTitle4 = dashModulo === 'unidades' ? 'Perfil de Fallas por Unidad' : (isDrillDown ? 'Perfil de Fallas por Surtidor' : 'Perfil de Fallas por Producto');
              const chartTip4 = dashModulo === 'unidades' ? '💡 Tip: Muestra qué unidad genera más problemas y por qué motivo' : (isDrillDown ? '💡 Tip: Muestra qué Isla o Surtidor exacto genera más problemas' : '💡 Tip: Compara la composición del tipo de producto (colores) entre estaciones');

              // BI: Motor de Narrativa Ejecutiva (Data Storytelling)
              let narrativa1 = "";
              let narrativa2 = "";
              let narrativa3 = "";

              if (reportesFiltrados.length === 0) {
                narrativa1 = "✅ Todo estable. No hay incidencias en el rango seleccionado.";
              } else {
                // Insight 1: Riesgo Operativo
                if (mtbf !== 'N/A' && parseFloat(mtbf) < 1.0) {
                  narrativa1 = `🚨 Alerta Roja: El MTBF está en ${mtbf} días (falla acelerada). Alta inestabilidad operativa.`;
                } else if (mtbf !== 'N/A' && parseFloat(mtbf) < 5.0) {
                  narrativa1 = `⚠️ Precaución: El MTBF está en ${mtbf} días. Considere enviar cuadrilla preventiva.`;
                } else {
                  narrativa1 = `✅ Operación Estable: El MTBF es de ${mtbf} días. Buen ritmo operativo.`;
                }

                // Insight 2: Fuga de Capital
                if (topRepuesto) {
                  narrativa2 = `💰 Fuga de Capital: El repuesto "${topRepuesto[0]}" representa el mayor gasto histórico (${topRepuesto[1]} unidades). Se sugiere re-negociar volumen con proveedor.`;
                }

                // Insight 3: Foco de Acción
                  if (dashModulo === 'unidades' && drillDownAxis.length > 0) {
                    const fallasPorUnidad = drillDownAxis.map(unidad => {
                      return { unidad, fallas: reportesFiltrados.filter(r => (r.tracto_placa || r.carreta_placa || 'Desconocido') === unidad).length };
                    }).sort((a,b) => b.fallas - a.fallas);
                    
                    if (fallasPorUnidad[0] && fallasPorUnidad[0].fallas > 0) {
                      const porcentaje = Math.round((fallasPorUnidad[0].fallas / reportesFiltrados.length) * 100);
                      narrativa3 = `🎯 Decisión Estratégica: Si revisa a fondo la unidad "${fallasPorUnidad[0].unidad}", eliminará el ${porcentaje}% de los problemas.`;
                    }
                  } else if (isDrillDown && drillDownAxis.length > 0) {
                    const fallasPorIsla = drillDownAxis.map(isla => {
                      return { isla, fallas: reportesFiltrados.filter(r => (r.isla_lado ? displayIslaLado(r.isla_lado) : 'General') === isla).length };
                    }).sort((a,b) => b.fallas - a.fallas);
                    
                    if (fallasPorIsla[0] && fallasPorIsla[0].fallas > 0) {
                      const porcentaje = Math.round((fallasPorIsla[0].fallas / reportesFiltrados.length) * 100);
                      narrativa3 = `🎯 Decisión Estratégica: Si audita o reemplaza la "${fallasPorIsla[0].isla}", eliminará el ${porcentaje}% de los problemas de esta estación.`;
                    }
                  } else {
                  const topRiesgoEst = Object.entries(reportesPorEstacion).sort((a,b)=>b[1]-a[1])[0];
                  if (topRiesgoEst && topRiesgoEst[1] > 0) {
                    const porcentaje = Math.round((topRiesgoEst[1] / reportesFiltrados.length) * 100);
                    narrativa3 = `🎯 Foco de Acción: La estación "${topRiesgoEst[0]}" es responsable del ${porcentaje}% de todos los problemas. Priorice enviar supervisores allí.`;
                  }
                }
              }

              const repuestosTotales = reportesFiltrados.reduce((total, r) => {
                return total + getRepuestosFromDesc(r.descripcion).reduce((sum, rep) => sum + rep.cantidad, 0)
              }, 0)

              const reportesParaRiesgo = dashModulo === 'unidades' 
                ? reportesFiltrados.reduce((acc, r) => {
                    const u = r.tracto_placa || r.carreta_placa || 'Desconocido';
                    acc[u] = (acc[u] || 0) + 1;
                    return acc;
                  }, {})
                : reportesPorEstacion;
                
              const topRiesgo = Object.entries(reportesParaRiesgo).sort((a,b)=>b[1]-a[1])[0]

              return (
                <div style={{display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease-in-out'}}>
                  <style>
                    {`
                      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                      .premium-card { background: linear-gradient(145deg, #0f172a, #1e293b); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: transform 0.2s; }
                      .premium-card:hover { transform: translateY(-3px); box-shadow: 0 8px 12px rgba(59, 130, 246, 0.15); }
                      .filter-select { padding: 0.6rem; border-radius: 8px; background: rgba(30, 41, 59, 0.8); color: white; border: 1px solid #334155; font-size: 0.9rem; outline: none; transition: border 0.3s; }
                      .filter-select:focus { border-color: #3b82f6; }
                    `}
                  </style>

                  {/* Panel de Filtros Interactivos Toolbar */}
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                    <button className={dashModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDashModulo('grifo')} style={{flex: 1}}>
                      Dashboard Grifos
                    </button>
                    <button className={dashModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDashModulo('unidades')} style={{flex: 1}}>
                      Dashboard Unidades
                    </button>
                  </div>

                  <div className="premium-card" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
                      <h3 style={{margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{fontSize: '1.2rem'}}>🎛️</span> BI Filters (En Cascada)
                      </h3>
                      
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.3rem'}}>
                          <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Rango de Fechas:</span>
                          <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                            <input type="date" className="filter-select" value={dashFiltroFecha.inicio} onChange={e => setDashFiltroFecha({...dashFiltroFecha, inicio: e.target.value})} style={{padding: '0.4rem', fontSize: '0.8rem'}} />
                            <span style={{color: '#94a3b8'}}>-</span>
                            <input type="date" className="filter-select" value={dashFiltroFecha.fin} onChange={e => setDashFiltroFecha({...dashFiltroFecha, fin: e.target.value})} style={{padding: '0.4rem', fontSize: '0.8rem'}} />
                            {(dashFiltroFecha.inicio || dashFiltroFecha.fin) && (
                              <button onClick={() => setDashFiltroFecha({inicio: '', fin: ''})} className="btn-text" style={{padding: '0', marginLeft: '0.2rem', color: '#ef4444'}}>x</button>
                            )}
                          </div>
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.3rem'}}>
                          <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Producto:</span>
                          <select className="filter-select" value={dashFiltroProducto} onChange={e => setDashFiltroProducto(e.target.value)}>
                            {productosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.3rem'}}>
                          <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Repuesto Involucrado:</span>
                          <select className="filter-select" value={dashFiltroRepuesto} onChange={e => setDashFiltroRepuesto(e.target.value)}>
                            {repuestosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {dashModulo === 'grifo' && (
                      <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem'}}>
                        <p style={{color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.8rem'}}>Estaciones Analizadas (Afecta opciones de Producto y Repuesto):</p>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                          {estacionesPermitidas.map(est => (
                            <label key={est} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: dashFiltroEstaciones.includes(est) ? 'linear-gradient(to right, #1e3a8a, #2563eb)' : 'rgba(30,41,59,0.5)', padding: '0.4rem 1rem', borderRadius: '20px', border: dashFiltroEstaciones.includes(est) ? '1px solid #60a5fa' : '1px solid #334155', transition: 'all 0.3s', fontSize: '0.9rem', boxShadow: dashFiltroEstaciones.includes(est) ? '0 0 10px rgba(59,130,246,0.3)' : 'none'}}>
                              <input type="checkbox" checked={dashFiltroEstaciones.includes(est)} onChange={() => toggleEstacionFiltro(est)} style={{display: 'none'}} />
                              <span style={{color: dashFiltroEstaciones.includes(est) ? 'white' : '#cbd5e1'}}>{est}</span>
                            </label>
                          ))}
                        </div>
                        {dashModulo === 'grifo' && dashFiltroEstaciones.length > 0 && (
                          <button className="btn-text" style={{marginTop: '1rem', padding: '0', color: '#ef4444', fontSize: '0.85rem'}} onClick={() => setDashFiltroEstaciones([])}>Desmarcar todas (Mostrar {estacionesPermitidas.length})</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* KPIs Superiores */}
                  <div className="metrics-grid">
                    <div className="metric-card premium-card" style={{borderLeft: '4px solid #3b82f6'}}>
                      <h3 style={{color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Frecuencia (MTBF)</h3>
                      <div className="value" style={{color: '#60a5fa', fontSize: '2rem', fontWeight: 'bold'}}>{mtbf} <span style={{fontSize: '1rem'}}>días</span></div>
                      <span style={{fontSize: '0.8rem', color: '#cbd5e1'}}>Tiempo Medio Entre Fallas</span>
                    </div>
                    <div className="metric-card premium-card" style={{borderLeft: '4px solid #10b981'}}>
                      <h3 style={{color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Top Repuesto (Gasto)</h3>
                      <div className="value" style={{color: '#34d399', fontSize: '1.2rem', marginTop: '0.5rem', fontWeight: 'bold'}}>{topRepuesto?.[0] || 'N/A'}</div>
                      <span style={{fontSize: '0.8rem', color: '#cbd5e1'}}>{topRepuesto?.[1] || 0} unidades consumidas</span>
                    </div>
                    <div className="metric-card premium-card" style={{borderLeft: '4px solid #ef4444'}}>
                      <h3 style={{color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>{dashModulo === 'unidades' ? 'Unidad Crítica' : 'Estación Crítica'}</h3>
                      <div className="value" style={{fontSize: '1.2rem', marginTop: '0.5rem', color: '#fca5a5', fontWeight: 'bold'}}>
                        {topRiesgo?.[0] || 'N/A'}
                      </div>
                      <span style={{fontSize: '0.8rem', color: '#cbd5e1'}}>{topRiesgo?.[1] || 0} reportes</span>
                    </div>
                    <div className="metric-card premium-card" style={{borderLeft: '4px solid #8b5cf6'}}>
                      <h3 style={{color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Proyección IA</h3>
                      <div className="value" style={{fontSize: '0.9rem', marginTop: '0.5rem', color: '#c4b5fd', whiteSpace: 'normal', overflow: 'visible', lineHeight: '1.4', fontWeight: 'bold'}}>
                        {predictionText}
                      </div>
                      <span style={{fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginTop: '0.5rem'}}>Regresión Lineal a 7 días</span>
                    </div>
                  </div>

                  {/* Grilla de Gráficos de Inteligencia de Negocios (BI) - Estilo Power BI */}
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem'}}>
                    
                    {/* Gráfico 1: Diagrama de Pareto (80/20) */}
                    <div className="premium-card">
                      <div style={{marginBottom: '1rem', textAlign: 'center'}}>
                        <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600'}}>Diagrama de Pareto (Motivos)</h3>
                        <p style={{margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem'}}>💡 Tip: Enfócate en las barras antes de que la línea roja cruce el 80%</p>
                      </div>
                      {paretoData.length > 0 ? (
                        <Chart 
                          type="bar"
                          data={{
                            labels: paretoData.map(p => p.motivo),
                            datasets: [
                              {
                                type: 'line',
                                label: '% Acum.',
                                data: paretoData.map(p => p.cumPercent),
                                borderColor: '#ef4444',
                                backgroundColor: '#ef4444',
                                borderWidth: 2,
                                yAxisID: 'y1',
                                datalabels: {
                                  display: true,
                                  formatter: (val) => Math.round(val) + '%',
                                  color: '#fca5a5',
                                  align: 'top',
                                  font: {size: 10}
                                }
                              },
                              {
                                type: 'bar',
                                label: 'Incidencias',
                                data: paretoData.map(p => p.count),
                                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                                borderRadius: 4,
                                yAxisID: 'y',
                                datalabels: { color: 'white', align: 'center', font: {size: 10} }
                              }
                            ]
                          }}
                          options={{ 
                            responsive: true,
                            plugins: { legend: { labels: { color: '#cbd5e1', font: {size: 10} } } },
                            scales: { 
                              y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: {font: {size: 10}} },
                              y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, max: 100, ticks: {font: {size: 10}} },
                              x: { ticks: { color: '#94a3b8', font: {size: 10} }, grid: { display: false } }
                            } 
                          }}
                        />
                      ) : <p style={{textAlign:'center', color:'#94a3b8'}}>Sin datos</p>}
                    </div>

                    {/* Gráfico 2: Matriz Repuestos vs Producto */}
                    <div className="premium-card">
                      <div style={{marginBottom: '1rem', textAlign: 'center'}}>
                        <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600'}}>Top 5 Repuestos vs Producto</h3>
                        <p style={{margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem'}}>💡 Tip: Cruza la pieza que más gasta dinero con el tipo de máquina que la rompe</p>
                      </div>
                      {top5RepuestosList.length > 0 ? (
                        <Bar 
                          data={{
                            labels: top5RepuestosList.map(r => r),
                            datasets: repMatrixDatasets
                          }}
                          options={{ 
                            indexAxis: 'y',
                            responsive: true,
                            plugins: { 
                              legend: { position: 'bottom', labels: {color: '#cbd5e1', font: {size: 10}, boxWidth: 12} }, 
                              datalabels: { 
                                display: (context) => context.dataset.data[context.dataIndex] > 0,
                                color: 'white', 
                                align: 'center',
                                font: {size: 10} 
                              } 
                            },
                            scales: { 
                              x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: {font: {size: 10}} },
                              y: { stacked: true, grid: { display: false }, ticks: {font: {size: 10, color: '#cbd5e1'}} }
                            }
                          }}
                        />
                      ) : <p style={{textAlign:'center', color:'#94a3b8'}}>No hay consumo de repuestos registrado</p>}
                    </div>

                    {/* Gráfico 3: Tendencia en el Tiempo (Line Chart) */}
                    <div className="premium-card">
                      <div style={{marginBottom: '1rem', textAlign: 'center'}}>
                        <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600'}}>Tendencia en el Tiempo</h3>
                        <p style={{margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem'}}>💡 Tip: Identifica picos o valles de incidencias en las fechas seleccionadas</p>
                      </div>
                      {sortedFechas.length > 0 ? (
                        <Line 
                          data={{
                            labels: extendedLabels,
                            datasets: [
                              {
                                label: 'Incidencias Diarias',
                                data: realData,
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: '#10b981',
                                pointBorderColor: '#fff',
                                pointRadius: 4,
                              },
                              {
                                label: 'Proyección (Regresión Lineal)',
                                data: regressionLine,
                                borderColor: '#8b5cf6',
                                backgroundColor: 'transparent',
                                borderDash: [5, 5],
                                fill: false,
                                tension: 0,
                                pointRadius: 0,
                                pointHitRadius: 10
                              }
                            ]
                          }}
                          options={{ 
                            responsive: true,
                            plugins: { legend: { position: 'bottom', labels: {color: '#cbd5e1', font: {size: 10}, boxWidth: 12} }, datalabels: { display: false } },
                            scales: { 
                              y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, ticks: {font: {size: 10}} },
                              x: { grid: { display: false }, ticks: {font: {size: 10, color: '#cbd5e1'}} }
                            }
                          }}
                        />
                      ) : <p style={{textAlign:'center', color:'#94a3b8'}}>Sin datos en este rango</p>}
                    </div>

                    {/* Gráfico 4: Stacked Bar (Estaciones vs Producto) */}
                    <div className="premium-card">
                      <div style={{marginBottom: '1rem', textAlign: 'center'}}>
                        <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600'}}>{chartTitle4}</h3>
                        <p style={{margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem'}}>{chartTip4}</p>
                      </div>
                      {stackedDatasets.length > 0 ? (
                        <Bar 
                          data={{
                            labels: drillDownAxis,
                            datasets: stackedDatasets
                          }}
                          options={{ 
                            responsive: true,
                            plugins: { 
                              legend: { position: 'bottom', labels: {color: '#cbd5e1', font: {size: 10}, boxWidth: 12} }, 
                              datalabels: { 
                                display: (context) => context.dataset.data[context.dataIndex] > 0, 
                                color: 'white', 
                                font: {size: 10} 
                              } 
                            },
                            scales: {
                              x: { stacked: true, grid: { display: false }, ticks: {font: {size: 10, color: '#cbd5e1'}} },
                              y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: {font: {size: 10}} }
                            }
                          }}
                        />
                      ) : <p style={{textAlign:'center', color:'#94a3b8', marginTop: '3rem'}}>Sin datos para perfilar.</p>}
                    </div>

                  </div>

                  {/* Motor de Narrativa Ejecutiva (Data Storytelling) */}
                  <div className="premium-card" style={{marginTop: '1rem', borderLeft: '4px solid #10b981'}}>
                    <h3 style={{margin: '0 0 1rem 0', color: '#60a5fa', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span>🧠</span> Resumen Ejecutivo Automático (IA)
                    </h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.8rem', color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.5'}}>
                      {narrativa1 && <div style={{background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>{narrativa1}</div>}
                      {narrativa2 && <div style={{background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>{narrativa2}</div>}
                      {narrativa3 && <div style={{background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>{narrativa3}</div>}
                    </div>
                  </div>
                </div>
              )
            })()
          )}

          {tab === 'soluciones' && (
            <div className="table-container">
              <h3 className="mb-4">Visor de Soluciones y Evidencias</h3>

              {(() => {
                const pendientes = reportes
                  .filter(r => (r.estado || 'Pendiente') !== 'Resuelto')
                  .map(r => ({ ...r, dias: diasTranscurridos(r.creado_en, null) }))
                  .sort((a, b) => b.dias - a.dias)
                if (pendientes.length === 0) return null
                return (
                  <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem'}}>
                    <p style={{color: '#ef4444', fontWeight: 'bold', marginBottom: '0.75rem'}}>⚠️ {pendientes.length} reporte(s) sin resolver — dale prioridad a los más antiguos:</p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                      {pendientes.slice(0, 5).map(r => (
                        <div key={r.id} onClick={() => setReporteModal(r)} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', cursor: 'pointer', gap: '0.5rem', flexWrap: 'wrap'}}>
                          <span style={{fontSize: '0.85rem', color: '#e2e8f0'}}><strong>{r.motivo}</strong> · {r.tracto_placa || r.carreta_placa ? `${r.tracto_placa || ''} ${r.carreta_placa || ''}`.trim() : r.estacion_id}</span>
                          <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: colorDeEstado(r.estado), background: colorDeEstado(r.estado) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px', whiteSpace: 'nowrap'}}>
                            {r.estado || 'Pendiente'} · {r.dias} día(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Filtro de Módulo y Estaciones */}
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                <button className={visorModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVisorModulo('grifo')} style={{flex: 1}}>
                  Soluciones Grifos
                </button>
                <button className={visorModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVisorModulo('unidades')} style={{flex: 1}}>
                  Soluciones Unidades
                </button>
              </div>
              
              {visorModulo === 'grifo' && estacionesPermitidas.length > 1 && (
                <div style={{background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
                  <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Filtrar por Estación:</p>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                    {estacionesPermitidas.map(est => (
                      <label key={est} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: dashFiltroEstaciones.includes(est) ? '#1e3a8a' : '#1e293b', padding: '0.4rem 0.8rem', borderRadius: '15px', border: dashFiltroEstaciones.includes(est) ? '1px solid #3b82f6' : '1px solid transparent', transition: 'all 0.2s', fontSize: '0.85rem'}}>
                        <input type="checkbox" checked={dashFiltroEstaciones.includes(est)} onChange={() => toggleEstacionFiltro(est)} style={{display: 'none'}} />
                        <span style={{color: dashFiltroEstaciones.includes(est) ? 'white' : '#cbd5e1'}}>{est}</span>
                      </label>
                    ))}
                  </div>
                  {dashFiltroEstaciones.length > 0 && (
                    <button className="btn-text" style={{marginTop: '0.5rem', padding: '0', fontSize: '0.8rem'}} onClick={() => setDashFiltroEstaciones([])}>Desmarcar todas (Mostrar {estacionesPermitidas.length})</button>
                  )}
                </div>
              )}

              {visorModulo === 'unidades' && (
                <div style={{background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem'}}>
                  <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Buscar por placa (Tracto o Carreta):</p>
                  <input
                    type="text"
                    value={visorBusquedaPlaca}
                    onChange={e => setVisorBusquedaPlaca(e.target.value)}
                    placeholder="Ej: ABC-123"
                    style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}
                  />
                </div>
              )}

              {(() => {
                const activeStationsVisor = dashFiltroEstaciones.length > 0 ? dashFiltroEstaciones : estacionesPermitidas
                const reportesVisorFiltrados = reportes.filter(r => {
                  if (visorModulo === 'unidades') {
                    if (r.modulo !== 'unidades') return false
                    const q = visorBusquedaPlaca.trim().toUpperCase()
                    if (q === '') return true
                    return (r.tracto_placa || '').toUpperCase().includes(q) || (r.carreta_placa || '').toUpperCase().includes(q)
                  }
                  return r.modulo !== 'unidades' && activeStationsVisor.includes(r.estacion_id)
                })
                
                if (reportesVisorFiltrados.length === 0) {
                  return <p className="text-muted">No hay soluciones ni reportes registrados aún en las estaciones seleccionadas.</p>
                }
                
                return (
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem'}}>
                    {reportesVisorFiltrados.map(r => (
                    <div key={r.id} onClick={() => setReporteModal(r)} style={{background: '#0f172a', padding: '1.25rem', borderRadius: '8px', border: '1px solid #3b82f6', cursor: 'pointer', transition: 'transform 0.2s'}} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                        <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.1rem'}}>{r.motivo}</span>
                        <span style={{fontSize: '0.7rem', fontWeight: 'bold', color: colorDeEstado(r.estado), background: colorDeEstado(r.estado) + '22', padding: '0.15rem 0.6rem', borderRadius: '999px'}}>{r.estado || 'Pendiente'}</span>
                      </div>
                      <p style={{fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem'}}>{r.creado_en ? new Date(r.creado_en + (r.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</p>
                      {r.modulo === 'unidades' || r.estacion_id === 'UNIDADES' ? (
                        <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: '#cbd5e1'}}>
                          {r.tracto_placa && <span style={{marginRight: '0.5rem'}}><strong>Tracto:</strong> {r.tracto_placa}</span>}
                          {r.carreta_placa && <span><strong>Carreta:</strong> {r.carreta_placa}</span>}
                        </p>
                      ) : (
                        <p style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: '#cbd5e1'}}><strong>Estación:</strong> {r.estacion_id} <br/><strong>Equipo:</strong> {displayIslaLado(r.isla_lado)} | <strong>Prod:</strong> {r.producto}</p>
                      )}
                      <p style={{color: '#e2e8f0', marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.descripcion ? r.descripcion.replace(/\[📦 Repuesto utilizado: (.*?) x(\d+)\]$/, '').trim() : ''}</p>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                        <p style={{fontSize: '0.8rem', color: '#64748b', margin: 0}}>📸 {r.fotos && r.fotos !== 'Sin foto' ? r.fotos.split(',').length : 0} foto(s)</p>
                        <p style={{fontSize: '0.85rem', color: '#10b981', margin: 0}}>Audit: <strong>{r.creado_por}</strong></p>
                      </div>
                    </div>
                  ))}
                </div>
                )
              })()}
            </div>
          )}

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
                  }}
                />

                {(user.permiso_editar_reportes) && (
                  <div style={{marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem'}}>
                    <button className="btn-secondary" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={async () => {
                      if (window.confirm('¿Seguro que deseas eliminar este reporte permanentemente?')) {
                        const { error } = await supabase.from('reportes').delete().eq('id', reporteModal.id)
                        if (!error) {
                          setReportes(reportes.filter(r => r.id !== reporteModal.id))
                          setReporteModal(null)
                          showAlert('Éxito', 'Reporte eliminado.')
                        } else {
                          showAlert('Error', error.message)
                        }
                      }
                    }}>🗑️ Eliminar</button>
                    <button className="btn-primary" onClick={() => {
                      if (onEditReport) {
                        onEditReport(reporteModal)
                      }
                    }}>✏️ Editar</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'usuarios' && (
            <div className="table-container">
              {editingUser ? (
                <div className="edit-user-form" style={{padding: '1.5rem', background: '#0f172a', borderRadius: '12px', border: '1px dashed #3b82f6'}}>
                  <h3 className="mb-4">Editando Usuario: <span className="text-accent">{editingUser.nombre}</span></h3>
                  <form onSubmit={handleSaveUserPermissions}>
                    
                    <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
                      <div style={{flex: 1}}>
                        <label className="text-muted" style={{display: 'block', marginBottom: '0.5rem'}}>Rol de Sistema</label>
                        <select value={editingUser.rol} onChange={e => setEditingUser({...editingUser, rol: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}>
                          <option>Operario</option>
                          <option>Gerencia</option>
                          <option>Admin Estación</option>
                        </select>
                      </div>
                      <div style={{flex: 2}}>
                        <label className="text-muted" style={{display: 'block', marginBottom: '0.5rem'}}>Estaciones Asignadas (Alcance)</label>
                        <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                          {estaciones.map(est => {
                            const userEstsUpper = editingUser.estaciones === 'Todas' ? ['TODAS'] : editingUser.estaciones.split(',').map(s=>s.trim().toUpperCase())
                            const isChecked = userEstsUpper.includes('TODAS') || userEstsUpper.includes(est.nombre.toUpperCase())
                            
                            return (
                              <label key={est.id} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: '#1e293b', borderRadius: '4px', border: '1px solid #334155'}}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={e => {
                                    let actualesUpper = editingUser.estaciones === 'Todas' ? estaciones.map(e => e.nombre.toUpperCase()) : editingUser.estaciones.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean)
                                    let actualesOrig = editingUser.estaciones === 'Todas' ? estaciones.map(e => e.nombre) : editingUser.estaciones.split(',').map(s=>s.trim()).filter(Boolean)
                                    
                                    if (e.target.checked) {
                                      if (!actualesUpper.includes(est.nombre.toUpperCase())) actualesOrig.push(est.nombre)
                                    } else {
                                      actualesOrig = actualesOrig.filter(name => name.toUpperCase() !== est.nombre.toUpperCase())
                                    }
                                    const finalString = actualesOrig.length === estaciones.length ? 'Todas' : actualesOrig.join(', ')
                                    setEditingUser({...editingUser, estaciones: finalString})
                                  }} 
                                />
                                {est.nombre}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <h4 className="mb-2 text-muted">Módulos Permitidos (ABAC)</h4>
                    <div className="checkbox-group" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px'}}>
                        <input type="checkbox" checked={editingUser.permiso_config} onChange={e => setEditingUser({...editingUser, permiso_config: e.target.checked})} style={{width: 'auto'}} />
                        Acceso a Configuración del Sistema
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px'}}>
                        <input type="checkbox" checked={editingUser.permiso_inventario} onChange={e => setEditingUser({...editingUser, permiso_inventario: e.target.checked})} style={{width: 'auto'}} />
                        Gestionar Inventario y Productos
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px'}}>
                        <input type="checkbox" checked={editingUser.permiso_dashboard} onChange={e => setEditingUser({...editingUser, permiso_dashboard: e.target.checked})} style={{width: 'auto'}} />
                        Ver Dashboard de Métricas
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px'}}>
                        <input type="checkbox" checked={editingUser.permiso_soluciones} onChange={e => setEditingUser({...editingUser, permiso_soluciones: e.target.checked})} style={{width: 'auto'}} />
                        Ver Visor de Soluciones
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #10b981'}}>
                        <input type="checkbox" checked={editingUser.permiso_grifos !== false} onChange={e => setEditingUser({...editingUser, permiso_grifos: e.target.checked})} style={{width: 'auto'}} />
                        Acceso a Sistema Grifos
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #f59e0b'}}>
                        <input type="checkbox" checked={editingUser.permiso_unidades === true} onChange={e => setEditingUser({...editingUser, permiso_unidades: e.target.checked})} style={{width: 'auto'}} />
                        Acceso a Sistema Unidades
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#1e293b', borderRadius: '8px', gridColumn: '1 / -1', border: '1px solid #ef4444'}}>
                        <input type="checkbox" checked={editingUser.permiso_editar_reportes} onChange={e => setEditingUser({...editingUser, permiso_editar_reportes: e.target.checked})} />
                        <span style={{color: '#ef4444', fontWeight: 'bold'}}>Permitir Editar/Eliminar Reportes</span>
                      </label>
                    </div>
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'}}>
                      <div style={{display: 'flex', gap: '1rem'}}>
                        <button type="submit" className="btn-primary" style={{width: 'auto'}}>Guardar Cambios</button>
                        <button type="button" className="btn-secondary" style={{width: 'auto'}} onClick={() => setEditingUser(null)}>Cancelar</button>
                      </div>
                      <button type="button" className="btn-text" style={{color: '#ef4444', border: '1px solid #ef4444', padding: '0.5rem 1rem'}} onClick={() => handleDeleteUser(editingUser.id)}>🗑️ Eliminar Usuario</button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div style={{marginBottom: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}}>
                    <h3 style={{marginBottom: '1rem'}}>Crear Nuevo Usuario</h3>
                    <form onSubmit={handleCreateUser} style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                      <input type="text" placeholder="Nombre (ej: LUIS)" value={nuevoUsuario.nombre} onChange={e=>setNuevoUsuario({...nuevoUsuario, nombre: e.target.value.toUpperCase()})} required style={{flex: 1, minWidth: '150px'}} />
                      <input type="password" placeholder="Contraseña" value={nuevoUsuario.password} onChange={e=>setNuevoUsuario({...nuevoUsuario, password: e.target.value})} required style={{flex: 1, minWidth: '150px'}} />
                      <select value={nuevoUsuario.rol} onChange={e=>setNuevoUsuario({...nuevoUsuario, rol: e.target.value})} style={{flex: 1, minWidth: '150px'}}>
                        <option>Operario</option>
                        <option>Gerencia</option>
                        <option>Admin Estación</option>
                      </select>
                      <button type="submit" className="btn-primary" style={{width: 'auto'}}>+ Crear</button>
                    </form>
                  </div>

                  <h3>Registro de Usuarios</h3>
                  <div style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%'}}>
                    <table style={{marginTop: '1rem', minWidth: '600px'}}>
                      <thead>
                        <tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Privilegios (Módulos)</th><th>Acción</th></tr>
                      </thead>
                      <tbody>
                        {usuarios.length === 0 && <tr><td colSpan="5">Cargando usuarios...</td></tr>}
                        {usuarios.map(u => (
                          <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>{u.nombre}</td>
                            <td>{u.rol}</td>
                            <td style={{fontSize: '0.8rem', color: '#94a3b8'}}>
                              {[u.permiso_dashboard && 'Dashboard', u.permiso_inventario && 'Inventario', u.permiso_soluciones && 'Soluciones', u.permiso_config && 'Config'].filter(Boolean).join(', ') || 'Ninguno'}
                            </td>
                            <td><button className="btn-text" style={{color: '#3b82f6'}} onClick={() => setEditingUser(u)}>Configurar Permisos</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'inventario' && (
            <div className="table-container">
              
              <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                <button className={invModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setInvModulo('grifo')} style={{flex: 1}}>
                  Inventario de Grifos
                </button>
                <button className={invModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setInvModulo('unidades')} style={{flex: 1}}>
                  Inventario de Unidades
                </button>
              </div>

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem'}}>
                <h3 style={{margin: 0}}>Inventario y Productos</h3>
                {invModulo !== 'unidades' && (() => {
                   const estacionesArray = user.estaciones === 'Todas' ? estaciones.map(e => e.nombre) : user.estaciones.split(',').map(s=>s.trim()).filter(Boolean)
                   const opciones = Array.from(new Set(estacionesArray.map(e => e.toUpperCase())))
                   if (opciones.length <= 1) {
                     return <h4 style={{color: '#3b82f6', margin: 0}}>Contexto: {selectedInvEstacion}</h4>
                   }
                   return (
                     <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                       <span style={{color: '#94a3b8'}}>Seleccionar Estación:</span>
                       <select value={selectedInvEstacion} onChange={e => setSelectedInvEstacion(e.target.value)} style={{padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #3b82f6', minWidth: '200px'}}>
                         {opciones.map(op => <option key={op} value={op}>{op}</option>)}
                       </select>
                     </div>
                   )
                })()}
              </div>

              <div style={{background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}}>
                <h4 style={{marginBottom: '1rem'}}>Añadir Ítem a {selectedInvEstacion}</h4>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const nombreItem = e.target.itemNombre.value.toUpperCase()
                  const stock = parseInt(e.target.itemStock.value)
                  if(!nombreItem || isNaN(stock)) return showAlert('Aviso', 'Complete los datos correctamente.')
                  
                  const { error, data: newInv } = await supabase.from('inventario').insert([{
                    modulo: invModulo,
                    estacion: invModulo === 'unidades' ? 'UNIDADES' : selectedInvEstacion,
                    nombre: nombreItem,
                    stock: stock,
                    creado_por: user.nombre
                  }]).select()
                  
                  if (error) showAlert('Error', 'No se pudo guardar en inventario: ' + error.message)
                  else {
                    if (newInv && newInv.length > 0) {
                      await supabase.from('inventario_movimientos').insert([{
                        inventario_id: newInv[0].id,
                        tipo: 'INGRESO',
                        cantidad: stock,
                        motivo: 'Inventario Inicial',
                        creado_por: user.nombre
                      }])
                      const { data: fetchMovs } = await supabase.from('inventario_movimientos').select('*').order('creado_en', { ascending: false })
                      if (fetchMovs) setMovimientos(fetchMovs)
                    }
                    e.target.reset()
                    showAlert('Éxito', 'Ítem agregado correctamente.')
                  }
                }} style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                  <input name="itemNombre" type="text" placeholder="Nombre del Producto / Repuesto" required style={{flex: 2, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155', minWidth: '200px'}} />
                  <input name="itemStock" type="number" placeholder="Cantidad / Stock" required min="0" style={{flex: 1, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155', minWidth: '100px'}} />
                  <button type="submit" className="btn-primary" style={{width: 'auto'}}>+ Añadir</button>
                </form>
              </div>

              <div style={{overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%'}}>
                <table style={{marginTop: '2rem', minWidth: '600px'}}>
                  <thead>
                    <tr><th>Producto / Ítem</th><th>Stock Actual</th><th>Pronóstico IA (30 días)</th><th>Acción</th></tr>
                  </thead>
                  <tbody>
                    {inventario.filter(inv => inv.modulo === invModulo && (invModulo === 'unidades' || (inv.estacion && inv.estacion.toUpperCase() === selectedInvEstacion))).length === 0 ? (
                      <tr><td colSpan="4" className="text-center text-muted">No hay ítems registrados en este inventario.</td></tr>
                    ) : (
                      inventario.filter(inv => inv.modulo === invModulo && (invModulo === 'unidades' || (inv.estacion && inv.estacion.toUpperCase() === selectedInvEstacion))).map(inv => {
                        // Calcular Pronóstico IA
                        const reportesFiltrados = invModulo === 'unidades' 
                          ? reportes.filter(r => r.modulo === 'unidades')
                          : reportes.filter(r => r.estacion_id && inv.estacion && r.estacion_id.toUpperCase() === inv.estacion.toUpperCase());
                          
                        const consumoTotal = reportesFiltrados.reduce((sum, r) => {
                          const found = getRepuestosFromDesc(r.descripcion).find(rep => rep.nombre.toUpperCase() === inv.nombre.toUpperCase());
                          return sum + (found ? found.cantidad : 0);
                        }, 0);
                        
                        const fechas = reportesFiltrados.map(r => new Date(r.creado_en)).filter(d => !isNaN(d));
                        let daysDiff = 30; // default si no hay suficiente data
                        if (fechas.length > 1) {
                          const minD = Math.min(...fechas);
                          const maxD = Math.max(...fechas);
                          daysDiff = Math.max(1, (maxD - minD) / (1000 * 60 * 60 * 24));
                        }
                        
                        const burnRateDiario = consumoTotal / daysDiff;
                        const pronostico30Dias = Math.ceil(burnRateDiario * 30);
                        
                        const alertaCompra = pronostico30Dias > inv.stock && pronostico30Dias > 0;

                        return (
                          <tr key={inv.id}>
                            <td>{inv.nombre}<br/><small style={{color: '#64748b', fontSize: '0.75rem'}}>Por: {inv.creado_por || 'Sistema'} {inv.creado_en && ` - ${new Date(inv.creado_en).toLocaleDateString()}`}</small></td>
                            <td style={{fontWeight: 'bold', color: inv.stock < 5 ? '#ef4444' : '#10b981'}}>{inv.stock}</td>
                            <td>
                              {pronostico30Dias > 0 ? (
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'}}>
                                  <span>~{pronostico30Dias} uds/mes</span>
                                  {alertaCompra && <span style={{background: '#ef4444', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', animation: 'pulse 2s infinite', whiteSpace: 'nowrap'}}>⚠️ Comprar {pronostico30Dias - inv.stock}</span>}
                                </div>
                              ) : (
                                <span style={{color: '#64748b'}}>Sin datos suficientes</span>
                              )}
                            </td>
                            <td style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                              <button className="btn-primary" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto'}} onClick={() => setKardexModal(inv)}>Movimientos</button>
                              {(user.permiso_editar_reportes || user.rol === 'Gerencia') && (
                                <button className="btn-text" style={{color: '#ef4444', padding: 0}} onClick={() => {
                                  showConfirm('Eliminar Ítem', `¿Estás seguro de eliminar ${inv.nombre}?`, async () => {
                                    const { error } = await supabase.from('inventario').delete().eq('id', inv.id)
                                    if (error) showAlert('Error', error.message)
                                  })
                                }}>Eliminar</button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Modal de Kardex */}
              {kardexModal && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem'}}>
                  <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                      <div>
                        <h3 style={{color: '#3b82f6', margin: 0}}>{kardexModal.nombre}</h3>
                        <p style={{margin: 0, color: '#94a3b8', fontSize: '0.9rem'}}>{kardexModal.estacion}</p>
                      </div>
                      <div style={{textAlign: 'right'}}>
                        <h2 style={{margin: 0, color: kardexModal.stock < 5 ? '#ef4444' : '#10b981'}}>{kardexModal.stock} <small style={{fontSize: '0.9rem', color: '#64748b'}}>en stock</small></h2>
                      </div>
                    </div>

                    <div style={{background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '2rem'}}>
                      <h4 style={{marginBottom: '1rem', color: '#cbd5e1'}}>Nuevo Movimiento (Ajuste)</h4>
                      <form onSubmit={async (e) => {
                        e.preventDefault()
                        const tipo = e.target.tipoMov.value
                        const cantidad = parseInt(e.target.cantMov.value)
                        const motivo = e.target.motivoMov.value
                        
                        if (tipo === 'SALIDA' && cantidad > kardexModal.stock) {
                          return showAlert('Error', 'No hay stock suficiente para esta salida.')
                        }
                        
                        const nuevoStock = tipo === 'INGRESO' ? kardexModal.stock + cantidad : kardexModal.stock - cantidad
                        
                        // 1. Actualizar stock
                        const { error: errInv } = await supabase.from('inventario').update({ stock: nuevoStock }).eq('id', kardexModal.id)
                        if (errInv) return showAlert('Error', errInv.message)
                        
                        // 2. Insertar movimiento
                        const { error: errMov } = await supabase.from('inventario_movimientos').insert([{
                          inventario_id: kardexModal.id,
                          tipo: tipo,
                          cantidad: cantidad,
                          motivo: motivo,
                          creado_por: user.nombre
                        }])
                        if (errMov) return showAlert('Error Insertando Movimiento', errMov.message)
                        
                        // 3. Recargar
                        const { data } = await supabase.from('inventario_movimientos').select('*').order('creado_en', { ascending: false })
                        if (data) setMovimientos(data)
                        
                        setKardexModal({...kardexModal, stock: nuevoStock})
                        e.target.reset()
                        showAlert('Éxito', 'Movimiento registrado.')
                      }} style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end'}}>
                        <div style={{flex: 1, minWidth: '100px'}}>
                          <label style={{fontSize: '0.8rem', color: '#94a3b8'}}>Tipo</label>
                          <select name="tipoMov" required style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid #334155'}}>
                            <option value="INGRESO">+ Ingreso (Compra)</option>
                            <option value="SALIDA">- Salida (Merma/Préstamo)</option>
                          </select>
                        </div>
                        <div style={{flex: 1, minWidth: '80px'}}>
                          <label style={{fontSize: '0.8rem', color: '#94a3b8'}}>Cant.</label>
                          <input type="number" name="cantMov" min="1" required style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid #334155'}} />
                        </div>
                        <div style={{flex: 2, minWidth: '150px'}}>
                          <label style={{fontSize: '0.8rem', color: '#94a3b8'}}>Motivo / Descripción</label>
                          <input type="text" name="motivoMov" required placeholder="Ej: Préstamo a estación X" style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid #334155'}} />
                        </div>
                        <button type="submit" className="btn-primary" style={{width: 'auto', padding: '0.5rem 1rem'}}>Guardar</button>
                      </form>
                    </div>

                    <h4 style={{marginBottom: '1rem', color: '#cbd5e1'}}>Historial de Movimientos</h4>
                    <table style={{fontSize: '0.85rem'}}>
                      <thead>
                        <tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Cant</th><th>Motivo</th></tr>
                      </thead>
                      <tbody>
                        {movimientos.filter(m => m.inventario_id === kardexModal.id).length === 0 ? (
                          <tr><td colSpan="5" className="text-center text-muted">No hay movimientos registrados.</td></tr>
                        ) : (
                          movimientos.filter(m => m.inventario_id === kardexModal.id).map(m => (
                            <tr key={m.id}>
                              <td style={{color: '#94a3b8'}}>{m.creado_en ? new Date(m.creado_en + (m.creado_en.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</td>
                              <td>{m.creado_por}</td>
                              <td style={{color: m.tipo === 'INGRESO' ? '#10b981' : '#ef4444', fontWeight: 'bold'}}>{m.tipo === 'INGRESO' ? '+' : '-'}{m.tipo}</td>
                              <td>{m.cantidad}</td>
                              <td>{m.motivo}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    
                    <button className="btn-secondary full-width mt-4" onClick={() => setKardexModal(null)}>Cerrar Historial</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'mantenimiento' && (
            <div className="table-container">
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                <button className={mantModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMantModulo('grifo')} style={{flex: 1}}>
                  Mantenimiento Grifos
                </button>
                <button className={mantModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMantModulo('unidades')} style={{flex: 1}}>
                  Mantenimiento Unidades
                </button>
              </div>
              <h3 className="mb-4">Catálogo Global de Tipos de Mantenimiento ({mantModulo.toUpperCase()})</h3>
              <p className="text-muted" style={{marginBottom: '2rem'}}>
                Estos son los tipos de mantenimiento (Ej: "CAMBIO DE PISTOLA") que estarán disponibles como opciones 
                estandarizadas al momento de registrar un evento para {mantModulo}.
              </p>
              
              <div style={{background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem'}}>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if(!nuevoMantenimiento.trim()) return showAlert('Aviso', 'Ingrese un nombre válido.')
                  const nombreUpper = nuevoMantenimiento.trim().toUpperCase()
                  const existe = mantenimientoTipos.find(mt => mt.nombre === nombreUpper)
                  if(existe) return showAlert('Aviso', 'Este tipo de mantenimiento ya existe.')
                  
                  const { error } = await supabase.from('mantenimiento_tipos').insert([{ nombre: nombreUpper, modulo: mantModulo }])
                  if (error) showAlert('Error', 'No se pudo guardar: ' + error.message)
                  else {
                    setNuevoMantenimiento('')
                    showAlert('Éxito', 'Tipo de mantenimiento agregado.')
                  }
                }} style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                  <input type="text" placeholder="Ej: CAMBIO DE PISTOLA" value={nuevoMantenimiento} onChange={e => setNuevoMantenimiento(e.target.value)} required style={{flex: 1, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155', minWidth: '200px'}} />
                  <button type="submit" className="btn-primary" style={{width: 'auto'}}>+ Añadir Tipo</button>
                </form>
              </div>

              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
                <thead>
                  <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}><th style={{padding: '1rem'}}>Tipo de Mantenimiento</th><th style={{padding: '1rem'}}>Acción</th></tr>
                </thead>
                <tbody>
                  {mantenimientoTipos.filter(mt => (mt.modulo || 'grifo') === mantModulo).length === 0 ? (
                    <tr><td colSpan="2" className="text-center text-muted" style={{padding: '1rem'}}>No hay tipos registrados.</td></tr>
                  ) : (
                    mantenimientoTipos.filter(mt => (mt.modulo || 'grifo') === mantModulo).map(mt => (
                      <tr key={mt.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                        <td style={{padding: '1rem'}}>{mt.nombre}</td>
                        <td style={{padding: '1rem'}}>
                          <button className="btn-text" style={{color: '#3b82f6', padding: '0', marginRight: '1rem'}} onClick={async () => {
                            const nuevoNombre = window.prompt('Editar nombre del tipo de mantenimiento:', mt.nombre)
                            if (nuevoNombre && nuevoNombre.trim() && nuevoNombre.trim().toUpperCase() !== mt.nombre) {
                              const { error } = await supabase.from('mantenimiento_tipos').update({ nombre: nuevoNombre.trim().toUpperCase() }).eq('id', mt.id)
                              if (error) showAlert('Error', error.message)
                              else {
                                const { data } = await supabase.from('mantenimiento_tipos').select('*').order('id')
                                if (data) setMantenimientoTipos(data)
                                showAlert('Éxito', 'Editado correctamente.')
                              }
                            }
                          }}>Editar</button>
                          
                          <button className="btn-text" style={{color: '#ef4444', padding: '0'}} onClick={async () => {
                            if(window.confirm(`¿Eliminar "${mt.nombre}" del catálogo global?`)){
                              const { error } = await supabase.from('mantenimiento_tipos').delete().eq('id', mt.id)
                              if (error) showAlert('Error', 'No se pudo eliminar: ' + error.message)
                              else setMantenimientoTipos(mantenimientoTipos.filter(x => x.id !== mt.id))
                            }
                          }}>Eliminar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'config' && (
            <div className="table-container" style={{marginTop: '2rem'}}>
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
                    <button className={configModulo === 'grifo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setConfigModulo('grifo')} style={{flex: 1}}>
                      Configuración Grifos
                    </button>
                    <button className={configModulo === 'unidades' ? 'btn-primary' : 'btn-secondary'} onClick={() => setConfigModulo('unidades')} style={{flex: 1}}>
                      Configuración Unidades
                    </button>
                  </div>

              {configModulo === 'grifo' && (
                <>
                  <h3 className="mb-4">Topología de Estaciones (Gestión Real)</h3>
                  
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
                    <button className="btn-primary" style={{width: 'auto'}} onClick={() => setEstacionModal({ isOpen: true, nombre: '', productosStr: '', productosList: [], cantidadIslas: 1 })}>+ Crear Estación Nueva</button>
                  </div>

                  {estaciones.length === 0 && <p className="text-muted">No hay estaciones. Crea una nueva.</p>}
                  
                  {estaciones.map(est => {
                    const ladosDeEstacion = islasLados.filter(il => il.estacion_id === est.id)
                    const arrayIslas = Array.from({length: est.cantidad_islas || 0}, (_, i) => i + 1)
                    const isExpanded = expandedEstaciones.includes(est.id)
                    
                    return (
                    <div key={est.id} style={{padding: '1.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', marginBottom: '1.5rem'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1rem' : '0'}}>
                        <div>
                          <h4 style={{fontSize: '1.1rem', color: '#3b82f6', marginBottom: '0.25rem'}}>{est.nombre}</h4>
                          <small style={{color: '#94a3b8'}}>Productos: {est.productos_disponibles ? est.productos_disponibles.replace(/,/g, ', ') : 'No definidos'}</small>
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                          <button className="btn-secondary" style={{padding: '0.5rem 1rem'}} onClick={() => handleAddIslaToEstacion(est)}>
                            + Añadir Isla
                          </button>
                          <button className="btn-secondary" style={{padding: '0.5rem 1rem'}} onClick={() => toggleEstacion(est.id)}>
                            {isExpanded ? 'Ocultar Lados ▲' : 'Mostrar Lados ▼'}
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <table style={{background: '#1e293b', borderRadius: '8px', width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '1rem'}}>
                          <thead>
                            <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                              <th style={{padding: '1rem'}}>Isla</th>
                              <th style={{padding: '1rem'}}>Lado</th>
                              <th style={{padding: '1rem'}}>Productos</th>
                              <th style={{padding: '1rem'}}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                              {arrayIslas.length === 0 ? (
                                <tr><td colSpan="4" className="text-center text-muted" style={{padding: '1rem'}}>No hay islas configuradas.</td></tr>
                              ) : (
                                arrayIslas.map(numIsla => {
                                  const ladosEstaIsla = ladosDeEstacion.filter(l => l.isla === numIsla)
                                  if (ladosEstaIsla.length === 0) {
                                    return (
                                      <tr key={`isla-${numIsla}-empty`} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                        <td style={{padding: '1rem', fontWeight: 'bold'}}>Isla {numIsla}</td>
                                        <td colSpan="2" style={{padding: '1rem'}} className="text-muted">Sin configurar</td>
                                        <td style={{padding: '1rem'}}><button className="btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => openIslaModal(est, numIsla)}>+ Añadir Lados</button></td>
                                      </tr>
                                    )
                                  }
                                  return ladosEstaIsla.map((il, idx) => (
                                    <tr key={il.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                      <td style={{padding: '1rem', fontWeight: 'bold', color: idx === 0 ? '#e2e8f0' : 'transparent'}}>{idx === 0 ? `Isla ${numIsla}` : ''}</td>
                                      <td style={{padding: '1rem'}}>Lado {il.lado}</td>
                                      <td style={{padding: '1rem'}}>{il.productos}</td>
                                      <td style={{padding: '1rem'}}>
                                        {idx === 0 && <button className="btn-text" style={{color: '#3b82f6', marginRight: '1rem', padding: 0}} onClick={() => openIslaModal(est, numIsla)}>+ Lado</button>}
                                        <button className="btn-text" style={{color: '#ef4444', padding: 0}} onClick={() => handleDisableIslaLado(il.id)}>Desactivar</button>
                                      </td>
                                    </tr>
                                  ))
                                })
                              )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )})}
                </>
              )}

              {configModulo === 'unidades' && (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                    <h3 style={{margin: 0}}>Gestión de Unidades (Tractos y Carretas)</h3>
                    <button className="btn-secondary" onClick={async () => {
                      const data = [
                        { TRACTOS: "CHH815", CARRETA: "ARP977", " Tipos de Mantenimiento": "CAMBIO DE LLANTAS", PRODUCTO: "FRENOS MARCA AG", "STOCK ": 6.0 },
                        { TRACTOS: "BUU917", CARRETA: "ANV974", " Tipos de Mantenimiento": "CAMBIO DE BOMBA DE AGUA ", PRODUCTO: "FRENOS MARCA BH", "STOCK ": 1.0 },
                        { TRACTOS: "BUG891", CARRETA: "D9W974", " Tipos de Mantenimiento": "CAMBIO DE SENSOR" },
                        { TRACTOS: "BXE724", CARRETA: "AKD971", " Tipos de Mantenimiento": "CAMBIO DE AROS" },
                        { TRACTOS: "CAS764", CARRETA: "KV9715", " Tipos de Mantenimiento": "REGULACION DE FRENOS" },
                        { TRACTOS: "BPO778", CARRETA: "APV982", " Tipos de Mantenimiento": "CAMBIO DE ZAPATAS" },
                        { TRACTOS: "BYU867", CARRETA: "BAT978", " Tipos de Mantenimiento": "CAMBIO DE RACHE" },
                        { TRACTOS: "BYU816", CARRETA: "AYO996", " Tipos de Mantenimiento": "CAMBIO DE PULPO" },
                        { TRACTOS: "CEQ728", CARRETA: "AMU984" },
                        { TRACTOS: "CDM871", CARRETA: "AER998" },
                        { TRACTOS: "BPA731", CARRETA: "BCX979" },
                        { TRACTOS: "BWP872", CARRETA: "F6O982" },
                        { TRACTOS: "BKD719", CARRETA: "BFO985" },
                        { CARRETA: "BJE977" },
                        { CARRETA: "BWI983" }
                      ]
                      for (let d of data) {
                        if (d.TRACTOS) await supabase.from('unidades_tractos').insert([{ placa: d.TRACTOS }])
                        if (d.CARRETA) await supabase.from('unidades_carretas').insert([{ placa: d.CARRETA }])
                        if (d[' Tipos de Mantenimiento']) await supabase.from('mantenimiento_tipos').insert([{ nombre: d[' Tipos de Mantenimiento'], modulo: 'unidades' }])
                        if (d.PRODUCTO) await supabase.from('inventario').insert([{ modulo: 'unidades', estacion: 'UNIDADES', nombre: d.PRODUCTO, stock: d['STOCK '] || 0, creado_por: 'Admin' }])
                      }
                      
                      const tData = await supabase.from('unidades_tractos').select('*').order('placa')
                      setUnidadesTractos(tData.data || [])
                      const cData = await supabase.from('unidades_carretas').select('*').order('placa')
                      setUnidadesCarretas(cData.data || [])
                      const mtData = await supabase.from('mantenimiento_tipos').select('*').order('nombre')
                      setMantenimientoTipos(mtData.data || [])
                      
                      showAlert('Éxito', 'Datos de Excel Importados. Recargue la página para ver los cambios.')
                    }}>Importar Datos del Excel</button>
                  </div>
                  
                  <div className="grid-2">
                    <div style={{background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                        <h4 style={{color: '#3b82f6', margin: 0}}>Tractos</h4>
                        <button className="btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.8rem'}} onClick={() => setIsTractosExpanded(!isTractosExpanded)}>
                          {isTractosExpanded ? 'Ocultar ▲' : 'Mostrar ▼'}
                        </button>
                      </div>
                      
                      {isTractosExpanded && (
                        <>
                          <form onSubmit={async (e) => {
                            e.preventDefault()
                            if(!nuevoTracto.trim()) return showAlert('Aviso', 'Ingrese una placa válida.')
                            const placaUpper = nuevoTracto.trim().toUpperCase()
                            const existe = unidadesTractos.find(t => t.placa === placaUpper)
                            if(existe) return showAlert('Aviso', 'Este tracto ya existe.')
                            
                            const { error } = await supabase.from('unidades_tractos').insert([{ placa: placaUpper }])
                            if (error) showAlert('Error', 'No se pudo guardar: ' + error.message)
                            else {
                              setNuevoTracto('')
                              const { data } = await supabase.from('unidades_tractos').select('*').order('placa')
                              setUnidadesTractos(data)
                              showAlert('Éxito', 'Tracto agregado.')
                            }
                          }} style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                            <input type="text" placeholder="Placa Tracto" value={nuevoTracto} onChange={e => setNuevoTracto(e.target.value)} required style={{flex: 1, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} />
                            <button type="submit" className="btn-primary" style={{width: 'auto', padding: '0.5rem 1rem'}}>+</button>
                          </form>
                          
                          <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                              <tbody>
                                {unidadesTractos.length === 0 ? (
                                  <tr><td className="text-muted text-center" style={{padding: '1rem'}}>Sin tractos</td></tr>
                                ) : (
                                  unidadesTractos.map(t => (
                                    <tr key={t.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                      <td style={{padding: '0.75rem'}}>{t.placa}</td>
                                      <td style={{padding: '0.75rem', textAlign: 'right'}}>
                                        <button className="btn-text" style={{color: '#ef4444', padding: 0}} onClick={async () => {
                                          if(window.confirm(`¿Eliminar tracto ${t.placa}?`)){
                                            const { error } = await supabase.from('unidades_tractos').delete().eq('id', t.id)
                                            if(error) showAlert('Error', error.message)
                                            else setUnidadesTractos(unidadesTractos.filter(x => x.id !== t.id))
                                          }
                                        }}>Eliminar</button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>

                <div style={{background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h4 style={{color: '#3b82f6', margin: 0}}>Carretas</h4>
                    <button className="btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.8rem'}} onClick={() => setIsCarretasExpanded(!isCarretasExpanded)}>
                      {isCarretasExpanded ? 'Ocultar ▲' : 'Mostrar ▼'}
                    </button>
                  </div>

                  {isCarretasExpanded && (
                    <>
                      <form onSubmit={async (e) => {
                        e.preventDefault()
                        if(!nuevaCarreta.trim()) return showAlert('Aviso', 'Ingrese una placa válida.')
                        const placaUpper = nuevaCarreta.trim().toUpperCase()
                        const existe = unidadesCarretas.find(c => c.placa === placaUpper)
                        if(existe) return showAlert('Aviso', 'Esta carreta ya existe.')
                        
                        const { error } = await supabase.from('unidades_carretas').insert([{ placa: placaUpper }])
                        if (error) showAlert('Error', 'No se pudo guardar: ' + error.message)
                        else {
                          setNuevaCarreta('')
                          const { data } = await supabase.from('unidades_carretas').select('*').order('placa')
                          setUnidadesCarretas(data)
                          showAlert('Éxito', 'Carreta agregada.')
                        }
                      }} style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                        <input type="text" placeholder="Placa Carreta" value={nuevaCarreta} onChange={e => setNuevaCarreta(e.target.value)} required style={{flex: 1, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} />
                        <button type="submit" className="btn-primary" style={{width: 'auto', padding: '0.5rem 1rem'}}>+</button>
                      </form>
                      
                      <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                          <tbody>
                            {unidadesCarretas.length === 0 ? (
                              <tr><td className="text-muted text-center" style={{padding: '1rem'}}>Sin carretas</td></tr>
                            ) : (
                              unidadesCarretas.map(c => (
                                <tr key={c.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                  <td style={{padding: '0.75rem'}}>{c.placa}</td>
                                  <td style={{padding: '0.75rem', textAlign: 'right'}}>
                                    <button className="btn-text" style={{color: '#ef4444', padding: 0}} onClick={async () => {
                                      if(window.confirm(`¿Eliminar carreta ${c.placa}?`)){
                                        const { error } = await supabase.from('unidades_carretas').delete().eq('id', c.id)
                                        if(error) showAlert('Error', error.message)
                                        else setUnidadesCarretas(unidadesCarretas.filter(x => x.id !== c.id))
                                      }
                                    }}>Eliminar</button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
            </div>
          )}

        </div>

          {estacionModal.isOpen && (
            <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
              <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', minWidth: '400px'}}>
                <h3 className="mb-4">Crear Estación Nueva</h3>
                <form onSubmit={handleSaveEstacionModal}>
                  <div className="mb-4">
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Nombre de la Estación</label>
                    <input type="text" required value={estacionModal.nombre} onChange={e => setEstacionModal({...estacionModal, nombre: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} placeholder="Ej: Estación Curve" />
                  </div>
                  
                  <div className="mb-4">
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Productos que dispensa (Ingresa uno por uno)</label>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <input type="text" value={estacionModal.productosStr} onChange={e => setEstacionModal({...estacionModal, productosStr: e.target.value})} onKeyDown={e => {if (e.key === 'Enter') handleAddProductoToEstacion(e)}} style={{flex: 1, padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} placeholder="Ej: GR" />
                      <button type="button" className="btn-secondary" onClick={handleAddProductoToEstacion}>Añadir</button>
                    </div>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem'}}>
                      {estacionModal.productosList.map(prod => (
                        <span key={prod} style={{background: '#3b82f6', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          {prod}
                          <button type="button" onClick={() => setEstacionModal({...estacionModal, productosList: estacionModal.productosList.filter(p=>p!==prod)})} style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontWeight: 'bold'}}>×</button>
                        </span>
                      ))}
                      {estacionModal.productosList.length === 0 && <small className="text-muted">No has añadido productos aún.</small>}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Cantidad de Islas</label>
                    <input type="number" required min="1" value={estacionModal.cantidadIslas} onChange={e => setEstacionModal({...estacionModal, cantidadIslas: parseInt(e.target.value)})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} placeholder="Ej: 4" />
                  </div>

                  <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                    <button type="submit" className="btn-primary" style={{flex: 1}}>Crear Estación</button>
                    <button type="button" className="btn-secondary" style={{flex: 1}} onClick={() => setEstacionModal({ isOpen: false, nombre: '', productosStr: '', productosList: [], cantidadIslas: 1 })}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {islaModal.isOpen && islaModal.estacion && (
            <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
              <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', minWidth: '400px'}}>
                <h3 className="mb-4">Configurar Isla {islaModal.isla} - {islaModal.estacion.nombre}</h3>
                <form onSubmit={handleSaveIslaModal}>
                  <div className="mb-4" style={{display: 'none'}}>
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Número de Isla</label>
                    <input type="number" required min="1" value={islaModal.isla} onChange={e => setIslaModal({...islaModal, isla: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} readOnly />
                  </div>
                  
                  <div className="mb-4">
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Lados a Configurar (Separados por coma)</label>
                    <input type="text" required value={islaModal.ladosStr} onChange={e => setIslaModal({...islaModal, ladosStr: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', color: 'white', border: '1px solid #334155'}} placeholder="Ej: 1, 2" />
                    <small style={{color: '#64748b', display: 'block', marginTop: '0.25rem'}}>Puedes ingresar múltiples lados a la vez si comparten los mismos productos.</small>
                  </div>

                  <div className="mb-4">
                    <label style={{display: 'block', marginBottom: '0.5rem', color: '#94a3b8'}}>Productos (Del inventario de la estación)</label>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                      {(islaModal.estacion.productos_disponibles ? islaModal.estacion.productos_disponibles.split(',') : []).map(prod => (
                        <label key={prod} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', cursor: 'pointer'}}>
                          <input type="checkbox" checked={islaModal.productos.includes(prod)} onChange={e => {
                            if (e.target.checked) setIslaModal({...islaModal, productos: [...islaModal.productos, prod]})
                            else setIslaModal({...islaModal, productos: islaModal.productos.filter(p=>p!==prod)})
                          }} /> {prod}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                    <button type="submit" className="btn-primary" style={{flex: 1}}>Guardar Configuración</button>
                    <button type="button" className="btn-secondary" style={{flex: 1}} onClick={() => setIslaModal({...islaModal, isOpen: false})}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {appModal.isOpen && (
            <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999}}>
              <div style={{background: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', minWidth: '350px', maxWidth: '500px', textAlign: 'center'}}>
                <h3 style={{marginBottom: '1rem', color: appModal.type === 'alert' && appModal.title === 'Error' ? '#ef4444' : '#3b82f6'}}>{appModal.title}</h3>
                <p style={{marginBottom: '2rem', color: '#e2e8f0'}}>{appModal.message}</p>
                <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                  {appModal.type === 'confirm' ? (
                    <>
                      <button className="btn-primary" onClick={() => { appModal.onConfirm(); setAppModal({...appModal, isOpen: false}) }}>Aceptar</button>
                      <button className="btn-secondary" onClick={() => setAppModal({...appModal, isOpen: false})}>Cancelar</button>
                    </>
                  ) : (
                    <button className="btn-primary" onClick={() => setAppModal({...appModal, isOpen: false})}>Entendido</button>
                  )}
                </div>
              </div>
            </div>
          )}

      </main>
        {previewImage && (
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
        )}
    </div>
  )
}
