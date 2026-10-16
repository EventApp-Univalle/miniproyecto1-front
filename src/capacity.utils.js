const invalidMessage = 'Ingresa un número de horas entre 1 y 24.'

export function validateDailyCapacity(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return { error: 'La capacidad diaria es obligatoria.', reason: 'empty' }
  }
  if (typeof value !== 'number' && (typeof value !== 'string' ||
      !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) {
    return { error: invalidMessage, reason: 'not-numeric' }
  }
  const hours = Number(value)
  if (!Number.isFinite(hours)) return { error: invalidMessage, reason: 'not-finite' }
  if (hours < 1 || hours > 24) return { error: invalidMessage, reason: 'out-of-range' }
  return { value: hours, error: '', reason: null }
}

// Validate the complete response; never substitute a local default for missing data.
export function requireDailyCapacity(capacity) {
  if (!capacity || typeof capacity.dailyLimitHours !== 'number' ||
      validateDailyCapacity(capacity.dailyLimitHours).error ||
      typeof capacity.defaultDailyLimitHours !== 'number' ||
      validateDailyCapacity(capacity.defaultDailyLimitHours).error ||
      typeof capacity.isDefault !== 'boolean' ||
      (capacity.isDefault && capacity.dailyLimitHours !== capacity.defaultDailyLimitHours)) {
    throw new Error('Respuesta de capacidad inesperada.')
  }
  return capacity
}

// Missing or incomplete analysis is unknown, never an empty plan. Keep the
// confirmed capacity usable even when an older server does not return impact.
export function getCapacityImpact(capacity) {
  const impact = capacity?.impact
  if (!impact || typeof impact.hasOverload !== 'boolean' ||
      !Number.isSafeInteger(impact.affectedDayCount) || impact.affectedDayCount < 0 ||
      !Array.isArray(impact.affectedDays) || impact.affectedDayCount !== impact.affectedDays.length ||
      impact.hasOverload !== (impact.affectedDayCount > 0)) return null
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  const dates = new Set()
  for (const day of impact.affectedDays) {
    const date = new Date(`${day?.date}T00:00:00Z`)
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== day.date || dates.has(day.date) ||
        !positive(day.plannedHours) || !positive(day.excessHours) ||
        day.limitHours !== capacity.dailyLimitHours || !Array.isArray(day.tasks) || !day.tasks.length) return null
    dates.add(day.date)
    const taskIds = new Set()
    for (const task of day.tasks) {
      if (!task || !uuid(task.subtaskId) || !uuid(task.eventId) || taskIds.has(task.subtaskId) ||
          typeof task.title !== 'string' || !task.title.trim() || !positive(task.estimatedHours)) return null
      taskIds.add(task.subtaskId)
    }
  }
  return { ...impact, affectedDays: [...impact.affectedDays].sort((a, b) => a.date.localeCompare(b.date)) }
}

export function capacityEditorState(capacity) {
  return { confirmed: capacity, draft: capacity ? String(capacity.dailyLimitHours) : '',
    editing: false, saving: false, fieldError: '', saveError: '', notice: '' }
}

export function capacityEditorReducer(state, action) {
  switch (action.type) {
    case 'source': return { ...state, confirmed: action.value }
    case 'edit': return { ...capacityEditorState(state.confirmed), editing: true }
    case 'change': return { ...state, draft: action.value, fieldError: '', saveError: '', notice: '' }
    case 'cancel': return state.saving ? state : capacityEditorState(state.confirmed)
    case 'validation': return { ...state, fieldError: action.error, saveError: '' }
    case 'saving': return { ...state, saving: true, fieldError: '', saveError: '', notice: '' }
    case 'saved': return { ...capacityEditorState(action.value), notice: 'Capacidad diaria actualizada.' }
    case 'failed': return { ...state, saving: false, saveError: action.error }
    default: return state
  }
}

// onSave must resolve to the complete confirmed response from the backend.
// This helper never treats the submitted draft as a persisted response.
export async function saveDailyCapacity(value, onSave, lock) {
  if (lock.current) return { status: 'blocked' }
  const validation = validateDailyCapacity(value)
  if (validation.error) return { status: 'invalid', error: validation.error }
  lock.current = true
  try {
    const confirmed = await onSave(validation.value)
    requireDailyCapacity(confirmed)
    return { status: 'saved', value: confirmed }
  } catch (error) {
    return { status: 'failed', error: error?.status === 400 ? 'No pudimos guardar tu capacidad. Revisa que las horas estén entre 1 y 24 e intenta nuevamente.' : 'No pudimos guardar tu capacidad. Intenta nuevamente.' }
  } finally {
    lock.current = false
  }
}
