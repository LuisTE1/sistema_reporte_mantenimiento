import React, { useState, useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Operario from './components/Operario'
import Gerencia from './components/Gerencia'
import { initNetworkListener, syncOfflineReports } from './utils/offlineQueue'
import { handleBack } from './utils/backButton'
import { setUsuarioParaErrores } from './utils/errorLogger'

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
            setUser((prev) => ({
              ...prev,
              ...updated,
              permisos: {
                dashboard: updated.permiso_dashboard,
                soluciones: updated.permiso_soluciones,
                inventario: updated.permiso_inventario,
                config: updated.permiso_config,
                grifos: updated.permiso_grifos !== false,
                unidades: updated.permiso_unidades === true
              }
            }))
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
      background: 'rgba(15,23,42,0.95)', color: 'white', padding: '0.75rem 1.25rem',
      borderRadius: '999px', fontSize: '0.9rem', zIndex: 99999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      border: '1px solid #334155'
    }}>
      Presiona atrás de nuevo para salir
    </div>
  )

  if (!user) {
    return <>
      <Login onLogin={setUser} />
      {exitHint}
    </>
  }

  if (viewMode === 'operario') {
    return <>
      <Operario onLogout={handleLogout} user={user} onSwitchView={() => setViewModePersisted('gerencia')} reportToEdit={reportToEdit} setReportToEdit={setReportToEdit} />
      {exitHint}
    </>
  }

  if (viewMode === 'gerencia') {
    return <>
      <Gerencia onLogout={handleLogout} user={user} onSwitchView={() => setViewModePersisted('operario')} onEditReport={(report) => { setReportToEdit(report); setViewMode('operario'); }} />
      {exitHint}
    </>
  }

  return <div>Rol no válido en el sistema</div>
}
