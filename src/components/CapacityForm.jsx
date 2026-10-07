import { useId } from 'react'

export default function CapacityForm({ value, fieldError = '', saveError = '', saving = false,
  unchanged = false, onChange, onSubmit, onCancel }) {
  const id = useId()
  const inputId = `capacity-${id}`
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`
  return <form className="capacity-form" onSubmit={onSubmit} noValidate aria-busy={saving}>
    <div className="form-group">
      <label htmlFor={inputId}>Horas disponibles por día</label>
      <div className="capacity-input-row">
        <input id={inputId} type="number" inputMode="decimal" min="0" step="any" required
          value={value} onChange={event => onChange(event.target.value)} disabled={saving}
          aria-invalid={Boolean(fieldError)} aria-describedby={`${helpId}${fieldError ? ` ${errorId}` : ''}`} />
        <span aria-hidden="true">h/día</span>
      </div>
      <small id={helpId} className="capacity-help">Puedes usar decimales. Se aplica a todos tus eventos.</small>
      {fieldError && <p id={errorId} className="field-error" role="alert">{fieldError}</p>}
    </div>
    {saveError && <p className="feedback-banner feedback-error" role="alert">{saveError}</p>}
    <div className="capacity-actions">
      <button type="submit" className="btn-primary" disabled={saving || unchanged}>
        {saving ? 'Guardando…' : saveError ? 'Reintentar' : 'Guardar'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
    </div>
  </form>
}
