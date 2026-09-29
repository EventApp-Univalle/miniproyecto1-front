import { NavLink, useLocation } from 'react-router'
import { clearSession } from '../auth'

export default function Navigation() {
  const location = useLocation()

  const handleLogout = () => {
    clearSession()
  }

  if (location.pathname === '/login') {
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

        <NavLink 
          to="/login" 
          className="nav-item nav-logout"
          title="Salir"
          onClick={handleLogout}
        >
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Salir</span>
        </NavLink>
      </div>
    </nav>
  )
}