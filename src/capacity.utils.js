const invalidMessage = 'Ingresa un número de horas mayor que 0.'

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
  if (hours <= 0) return { error: invalidMessage, reason: 'not-positive' }
  return { value: hours, error: '', reason: null }
}

export function capacityEditorState(capacity) {
  return { confirmed: capacity, draft: capacity == null ? '' : String(capacity),
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

// onSave must resolve to a confirmed numeric value from the data source.
// This helper never treats the submitted draft as a persisted response.
export async function saveDailyCapacity(value, onSave, lock) {
  if (lock.current) return { status: 'blocked' }
  const validation = validateDailyCapacity(value)
  if (validation.error) return { status: 'invalid', error: validation.error }
  lock.current = true
  try {
    const confirmed = await onSave(validation.value)
    if (typeof confirmed !== 'number' || validateDailyCapacity(confirmed).error) throw new Error('Invalid capacity response')
    return { status: 'saved', value: confirmed }
  } catch {
    return { status: 'failed', error: 'No pudimos guardar tu capacidad. Intenta nuevamente.' }
  } finally {
    lock.current = false
  }
}
