import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from './auth'
import Navigation from './components/Navigation'
import ApiDocumentationLink from './components/ApiDocumentationLink'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Hoy from './pages/Hoy'
import Eventos from './pages/Eventos'
import CrearEvento from './pages/CrearEvento'
import DetalleEvento from './pages/DetalleEvento'
import Progreso from './pages/Progreso'
import Configuracion from './pages/Configuracion'
import './App.css'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page-state" role="status">Comprobando tu sesión…</div>
  return session ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Navigate to="/hoy" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/hoy" element={<ProtectedRoute><Hoy /></ProtectedRoute>} />
          <Route path="/crear" element={<ProtectedRoute><CrearEvento /></ProtectedRoute>} />
          <Route path="/eventos" element={<ProtectedRoute><Eventos /></ProtectedRoute>} />
          <Route path="/evento/:id" element={<ProtectedRoute><DetalleEvento /></ProtectedRoute>} />
          <Route path="/progreso" element={<ProtectedRoute><Progreso /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Routes>
        <ApiDocumentationLink />
      </main>
      <Navigation />
    </div>
  )
}

export default App
