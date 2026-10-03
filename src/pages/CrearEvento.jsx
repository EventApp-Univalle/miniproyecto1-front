import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createEvent } from '../api'
import { getBogotaDate } from '../subtasks.utils'
import { validateEventForm } from '../events.utils'

const initialForm = {
  title: '',
  type: '',
  date: '',
  time: '',
  location: '',
  description: '',
  isPriority: false,
}

export default function CrearEvento() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, type, checked, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationErrors = validateEventForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const createdEvent = await createEvent({
        title: formData.title.trim(),
        type: formData.type.trim(),
        date: formData.date,
        time: formData.time || null,
        location: formData.location.trim() || null,
        description: formData.description.trim() || null,
        isPriority: formData.isPriority,
      })

      navigate(`/evento/${createdEvent.id}`, {
        state: { notice: 'Evento creado correctamente. Ahora agrega su plan.' },
      })
    } catch (error) {
      if (error.fields) setFieldErrors(error.fields)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const errorProps = (name) => ({
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
  })

  return (
    <div className="page-container">
      <header className="app-header">
        <div>
          <span className="app-badge">EventApp</span>
          <h1 className="page-title">Crear evento</h1>
          <p className="page-description">
            Registra el evento y continúa con su plan logístico
          </p>
        </div>
      </header>

      <div className="form-card-wrapper">
        <form
          onSubmit={handleSubmit}
          className="minimal-form"
          aria-busy={isSubmitting}
          noValidate
        >
          {submitError && (
            <div className="feedback-banner feedback-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Nombre del evento *</label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="Ej: Encuentro cultural"
              value={formData.title}
              onChange={handleChange}
              disabled={isSubmitting}
              required
              {...errorProps('title')}
            />
            {fieldErrors.title && (
              <span id="title-error" className="field-error">
                {fieldErrors.title}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="type">Tipo de evento *</label>
            <input
              id="type"
              name="type"
              type="text"
              placeholder="Ej: Cultural, académico, musical"
              value={formData.type}
              onChange={handleChange}
              disabled={isSubmitting}
              required
              {...errorProps('type')}
            />
            {fieldErrors.type && (
              <span id="type-error" className="field-error">
                {fieldErrors.type}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Fecha *</label>
              <input
                id="date"
                name="date"
                type="date"
                min={getBogotaDate()}
                value={formData.date}
                onChange={handleChange}
                disabled={isSubmitting}
                required
                {...errorProps('date')}
              />
              {fieldErrors.date && (
                <span id="date-error" className="field-error">
                  {fieldErrors.date}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="time">Hora</label>
              <input
                id="time"
                name="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Ubicación</label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="Ej: Auditorio principal"
              value={formData.location}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              placeholder="Información útil para organizar el evento"
              value={formData.description}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="switch-field">
            <input
              id="isPriority"
              name="isPriority"
              type="checkbox"
              checked={formData.isPriority}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <label htmlFor="isPriority">
              <span>Evento prioritario</span>
              <small>Destácalo dentro de tu planificación.</small>
            </label>
          </div>

          <p className="required-note">* Campos obligatorios</p>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creando evento…' : '➕ Crear evento'}
          </button>
        </form>
      </div>
    </div>
  )
}
