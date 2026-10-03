import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from './auth'
import Navigation from './components/Navigation'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Hoy from './pages/Hoy'
import CrearEvento from './pages/CrearEvento'
import DetalleEvento from './pages/DetalleEvento'
import Progreso from './pages/Progreso'
import './App.css'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page-state" role="status">Comprobando tu sesión…</div>
  return session ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/hoy" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/hoy" element={<ProtectedRoute><Hoy /></ProtectedRoute>} />
          <Route path="/crear" element={<ProtectedRoute><CrearEvento /></ProtectedRoute>} />
          <Route path="/evento/:id" element={<ProtectedRoute><DetalleEvento /></ProtectedRoute>} />
          <Route path="/progreso" element={<ProtectedRoute><Progreso /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Routes>
      </main>
      <Navigation />
    </div>
  )
}

export default App
