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
