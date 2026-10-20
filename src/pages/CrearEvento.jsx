import PageHeader from '../components/PageHeader'
import { useRef, useState } from 'react'
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
  const sending = useRef(false)
  const [focusErrorVersion, setFocusErrorVersion] = useState(0)

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
    if (sending.current) return

    const validationErrors = validateEventForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setFocusErrorVersion(value => value + 1)
      return
    }

    sending.current = true
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

      if (typeof createdEvent?.id !== 'string' || !createdEvent.id) throw new Error('No pudimos confirmar el evento. Consulta Eventos antes de volver a crearlo.')
      navigate(`/evento/${createdEvent.id}`, {
        state: { notice: 'Evento creado correctamente. Ahora agrega su plan.' },
      })
    } catch (error) {
      if (error.fields) { setFieldErrors(error.fields); setFocusErrorVersion(value => value + 1) }
      setSubmitError(error.message)
    } finally {
      sending.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <PageHeader title="Crear evento" description="Registra el evento y continúa con su plan logístico" />

      <EventForm formData={formData} fieldErrors={fieldErrors} submitError={submitError}
        isSubmitting={isSubmitting} onChange={handleChange} onSubmit={handleSubmit}
        referenceDate={getBogotaDate()} focusErrorVersion={focusErrorVersion} />
    </div>
  )
}
