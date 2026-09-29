import { useState } from 'react'
import { useNavigate } from 'react-router'
import { startLocalSession } from '../auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña para continuar.')
      return
    }

    startLocalSession(email.trim())
    navigate('/hoy')
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-header">
          <div className="brand-logo">✨</div>
          <h1 className="brand-title">EventApp</h1>
          <p className="brand-subtitle">Organiza y gestiona tus eventos en un solo lugar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
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

          <button type="submit" className="btn-primary btn-block">
            Iniciar sesión
          </button>
          {error && <p role="alert" className="form-error">{error}</p>}
        </form>

        <p className="login-footer">
          Frontend Lead
        </p>
      </div>
    </div>
  )
}