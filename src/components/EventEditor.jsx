import { useRef, useState } from 'react'
import EventForm from './EventForm'
import { eventChanges, validateEventForm } from '../events.utils'
import { getBogotaDate } from '../subtasks.utils'

export default function EventEditor({ event, onSave, onCancel }) {
  const [formData, setFormData] = useState({ title: event.title, type: event.type, date: event.date,
    time: event.time || '', location: event.location || '', description: event.description || '', isPriority: event.isPriority })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  function change(e) {
    const { name, type, checked, value } = e.target
    setFormData(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setFieldErrors(current => ({ ...current, [name]: undefined }))
    setError('')
  }
  async function submit(e) {
    e.preventDefault()
    if (sending.current) return
    const errors = validateEventForm(formData, getBogotaDate(), event.date)
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    const changes = eventChanges(formData, event)
    if (!Object.keys(changes).length) { setError('No hay cambios para guardar.'); return }
    sending.current = true
    setBusy(true)
    setError('')
    try { await onSave(changes) }
    catch (err) { setError(err.message); if (err.fields) setFieldErrors(err.fields) }
    finally { sending.current = false; setBusy(false) }
  }
  return <section className="event-editor" aria-label="Editar evento"><h2>Editar evento</h2>
    <EventForm formData={formData} fieldErrors={fieldErrors} submitError={error} isSubmitting={busy}
      onChange={change} onSubmit={submit} referenceDate={getBogotaDate()} submitLabel="Guardar cambios" onCancel={onCancel} />
  </section>
}
