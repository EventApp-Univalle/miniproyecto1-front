import { validateSubtask } from './subtasks.utils.js'

export function capacityConflictDetails(details) {
  if (!details || !/^\d{4}-\d{2}-\d{2}$/.test(details.targetDate || '')) return null
  const date = new Date(`${details.targetDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== details.targetDate) return null
  if (!Number.isFinite(details.totalHours) || !Number.isFinite(details.limitHours) ||
      details.limitHours <= 0 || details.totalHours <= details.limitHours) return null
  const decimalPlaces = value => {
    const [mantissa, exponent = '0'] = String(value).split('e')
    return Math.max(0, (mantissa.split('.')[1]?.length || 0) - Number(exponent))
  }
  const places = Math.min(100, Math.max(decimalPlaces(details.totalHours), decimalPlaces(details.limitHours)))
  const excessHours = Number((details.totalHours - details.limitHours).toFixed(places))
  return { ...details, excessHours }
}

// Keep all pending changes together; no partial write is made on a conflict.
export function subtaskChanges(draft, original) {
  const values = { ...draft, title: draft.title.trim(), estimatedHours: Number(draft.estimatedHours) }
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== original[key]))
}

export async function saveSubtaskEdit({ draft, original, eventDate, referenceDate, strategy, onSave, lock }) {
  if (lock.current) return { status: 'blocked' }
  const fields = validateSubtask(draft, eventDate, referenceDate, strategy === 'date' ? undefined : original.targetDate)
  if (Object.keys(fields).length) return { status: 'invalid', fields }
  const changes = subtaskChanges(draft, original)
  if (!Object.keys(changes).length) return { status: 'failed', message: 'No hay cambios para guardar.' }
  lock.current = true
  try {
    await onSave(changes)
    return { status: 'saved' }
  } catch (error) {
    if (error?.code === 'DAILY_CAPACITY_EXCEEDED') {
      const details = capacityConflictDetails(error.details)
      if (details) return { status: 'conflict', details }
    }
    return { status: 'failed', fields: error?.status === 400 ? error.fields : undefined,
      message: error?.status === 401 ? 'Tu sesión dejó de ser válida. Inicia sesión nuevamente.' :
        error?.status === 400 ? 'Revisa los campos indicados e intenta nuevamente.' :
          'No pudimos guardar los cambios. Intenta nuevamente.' }
  } finally { lock.current = false }
}

export function cancelCapacityConflict(event, busy, onCancel) {
  event.preventDefault()
  if (!busy) onCancel()
}

export function containConflictFocus(event) {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button, input')].filter(control => !control.disabled)
  const first = controls[0], last = controls.at(-1)
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return }
  if ((!event.shiftKey && event.target === last) || (event.shiftKey && event.target === first)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}


export function conflictSuggestions(details) {
  if (!Array.isArray(details?.suggestions)) return []
  return details.suggestions.filter(suggestion => {
    if (!suggestion || !['CHANGE_DATE', 'ADJUST_HOURS'].includes(suggestion.strategy) ||
        !Number.isFinite(suggestion.estimatedHours) || suggestion.estimatedHours <= 0 ||
        typeof suggestion.targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(suggestion.targetDate)) return false
    const date = new Date(`${suggestion.targetDate}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === suggestion.targetDate
  })
}

// Only the proposed field changes; title and all other pending edits survive.
export function applyConflictSuggestion(draft, suggestion) {
  if (!conflictSuggestions({ suggestions: [suggestion] }).length) return draft
  return suggestion.strategy === 'CHANGE_DATE' ? { ...draft, targetDate: suggestion.targetDate }
    : { ...draft, estimatedHours: String(suggestion.estimatedHours) }
}

export function formatConflictDate(value) {
  // A calendar date must not shift to the previous day in Colombia.
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(date)
}

export function formatSuggestedHours(value) {
  // Preserve small positive proposals rather than displaying them as 0 h.
  return String(value).replace('.', ',')
}


export async function saveSubtaskCreation({ draft, eventDate, referenceDate, onCreate, lock }) {
  if (lock.current) return { status: 'blocked' }
  if (eventDate < referenceDate) return { status: 'failed', message: 'El evento ya pasó. No se pueden agregar nuevas subtareas.' }
  const fields = validateSubtask(draft, eventDate, referenceDate)
  if (Object.keys(fields).length) return { status: 'invalid', fields }
  lock.current = true
  try {
    const subtask = await onCreate({ title: draft.title.trim(), targetDate: draft.targetDate,
      estimatedHours: Number(draft.estimatedHours) })
    if (!subtask || typeof subtask.id !== 'string' || !subtask.id) throw new Error('El servidor devolvió una respuesta inesperada.')
    return { status: 'created', subtask }
  } catch (error) {
    if (error?.code === 'DAILY_CAPACITY_EXCEEDED') {
      const details = capacityConflictDetails(error.details)
      if (details) return { status: 'conflict', details }
    }
    return { status: 'failed', fields: error?.fields,
      message: error?.message || 'No pudimos crear la subtarea. Intenta nuevamente.' }
  } finally { lock.current = false }
}

export function appendCreatedSubtask(tasks, created) {
  return tasks.some(task => task.id === created.id) ? tasks : [...tasks, created]
}

export function focusConflictInput(input, strategy) {
  input?.focus()
  if (strategy === 'hours') input?.select()
}
