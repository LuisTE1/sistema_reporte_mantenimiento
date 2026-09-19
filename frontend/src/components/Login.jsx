import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [recordar, setRecordar] = useState(true)

  // Si la señal está presente pero muy débil (o Supabase no responde), el
  // fetch puede quedarse colgado indefinidamente sin lanzar error ni éxito:
  // sin este timeout, el botón se quedaría en "Verificando..." para siempre
  // y el trabajador no tendría forma de saber que debe reintentar.
  const withTimeout = (promise, ms) => {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), ms))
    return Promise.race([promise, timeout])
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // La verificación de contraseña ocurre DENTRO de Supabase (función
      // login_usuario, con el hash bcrypt): el navegador nunca ve ni
      // envía la contraseña guardada, solo recibe el usuario si coincide.
      const { data: users, error } = await withTimeout(supabase.rpc('login_usuario', {
        p_nombre: username.toUpperCase(),
        p_password: password
      }), 15000)

      if (error) throw error

      if (users && users.length > 0) {
        const foundUser = users[0]

        const userData = {
          ...foundUser,
          permisos: {
            dashboard: foundUser.permiso_dashboard,
            soluciones: foundUser.permiso_soluciones,
            inventario: foundUser.permiso_inventario,
            config: foundUser.permiso_config,
            grifos: foundUser.permiso_grifos !== false, // default true if undefined
            unidades: foundUser.permiso_unidades === true, // default false if undefined
            verGrifos: foundUser.permiso_ver_grifos !== false, // default true if undefined
            verUnidades: foundUser.permiso_ver_unidades === true // default false if undefined
          }
        }
        
        if (recordar) {
          localStorage.setItem('auth_user', JSON.stringify(userData))
        }

        onLogin(userData)
      } else {
        alert('El usuario ingresado no existe o es incorrecto.')
      }
    } catch (error) {
      alert('Error conectando a Supabase.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-center">
      <div className="login-card">
        <div className="logo-badge">CO</div>
        <h2 className="text-center">Control Operativo</h2>
        <p className="subtitle text-center mb-4">Accede a tu cuenta</p>
        <form onSubmit={handleLogin} className="standard-form">
          <div className="form-group">
            <label>Usuario</label>
            <div className="input-icon-group">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-icon-group">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
          </div>
          <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0'}}>
            <input
              type="checkbox"
              id="recordar"
              checked={recordar}
              onChange={e => setRecordar(e.target.checked)}
            />
            <label htmlFor="recordar" style={{marginBottom: 0, cursor: 'pointer', color: 'var(--text-muted)'}}>Recordar mi sesión</label>
          </div>
          <button type="submit" className="btn-primary mt-4 full-width" disabled={loading}>
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
        
        <div style={{marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)'}}>
          Desarrollado por <strong>Luis Tataje</strong> <br/>
          <a href="https://wa.me/51990477074" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.5rem'}}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766 0 1.011.266 1.996.772 2.868l-.82 2.99 3.059-.803a5.727 5.727 0 002.757.705h.002c3.18 0 5.767-2.586 5.768-5.766 0-3.181-2.587-5.767-5.77-5.767m3.172 8.322c-.173.491-.99.941-1.391 1.002-.34.053-.872.1-2.38-.52-1.815-.745-3.003-2.613-3.093-2.735-.09-.122-.738-.985-.738-1.879 0-.895.466-1.341.63-1.52.164-.179.355-.224.472-.224.118 0 .236.002.34.007.111.005.259-.043.405.31.154.372.527 1.285.572 1.378.046.092.078.2.018.318-.059.12-.09.194-.18.3-.09.106-.192.235-.27.323-.091.1-.186.208-.077.397.108.188.482.798 1.037 1.293.714.638 1.314.836 1.503.926.188.09.301.076.412-.051.113-.129.487-.565.619-.76.13-.194.262-.162.435-.1.173.063 1.096.518 1.284.611.189.094.316.142.36.223.047.081.047.472-.126.963"/>
              <path d="M12.014 2C6.478 2 2 6.478 2 12.014c0 1.76.46 3.473 1.332 5l-1.332 4.986 5.12-1.34A9.972 9.972 0 0012.014 22c5.536 0 10.014-4.478 10.014-10.014C22.028 6.478 17.55 2 12.014 2zm0 18.322c-1.488 0-2.946-.395-4.223-1.144l-.302-.178-3.136.822.836-3.056-.196-.31A8.328 8.328 0 013.684 12.014c0-4.606 3.748-8.354 8.33-8.354 4.605 0 8.353 3.748 8.353 8.354 0 4.606-3.748 8.322-8.353 8.322z"/>
            </svg>
            Soporte al: 990477074
          </a>
        </div>
      </div>
    </div>
  )
}
