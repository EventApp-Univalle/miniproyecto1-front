import { useEffect, useId, useRef, useState } from 'react'
import { cancelCapacityConflict, containConflictFocus } from '../subtaskEdit.utils'
import Icon from './Icon'

const hours = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

export default function CapacityConflictDialog({ details, draft, eventDate, referenceDate,
  returnFocus, busy, error, fields = {}, onChange, onRetry, onCancel }) {
  const dialog = useRef(null)
  const input = useRef(null)
  const [strategy, setStrategy] = useState('')
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    const origin = returnFocus?.current || document.activeElement
    element.showModal()
    return () => { element.close(); if (origin?.isConnected) origin.focus() }
  }, [returnFocus])
  useEffect(() => { if (strategy) input.current?.focus() }, [strategy])
  useEffect(() => { if (busy) dialog.current?.focus() }, [busy])
  const field = strategy === 'date' ? 'targetDate' : 'estimatedHours'
  return <dialog ref={dialog} className="capacity-conflict-dialog" role="dialog" aria-modal="true"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description ${id}-help`}
    aria-busy={busy} tabIndex={-1} onKeyDown={containConflictFocus} onCancel={event => cancelCapacityConflict(event, busy, onCancel)}>
    <span className="icon-tile"><Icon name="alert" /></span>
    <h2 id={`${id}-title`}>No puedes planificar más horas en esta fecha</h2>
    <div className="conflict-summary" aria-live="polite">
      <p id={`${id}-description`}>Esta fecha ({details.targetDate}) quedaría con <strong>{hours.format(details.totalHours)} h</strong> planificadas. Tu límite diario es <strong>{hours.format(details.limitHours)} h</strong>.</p>
      <p id={`${id}-help`}>Necesitas reducir al menos {hours.format(details.excessHours)} h o elegir otra fecha.</p>
    </div>
    <div className="conflict-strategies" aria-label="Opciones para resolver">
      <button type="button" className={strategy === 'date' ? 'btn-primary' : 'btn-secondary'}
        aria-pressed={strategy === 'date'} disabled={busy} onClick={() => setStrategy('date')}>Elegir otra fecha</button>
      <button type="button" className={strategy === 'hours' ? 'btn-primary' : 'btn-secondary'}
        aria-pressed={strategy === 'hours'} disabled={busy} onClick={() => setStrategy('hours')}>Ajustar horas</button>
    </div>
    {strategy && <form noValidate className="conflict-form" aria-busy={busy}
      onSubmit={event => { event.preventDefault(); if (!busy) onRetry(strategy) }}>
      <div className="form-group">
        <label htmlFor={`${id}-input`}>{strategy === 'date' ? 'Nueva fecha objetivo' : 'Horas estimadas'}</label>
        <input ref={input} id={`${id}-input`} name={field} required disabled={busy}
          type={strategy === 'date' ? 'date' : 'number'} min={strategy === 'date' ? referenceDate : '0'}
          max={strategy === 'date' ? eventDate : undefined} step={strategy === 'hours' ? 'any' : undefined}
          value={draft[field]} onChange={event => onChange(field, event.target.value)}
          aria-invalid={Boolean(fields[field])} aria-describedby={fields[field] ? `${id}-error` : undefined} />
        {fields[field] && <p id={`${id}-error`} className="field-error" role="alert">{fields[field]}</p>}
      </div>
      {error && <p className="feedback-banner feedback-error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Reintentar guardar'}</button>
    </form>}
    <button type="button" className="btn-secondary conflict-cancel" disabled={busy} onClick={onCancel}>Cancelar</button>
  </dialog>
}
