import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { clearSession } from '../auth'

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await clearSession()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(error.message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (['/login', '/registro'].includes(location.pathname)) {
    return null
  }

  return (
    <nav className="bottom-nav">
      <div className="nav-container">
        <NavLink 
          to="/hoy" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Hoy</span>
        </NavLink>

        <NavLink 
          to="/crear" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <span className="nav-icon">➕</span>
          <span className="nav-label">Crear</span>
        </NavLink>

        <NavLink 
          to="/progreso" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Progreso</span>
        </NavLink>

        <button
          type="button"
          className="nav-item nav-logout"
          title="Salir"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <span className="nav-icon">🚪</span>
          <span className="nav-label">{isLoggingOut ? 'Saliendo…' : 'Salir'}</span>
        </button>
      </div>
      {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
    </nav>
  )
}
