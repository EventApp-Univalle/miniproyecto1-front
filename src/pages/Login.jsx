import AuthLayout from '../components/AuthLayout'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signIn, useAuth } from '../auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { authError } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setSubmitted(true)
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña para continuar.')
      return
    }

    setIsSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/hoy', { replace: true })
    } catch (error) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" description="Organiza y gestiona tus eventos en un solo lugar">
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              disabled={isSubmitting}
              placeholder="tu.correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={submitted && !email.trim()}
              aria-describedby={submitted && !email.trim() ? 'email-error' : undefined}
            />
            {submitted && !email.trim() && (
              <p id="email-error" className="field-error">El correo es obligatorio.</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={submitted && !password.trim()}
              aria-describedby={submitted && !password.trim() ? 'password-error' : undefined}
            />
            {submitted && !password.trim() && (
              <p id="password-error" className="field-error">La contraseña es obligatoria.</p>
            )}
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
          {error && <p role="alert" className="form-error">{error}</p>}
          {!error && authError && <p role="alert" className="form-error">{authError}</p>}
        </form>
        <p className="auth-link">¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link></p>
    </AuthLayout>
  )
}
