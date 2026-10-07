import { useEffect, useId, useReducer, useRef } from 'react'
import { capacityEditorReducer, capacityEditorState, saveDailyCapacity, validateDailyCapacity } from '../capacity.utils'
import CapacityForm from './CapacityForm'
import Icon from './Icon'

// Data-source adapter: onSave(hours) resolves to the confirmed number.
// No requests, defaults or fixtures are built into this reusable component.
export default function CapacityPanel({ capacity, loading = false, error = '', saving = false,
  available = true, onSave, onRetry }) {
  const titleId = `capacity-title-${useId()}`
  const [state, dispatch] = useReducer(capacityEditorReducer, capacity, capacityEditorState)
  const sending = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { dispatch({ type: 'source', value: capacity }) }, [capacity])
  const busy = saving || state.saving
  const validSource = state.confirmed === null ||
    (typeof state.confirmed === 'number' && !validateDailyCapacity(state.confirmed).error)
  const draft = validateDailyCapacity(state.draft)
  const unchanged = !draft.error && draft.value === state.confirmed

  async function submit(event) {
    event.preventDefault()
    if (busy || sending.current || unchanged || !onSave || !available || loading || error) return
    if (draft.error) { dispatch({ type: 'validation', error: draft.error }); return }
    dispatch({ type: 'saving' })
    const result = await saveDailyCapacity(state.draft, onSave, sending)
    if (!active.current) return
    if (result.status === 'saved') dispatch({ type: 'saved', value: result.value })
    else if (result.status === 'failed') dispatch({ type: 'failed', error: result.error })
  }

  let content
  if (!available) content = <div className="capacity-unavailable" role="status">
    <span className="type-badge">Próximamente</span>
    <p>La configuración del límite diario aún no está disponible.</p>
  </div>
  else if (loading) content = <p className="capacity-status" role="status"><Icon name="loader" />Consultando tu capacidad diaria…</p>
  else if (error || !validSource) content = <div className="capacity-load-error">
    <p className="feedback-banner feedback-error" role="alert"><Icon name="alert" />No pudimos consultar tu capacidad.</p>
    <button type="button" className="btn-secondary" onClick={onRetry} disabled={!onRetry || busy}>Reintentar</button>
  </div>
  else if (state.editing) content = <CapacityForm value={state.draft} fieldError={state.fieldError}
    saveError={state.saveError} saving={busy} unchanged={unchanged}
    onChange={value => dispatch({ type: 'change', value })} onSubmit={submit}
    onCancel={() => { if (!busy && !sending.current) dispatch({ type: 'cancel' }) }} />
  else content = <div className="capacity-value-row">
    <div><strong className={`capacity-value${state.confirmed === null ? ' capacity-not-set' : ''}`}>
      {state.confirmed === null ? 'Sin configurar' : `${state.confirmed} h/día`}
    </strong><p>{state.confirmed === null ? 'Define tu límite diario antes de reprogramar tareas.' : 'Se aplica a todos tus eventos.'}</p></div>
    <button type="button" className={state.confirmed === null ? 'btn-primary' : 'btn-secondary'}
      onClick={() => dispatch({ type: 'edit' })} disabled={busy || !onSave}>
      {state.confirmed === null ? 'Configurar capacidad' : 'Editar'}
    </button>
  </div>

  return <section className="capacity-panel" aria-labelledby={titleId} aria-busy={loading || busy}>
    <div className="capacity-heading"><span className="icon-tile"><Icon name="clock" /></span>
      <div><h2 id={titleId}>Capacidad diaria</h2><p>Define cuántas horas puedes dedicar cada día, entre todos tus eventos.</p></div>
    </div>
    {content}
    {available && !loading && !error && validSource && state.notice && <CapacitySaveNotice />}
  </section>
}

export function CapacitySaveNotice() {
  return <p className="feedback-banner feedback-success" role="status"><Icon name="check" />Capacidad diaria actualizada.</p>
}
