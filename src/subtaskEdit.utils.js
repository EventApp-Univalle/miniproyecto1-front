import { validateSubtask } from './subtasks.utils.js'

export function capacityConflictDetails(details) {
  if (!details || !/^\d{4}-\d{2}-\d{2}$/.test(details.targetDate || '')) return null
  const date = new Date(`${details.targetDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== details.targetDate) return null
  if (!Number.isFinite(details.totalHours) || !Number.isFinite(details.limitHours) ||
      details.limitHours <= 0 || details.totalHours <= details.limitHours) return null
  const excessHours = Math.round((details.totalHours - details.limitHours) * 100) / 100
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
