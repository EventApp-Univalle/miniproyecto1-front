import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { createSubtask, getEvent, getSubtasks, updateEvent, updateSubtask } from '../api'
import { getBogotaDate, validateSubtask } from '../subtasks.utils'
import EventEditor from '../components/EventEditor'
import { confirmEventDeletion, confirmSubtaskDeletion } from '../crud.actions'

const initialSubtaskForm = {
  title: '',
  targetDate: '',
  estimatedHours: '',
}

export default function DetalleEvento() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [subtasks, setSubtasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [formData, setFormData] = useState(initialSubtaskForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [editingSubtask, setEditingSubtask] = useState(null)
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const deletingRef = useRef(false)

  async function saveEvent(changes) {
    const updated = await updateEvent(id, changes)
    setEvent(updated)
    setEditingEvent(false)
    setNotice('Evento actualizado correctamente.')
  }
  async function removeEvent() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting('event')
    setActionError('')
    try { await confirmEventDeletion(id, subtasks.length, () => navigate('/eventos', { replace: true })) }
    catch (error) { setActionError(error.message) }
    finally { deletingRef.current = false; setDeleting(null) }
  }
  async function removeSubtask(subtaskId) {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(subtaskId)
    setActionError('')
    try {
      await confirmSubtaskDeletion(id, subtaskId, deletedId => {
        setSubtasks(current => current.filter(task => task.id !== deletedId))
        setNotice('Subtarea eliminada correctamente.')
      })
    } catch (error) { setActionError(error.message) }
    finally { deletingRef.current = false; setDeleting(null) }
  }


  useEffect(() => {
    if (location.state?.notice) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const controller = new AbortController()

    async function loadEventPlan() {
      setIsLoading(true)
      setLoadError('')
      setNotFound(false)

      try {
        const [eventData, subtaskData] = await Promise.all([
          getEvent(id, controller.signal),
          getSubtasks(id, controller.signal),
        ])

        setEvent(eventData)
        setSubtasks(subtaskData)
      } catch (error) {
        if (error.name === 'AbortError') return

        if (error.status === 404) setNotFound(true)
        else setLoadError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadEventPlan()
    return () => controller.abort()
  }, [id])

  const handleSubtaskChange = (changeEvent) => {
    const { name, value } = changeEvent.target
    setFormData((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setSubmitError('')
    setNotice('')
  }

  const handleSubtaskSubmit = async (submitEvent) => {
    submitEvent.preventDefault()

    if (isSubmitting || !event) return
    const today = getBogotaDate()
    if (event.date < today) {
      setSubmitError('El evento ya pasó. No se pueden agregar nuevas subtareas.')
      return
    }
    const validationErrors = validateSubtask(formData, event.date, today)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setNotice('')

    try {
      const createdSubtask = await createSubtask(id, {
        title: formData.title.trim(),
        targetDate: formData.targetDate,
        estimatedHours: Number(formData.estimatedHours),
      })

      setSubtasks((current) => [...current, createdSubtask])
      setFormData(initialSubtaskForm)
      setFieldErrors({})
      setNotice('Subtarea agregada al plan correctamente.')
    } catch (error) {
      if (error.fields) setFieldErrors(error.fields)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-state" role="status" aria-live="polite">
        <span className="state-icon">⏳</span>
        <h1>Cargando evento…</h1>
        <p>Estamos recuperando el evento y su plan logístico.</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="page-state">
        <span className="state-icon">🔎</span>
        <h1>Evento no encontrado</h1>
        <p>El evento solicitado no existe o no está disponible.</p>
        <Link to="/crear" className="btn-secondary">Crear un evento</Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-state" role="alert">
        <span className="state-icon">⚠️</span>
        <h1>No pudimos cargar el evento</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => window.location.reload()}
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="page-container">
      <header className="app-header">
        <Link to="/crear" className="btn-back">← Crear otro evento</Link>
      </header>

      {notice && (
        <div className="feedback-banner feedback-success" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      {actionError && <div className="feedback-banner feedback-error" role="alert">{actionError}</div>}
      <article className="event-detail-card">
        <div className="detail-header">
          <div className="detail-tags">
            <span className="type-badge">{event.type}</span>
            {event.isPriority && <span className="priority-badge">Prioritario</span>}
          </div>
          <h1 className="detail-title">{event.title}</h1>
        </div>

        <div className="detail-grid">
          <DetailItem icon="🗓️" label="Fecha" value={event.date} />
          <DetailItem icon="⏰" label="Hora" value={event.time || 'Sin hora'} />
          <DetailItem
            icon="📍"
            label="Ubicación"
            value={event.location || 'Sin ubicación'}
          />
        </div>

        {event.description && (
          <div className="detail-description-section">
            <h2>Descripción del evento</h2>
            <p>{event.description}</p>
          </div>
        )}
        <EventActions onEdit={() => { setEditingEvent(true); setActionError(''); setNotice('') }}
          onDelete={removeEvent} busy={Boolean(deleting) || editingEvent || Boolean(editingSubtask) || isSubmitting} deleting={deleting === 'event'} />
      </article>
      {editingEvent && <EventEditor event={event} onSave={saveEvent} onCancel={() => setEditingEvent(false)} />}

      <section className="plan-section" aria-labelledby="plan-title">
        <div className="section-header plan-header">
          <div>
            <h2 id="plan-title">Plan logístico</h2>
            <p className="section-description">
              Agrega las tareas necesarias para preparar este evento.
            </p>
          </div>
          <span className="counter-pill">
            {subtasks.length} {subtasks.length === 1 ? 'subtarea' : 'subtareas'}
          </span>
        </div>

        <div className="plan-layout">
          <SubtaskForm
            referenceDate={getBogotaDate()}
            eventDate={event.date}
            formData={formData}
            fieldErrors={fieldErrors}
            submitError={submitError}
            isSubmitting={isSubmitting || editingEvent || Boolean(deleting) || Boolean(editingSubtask)}
            onChange={handleSubtaskChange}
            onSubmit={handleSubtaskSubmit}
          />

          <div className="subtask-list" aria-live="polite">
            {subtasks.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true">📋</span>
                <h3>Aún no hay subtareas</h3>
                <p>{event.date < getBogotaDate()
                  ? 'Este evento ya pasó y no tiene subtareas registradas.'
                  : 'Usa el formulario para comenzar el plan logístico.'}</p>
              </div>
            ) : (
              subtasks.map((subtask) => (
                <article className="subtask-card" key={subtask.id}>
                  {editingSubtask === subtask.id ? <SubtaskEditor subtask={subtask} eventDate={event.date}
                    onCancel={() => setEditingSubtask(null)} onSave={async changes => {
                      const updated = await updateSubtask(id, subtask.id, changes)
                      setSubtasks(current => current.map(task => task.id === updated.id ? updated : task))
                      setEditingSubtask(null)
                      setNotice('Subtarea actualizada correctamente.')
                    }} /> : <>
                  <h3>{subtask.title}</h3>
                  <div className="subtask-meta">
                    <span>🗓️ {subtask.targetDate}</span>
                    <span>⏱️ {subtask.estimatedHours} h</span>
                  </div>
                  <SubtaskActions onEdit={() => { setEditingSubtask(subtask.id); setActionError(''); setNotice('') }}
                    onDelete={() => removeSubtask(subtask.id)} busy={Boolean(deleting) || editingEvent || Boolean(editingSubtask) || isSubmitting}
                    deleting={deleting === subtask.id} />
                  </>}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="detail-item">
      <span className="detail-icon" aria-hidden="true">{icon}</span>
      <div>
        <span className="detail-label">{label}</span>
        <p className="detail-value">{value}</p>
      </div>
    </div>
  )
}

export function SubtaskForm({
  referenceDate,
  eventDate,
  formData,
  fieldErrors,
  submitError,
  isSubmitting,
  onChange,
  onSubmit,
  editing = false,
  onCancel,
}) {
  const eventHasPassed = !editing && eventDate < referenceDate
  const disabled = isSubmitting || eventHasPassed
  const errorProps = (name, errorId) => ({
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? errorId : undefined,
  })

  return (
    <div className="subtask-form-card">
      <h3>{editing ? 'Editar subtarea' : 'Nueva subtarea'}</h3>
      {eventHasPassed && <p role="status">El evento ya pasó. No se pueden agregar nuevas subtareas.</p>}
      <form
        onSubmit={onSubmit}
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
          <label htmlFor="subtask-title">Título *</label>
          <input
            id="subtask-title"
            name="title"
            type="text"
            placeholder="Ej: Confirmar sonido"
            value={formData.title}
            onChange={onChange}
            disabled={disabled}
            required
            {...errorProps('title', 'subtask-title-error')}
          />
          {fieldErrors.title && (
            <span id="subtask-title-error" className="field-error">
              {fieldErrors.title}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="targetDate">Fecha objetivo *</label>
          <input
            id="targetDate"
            name="targetDate"
            type="date"
            min={referenceDate}
            max={eventDate}
            value={formData.targetDate}
            onChange={onChange}
            disabled={disabled}
            required
            {...errorProps('targetDate', 'target-date-error')}
          />
          {fieldErrors.targetDate && (
            <span id="target-date-error" className="field-error">
              {fieldErrors.targetDate}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="estimatedHours">Horas estimadas *</label>
          <input
            id="estimatedHours"
            name="estimatedHours"
            type="number"
            min="0"
            step="any"
            placeholder="Ej: 1.5"
            value={formData.estimatedHours}
            onChange={onChange}
            disabled={disabled}
            required
            {...errorProps('estimatedHours', 'estimated-hours-error')}
          />
          {fieldErrors.estimatedHours && (
            <span id="estimated-hours-error" className="field-error">
              {fieldErrors.estimatedHours}
            </span>
          )}
        </div>

        <button type="submit" className="btn-primary btn-block" disabled={disabled}>
          {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar al plan'}
        </button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} disabled={disabled}>Cancelar</button>}
      </form>
    </div>
  )
}

export function EventActions({ onEdit, onDelete, busy, deleting }) {
  return <div className="crud-actions">
    <button type="button" className="btn-secondary" disabled={busy} onClick={onEdit}>Editar evento</button>
    <button type="button" className="btn-secondary" disabled={busy} onClick={onDelete}>{deleting ? 'Eliminando…' : 'Eliminar evento'}</button>
  </div>
}
export function SubtaskActions({ onEdit, onDelete, busy, deleting }) {
  return <div className="crud-actions">
    <button type="button" className="btn-secondary" disabled={busy} onClick={onEdit}>Editar</button>
    <button type="button" className="btn-secondary" disabled={busy} onClick={onDelete}>{deleting ? 'Eliminando…' : 'Eliminar'}</button>
  </div>
}

export function SubtaskEditor({ subtask, eventDate, onSave, onCancel }) {
  const [formData, setFormData] = useState({ title: subtask.title, targetDate: subtask.targetDate, estimatedHours: String(subtask.estimatedHours) })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  function change(e) {
    setFormData(current => ({ ...current, [e.target.name]: e.target.value }))
    setFieldErrors(current => ({ ...current, [e.target.name]: undefined }))
    setError('')
  }
  async function submit(e) {
    e.preventDefault()
    if (sending.current) return
    const errors = validateSubtask(formData, eventDate, getBogotaDate(), subtask.targetDate)
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    const values = { ...formData, title: formData.title.trim(), estimatedHours: Number(formData.estimatedHours) }
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== subtask[key]))
    if (!Object.keys(changes).length) { setError('No hay cambios para guardar.'); return }
    sending.current = true
    setBusy(true)
    setError('')
    try { await onSave(changes) }
    catch (err) { setError(err.message); if (err.fields) setFieldErrors(err.fields) }
    finally { sending.current = false; setBusy(false) }
  }
  return <SubtaskForm editing formData={formData} referenceDate={getBogotaDate()} eventDate={eventDate}
    fieldErrors={fieldErrors} submitError={error} isSubmitting={busy} onChange={change} onSubmit={submit} onCancel={onCancel} />
}
