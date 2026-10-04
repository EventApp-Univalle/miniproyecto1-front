import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createEvent } from '../api'
import EventForm from '../components/EventForm'
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

      <EventForm formData={formData} fieldErrors={fieldErrors} submitError={submitError}
        isSubmitting={isSubmitting} onChange={handleChange} onSubmit={handleSubmit}
        referenceDate={getBogotaDate()} />
    </div>
  )
}
