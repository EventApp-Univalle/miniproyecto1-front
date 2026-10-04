import AuthLayout from '../components/AuthLayout'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signUp } from '../auth'

const initialForm = { name: '', email: '', password: '', confirmPassword: '' }

function validateRegistration(form) {
  const fields = {}
  if (!form.name.trim()) fields.name = 'Escribe tu nombre.'
  if (!form.email.trim()) fields.email = 'Escribe tu correo electrónico.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    fields.email = 'Escribe un correo electrónico válido.'
  }
  if (!form.password.trim()) fields.password = 'Escribe una contraseña.'
  else if (form.password.length < 6) fields.password = 'Usa al menos 6 caracteres.'
  if (!form.confirmPassword.trim()) fields.confirmPassword = 'Confirma tu contraseña.'
  else if (form.password !== form.confirmPassword) {
    fields.confirmPassword = 'Las contraseñas deben coincidir.'
  }
  return fields
}

const inputs = [
  { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Correo electrónico', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirmar contraseña', type: 'password', autoComplete: 'new-password' },
]

export default function Registro() {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  function handleChange(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setFieldErrors(current => ({ ...current, [name]: undefined }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting || notice) return
    const fields = validateRegistration(form)
    setFieldErrors(fields)
    setError('')
    if (Object.keys(fields).length) return
    setIsSubmitting(true)
    try {
      const { session } = await signUp(form.name, form.email, form.password)
      setForm(current => ({ ...current, password: '', confirmPassword: '' }))
      if (session) navigate('/hoy', { replace: true })
      else setNotice('Tu cuenta fue creada, pero requiere validación antes de ingresar. Revisa tu correo para confirmarla y luego inicia sesión.')
    } catch (error) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Crea tu cuenta" description="Tu próximo evento empieza aquí">
        <form onSubmit={handleSubmit} className="login-form" noValidate aria-busy={isSubmitting}>
          {inputs.map(input => {
            const errorId = `register-${input.name}-error`
            return (
              <div className="form-group" key={input.name}>
                <label htmlFor={`register-${input.name}`}>{input.label}</label>
                <input
                  id={`register-${input.name}`}
                  name={input.name}
                  type={input.type}
                  autoComplete={input.autoComplete}
                  value={form[input.name]}
                  onChange={handleChange}
                  disabled={isSubmitting || Boolean(notice)}
                  required
                  minLength={input.name === 'password' ? 6 : undefined}
                  aria-invalid={Boolean(fieldErrors[input.name])}
                  aria-describedby={fieldErrors[input.name] ? errorId : undefined}
                />
                {fieldErrors[input.name] && <p id={errorId} className="field-error">{fieldErrors[input.name]}</p>}
              </div>
            )
          })}
          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting || Boolean(notice)}>
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
          {error && <p role="alert" className="form-error">{error}</p>}
          {notice && <p role="status" className="auth-notice">{notice}</p>}
        </form>
        <p className="auth-link">¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link></p>
    </AuthLayout>
  )
}
