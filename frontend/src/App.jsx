import React, { useState, useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Operario from './components/Operario'
import Gerencia from './components/Gerencia'
import { initNetworkListener, syncOfflineReports } from './utils/offlineQueue'
import { handleBack } from './utils/backButton'
import { setUsuarioParaErrores } from './utils/errorLogger'
import { registrarPushNotifications, escucharAperturaDeReporte } from './utils/push'

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('auth_user')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    setUsuarioParaErrores(user?.nombre || null)
  }, [user])
  const [viewMode, setViewMode] = useState('operario') // 'operario' o 'gerencia'
  const [reportToEdit, setReportToEdit] = useState(null)
  const [showExitHint, setShowExitHint] = useState(false)
  const [pendingReportId, setPendingReportId] = useState(null)

  // Notificaciones push: registra el dispositivo cuando hay sesión, y
  // escucha cuando el usuario toca una notificación para abrir ese
  // reporte directo (sin importar en qué pantalla esté).
  useEffect(() => {
    if (user) registrarPushNotifications(user)
  }, [user?.id])

  useEffect(() => {
    return escucharAperturaDeReporte((reporteId) => setPendingReportId(reporteId))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_user')
    setUser(null)
  }

  // Inicializar el listener de red y sincronizar reportes pendientes al arrancar la app
  useEffect(() => {
    initNetworkListener()
    syncOfflineReports()
  }, [])

  // Botón físico "Atrás" de Android: primero intenta cerrar modales/retroceder
  // dentro de la app (registrados vía useBackHandler); si no hay nada que
  // cerrar, exige doble pulsación antes de salir para evitar cierres accidentales.
  useEffect(() => {
    let lastBackPress = 0
    let exitHintTimer = null
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const handled = handleBack()
      if (handled) return

      const now = Date.now()
      if (now - lastBackPress < 2000) {
        CapacitorApp.exitApp()
        return
      }
      lastBackPress = now
      setShowExitHint(true)
      clearTimeout(exitHintTimer)
      exitHintTimer = setTimeout(() => setShowExitHint(false), 2000)
    })

    return () => {
      clearTimeout(exitHintTimer)
      listenerPromise.then(l => l.remove())
    }
  }, [])

  // Recuerda la última pantalla que cada usuario usó (ej: si un Operario con
  // acceso a Dashboard entra al Panel Administrativo, la próxima vez que
  // abra la app entra directo ahí en vez de tener que volver a buscarlo).
  const setViewModePersisted = (mode) => {
    setViewMode(mode)
    if (user?.nombre) localStorage.setItem(`viewMode_${user.nombre}`, mode)
  }

  useEffect(() => {
    if (user) {
      const recordado = localStorage.getItem(`viewMode_${user.nombre}`)
      if (recordado === 'operario' || recordado === 'gerencia') {
        setViewMode(recordado)
      } else if (user.rol === 'Operario') {
        setViewMode('operario')
      } else {
        setViewMode('gerencia')
      }

      // Escuchar cambios en la base de datos EN TIEMPO REAL
      const subscription = supabase
        .channel('custom-user-channel')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${user.id}` },
          (payload) => {
            const updated = payload.new
            // Actualizar el estado instantáneamente sin tener que recargar
            setUser((prev) => {
              const merged = {
                ...prev,
                ...updated,
                permisos: {
                  dashboard: updated.permiso_dashboard,
                  soluciones: updated.permiso_soluciones,
                  inventario: updated.permiso_inventario,
                  config: updated.permiso_config,
                  grifos: updated.permiso_grifos !== false,
                  unidades: updated.permiso_unidades === true,
                  verGrifos: updated.permiso_ver_grifos !== false,
                  verUnidades: updated.permiso_ver_unidades === true
                }
              }
              // Si no se guarda también en localStorage, la próxima vez que
              // se recargue la página (o se abra en otra pestaña) se vuelve
              // a leer la versión vieja guardada al iniciar sesión.
              if (localStorage.getItem('auth_user')) {
                localStorage.setItem('auth_user', JSON.stringify(merged))
              }
              return merged
            })
            // Notificar al usuario que sus permisos cambiaron en vivo
            alert('Tus privilegios han sido actualizados por Gerencia en tiempo real.')
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [user?.id])

  const exitHint = showExitHint && (
    <div style={{
      position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--card-bg-alt)', color: 'var(--text-main)', padding: '0.75rem 1.25rem',
      borderRadius: '999px', fontSize: '0.9rem', zIndex: 99999, boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border-strong)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
    }}>
      Presiona atrás de nuevo para salir
    </div>
  )

  let content
  if (!user) {
    content = <Login onLogin={setUser} />
  } else if (viewMode === 'operario') {
    content = <Operario onLogout={handleLogout} user={user} onSwitchView={() => setViewModePersisted('gerencia')} reportToEdit={reportToEdit} setReportToEdit={setReportToEdit} pendingReportId={pendingReportId} onPendingReportHandled={() => setPendingReportId(null)} />
  } else if (viewMode === 'gerencia') {
    content = <Gerencia onLogout={handleLogout} user={user} onSwitchView={() => setViewModePersisted('operario')} onEditReport={(report) => { setReportToEdit(report); setViewMode('operario'); }} pendingReportId={pendingReportId} onPendingReportHandled={() => setPendingReportId(null)} />
  } else {
    content = <div>Rol no válido en el sistema</div>
  }

  return (
    <div className="app-shell">
      {content}
      {exitHint}
    </div>
  )
}
