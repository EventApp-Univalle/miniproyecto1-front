import { Routes, Route, Navigate } from 'react-router'
import { getSession } from './auth'
import Navigation from './components/Navigation'
import Login from './pages/Login'
import Hoy from './pages/Hoy'
import CrearEvento from './pages/CrearEvento'
import DetalleEvento from './pages/DetalleEvento'
import Progreso from './pages/Progreso'
import './App.css'

function ProtectedRoute({ children }) {
  return getSession() ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/hoy" replace />} />
          <Route path="/login" element={<Login />} />
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