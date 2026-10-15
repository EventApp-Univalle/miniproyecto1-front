import { useEffect, useId, useRef, useState } from 'react'
import { cancelCapacityConflict, containConflictFocus, conflictSuggestions, formatConflictDate, formatSuggestedHours, focusConflictInput } from '../subtaskEdit.utils'
import Icon from './Icon'

export default function CapacityConflictDialog({ details, draft, eventDate, referenceDate,
  returnFocus, busy, error, fields = {}, onChange, onSelectSuggestion, onRetry, onCancel }) {
  const dialog = useRef(null)
  const input = useRef(null)
  const [strategy, setStrategy] = useState('')
  const [selection, setSelection] = useState(null)
  const selected = selection?.details === details ? selection.suggestion : null
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    const origin = returnFocus?.current || document.activeElement
    element.showModal()
    return () => { element.close(); if (origin?.isConnected) origin.focus() }
  }, [returnFocus])
  useEffect(() => { if (strategy) focusConflictInput(input.current, strategy) }, [strategy])
  useEffect(() => { if (busy) dialog.current?.focus() }, [busy])
  function chooseManualStrategy(next) {
    setSelection(null)
    if (strategy === next) focusConflictInput(input.current, next)
    setStrategy(next)
  }
  const field = strategy === 'date' ? 'targetDate' : 'estimatedHours'
  return <dialog ref={dialog} className="capacity-conflict-dialog" role="dialog" aria-modal="true"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description ${id}-help`}
    aria-busy={busy} tabIndex={-1} onKeyDown={containConflictFocus} onCancel={event => cancelCapacityConflict(event, busy, onCancel)}>
    <span className="icon-tile"><Icon name="alert" /></span>
    <h2 id={`${id}-title`}>No puedes planificar más horas en esta fecha</h2>
    <div className="conflict-summary" aria-live="polite">
      <p id={`${id}-description`}>Esta fecha ({details.targetDate}) quedaría con <strong>{formatSuggestedHours(details.totalHours)} h</strong> planificadas. Tu límite diario es <strong>{formatSuggestedHours(details.limitHours)} h</strong>.</p>
      <p id={`${id}-help`}>Necesitas reducir al menos {formatSuggestedHours(details.excessHours)} h o elegir otra fecha.</p>
    </div>
    <ConflictSuggestions details={details} selected={selected} busy={busy}
      onSelect={suggestion => {
        if (busy) return
        setSelection({ details, suggestion })
        setStrategy(suggestion.strategy === 'CHANGE_DATE' ? 'date' : 'hours')
        onSelectSuggestion(suggestion)
      }} />
    <div className="conflict-strategies" aria-label="Opciones para resolver">
      <button type="button" className={strategy === 'date' ? 'btn-primary' : 'btn-secondary'}
        aria-pressed={strategy === 'date'} disabled={busy} onClick={() => chooseManualStrategy('date')}>Elegir otra fecha</button>
      <button type="button" className={strategy === 'hours' ? 'btn-primary' : 'btn-secondary'}
        aria-pressed={strategy === 'hours'} disabled={busy} onClick={() => chooseManualStrategy('hours')}>Ajustar horas</button>
    </div>
    {strategy && <form noValidate className="conflict-form" aria-busy={busy}
      onSubmit={event => { event.preventDefault(); if (!busy) onRetry(strategy) }}>
      <div className="form-group">
        <label htmlFor={`${id}-input`}>{strategy === 'date' ? 'Nueva fecha objetivo' : 'Horas estimadas'}</label>
        <input ref={input} id={`${id}-input`} name={field} required disabled={busy}
          type={strategy === 'date' ? 'date' : 'number'} min={strategy === 'date' ? referenceDate : '0'}
          max={strategy === 'date' ? eventDate : undefined} step={strategy === 'hours' ? 'any' : undefined}
          value={draft[field]} onChange={event => { setSelection(null); onChange(field, event.target.value) }}
          aria-invalid={Boolean(fields[field])} aria-describedby={fields[field] ? `${id}-error` : undefined} />
        {fields[field] && <p id={`${id}-error`} className="field-error" role="alert">{fields[field]}</p>}
      </div>
      {selected && <p className="conflict-selection" role="status">
        Propuesta seleccionada. Borrador: {formatConflictDate(draft.targetDate)}, {Number(draft.estimatedHours) > 0 ? `${formatSuggestedHours(draft.estimatedHours)} h estimadas` : 'horas por confirmar'}.
        Revisa los valores y confirma para guardar.
      </p>}
      {error && <p className="feedback-banner feedback-error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Reintentar guardar'}</button>
    </form>}
    <button type="button" className="btn-secondary conflict-cancel" disabled={busy} onClick={onCancel}>Cancelar</button>
  </dialog>
}


export function ConflictSuggestions({ details, selected, busy, onSelect }) {
  const id = useId()
  const suggestions = conflictSuggestions(details)
  const emptyMessage = Array.isArray(details.suggestions)
    ? (typeof details.noSuggestionsReason === 'string' && details.noSuggestionsReason.trim()
      ? details.noSuggestionsReason : 'No hay soluciones sugeridas disponibles. Puedes elegir otra fecha o ajustar las horas manualmente.')
    : 'No recibimos sugerencias automáticas. Puedes elegir otra fecha o ajustar las horas manualmente.'
  return <section className="conflict-suggestions" aria-labelledby={`${id}-suggestions-title`}>
    <h3 id={`${id}-suggestions-title`}>Soluciones sugeridas por EventApp</h3>
    <p className="conflict-suggestions-help">Calculadas con el último intento. No reservan capacidad; se comprobarán de nuevo al guardar.</p>
    {suggestions.length ? <ul className="conflict-suggestions-list" aria-label="Propuestas calculadas por EventApp">
      {suggestions.map((suggestion, index) => {
        const date = formatConflictDate(suggestion.targetDate)
        const estimate = formatSuggestedHours(suggestion.estimatedHours)
        const unit = suggestion.estimatedHours === 1 ? 'hora' : 'horas'
        const dateChange = suggestion.strategy === 'CHANGE_DATE'
        const active = selected === suggestion
        return <li key={`${suggestion.strategy}-${suggestion.targetDate}-${index}`}>
          <button type="button" className="conflict-suggestion" aria-pressed={active} disabled={busy}
            aria-label={dateChange ? `Seleccionar fecha ${date}. Estimación de referencia: ${estimate} ${unit}.`
              : `Seleccionar ajuste a ${estimate} ${unit}. Propuesta para ${date}.`}
            onClick={() => { if (!busy) onSelect(suggestion) }}>
            <Icon name={dateChange ? 'calendar' : 'clock'} />
            <span><strong>{dateChange ? date : `Reducir a ${estimate} h`}</strong>
              <span>{dateChange ? `Conserva las horas estimadas (${estimate} h en el último intento).`
                : `Conserva la fecha del borrador. Propuesta calculada para el ${date}.`}</span>
              {active && <span className="conflict-suggestion-selected">Seleccionada</span>}
            </span>
          </button>
        </li>
      })}
    </ul> : <p className="conflict-no-suggestions" role="status">{emptyMessage}</p>}
  </section>
}
