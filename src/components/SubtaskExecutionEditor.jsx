import { useEffect, useId, useRef, useState } from 'react'
import { executionLabels, saveExecution } from '../execution.utils'

export default function SubtaskExecutionEditor({ subtask, onSave, onSaved, onCancel }) {
  const [draft, setDraft] = useState({ status: subtask.status ?? 'PENDING', executionNote: subtask.executionNote ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const lock = useRef(false), active = useRef(true), select = useRef(null)
  const id = useId()
  useEffect(() => {
    active.current = true
    select.current?.focus()
    return () => { active.current = false }
  }, [])
  function change(name, value) {
    setDraft(current => ({ ...current, [name]: value }))
    setFields({}); setError('')
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    setBusy(true); setError(''); setFields({})
    const result = await saveExecution(draft, subtask, onSave, lock)
    if (!active.current) return
    setBusy(false)
    if (result.status === 'saved') onSaved(result.value)
    else if (result.status === 'invalid') setFields(result.fields)
    else if (result.status === 'failed') setError(result.message)
  }
  return <ExecutionForm id={id} draft={draft} title={subtask.title} busy={busy} fields={fields} error={error}
    statusRef={select} onSubmit={submit} onChange={change} onCancel={onCancel} />
}

export function ExecutionForm({ id, draft, title, busy = false, fields = {}, error = '', statusRef,
  onSubmit, onChange, onCancel }) {
  return <form className="minimal-form execution-form" onSubmit={onSubmit} aria-busy={busy} noValidate
    onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel?.() } }}>
    <h3>Registrar avance: {title}</h3>
    <p>Solo cambia el estado y la nota. La fecha y el esfuerzo se mantienen.</p>
    <p id={`${id}-help`}>Hecha libera capacidad pendiente. Pospuesta conserva su fecha y carga; usa Editar para reprogramarla.</p>
    <div className="form-group">
      <label htmlFor={`${id}-status`}>Estado</label>
      <select ref={statusRef} id={`${id}-status`} value={draft.status} disabled={busy}
        aria-invalid={Boolean(fields.status)} aria-describedby={`${id}-help${fields.status ? ` ${id}-status-error` : ''}`}
        onChange={event => onChange('status', event.target.value)}>
        {Object.entries(executionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {fields.status && <p className="field-error" id={`${id}-status-error`}>{fields.status}</p>}
    </div>
    <div className="form-group">
      <label htmlFor={`${id}-note`}>Nota explicativa (opcional)</label>
      <textarea id={`${id}-note`} value={draft.executionNote} maxLength={2000} rows={3} disabled={busy}
        aria-invalid={Boolean(fields.executionNote)} aria-describedby={fields.executionNote ? `${id}-note-error` : undefined}
        onChange={event => onChange('executionNote', event.target.value)} />
      {fields.executionNote && <p className="field-error" id={`${id}-note-error`}>{fields.executionNote}</p>}
    </div>
    {error && <p className="feedback-banner feedback-error" role="alert">{error}</p>}
    <div className="crud-actions">
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Guardando estado…' : error ? 'Reintentar' : 'Guardar estado y nota'}</button>
      <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
    </div>
  </form>
}

export function ExecutionSummary({ subtask }) {
  return <div className="execution-summary">
    <span className={`execution-badge execution-${subtask.status ?? 'PENDING'}`}>{executionLabels[subtask.status ?? 'PENDING'] ?? 'Estado no disponible'}</span>
    {subtask.executionNote && <p className="execution-note">Nota: {subtask.executionNote}</p>}
    {subtask.executionUpdatedAt && Number.isFinite(Date.parse(subtask.executionUpdatedAt)) && <small>
      Último cambio: <time dateTime={subtask.executionUpdatedAt}>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(subtask.executionUpdatedAt))} (Bogotá)</time>
    </small>}
  </div>
}
