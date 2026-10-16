export const executionLabels = { PENDING: 'Pendiente', DONE: 'Hecha', POSTPONED: 'Pospuesta' }

export function validateExecution(draft) {
  const fields = {}
  if (!Object.hasOwn(executionLabels, draft.status)) fields.status = 'Selecciona Pendiente, Hecha o Pospuesta.'
  if (typeof draft.executionNote !== 'string' || draft.executionNote.length > 2000) fields.executionNote = 'Escribe una nota de hasta 2000 caracteres.'
  return fields
}

export async function saveExecution(draft, original, onSave, lock) {
  if (lock.current) return { status: 'blocked' }
  const fields = validateExecution(draft)
  if (Object.keys(fields).length) return { status: 'invalid', fields }
  lock.current = true
  try {
    const value = await onSave({ status: draft.status, executionNote: draft.executionNote.trim() || null })
    if (!value || value.id !== original.id || value.eventId !== original.eventId || value.status !== draft.status ||
        value.executionNote !== (draft.executionNote.trim() || null) || !value.executionUpdatedAt ||
        !Number.isFinite(Date.parse(value.executionUpdatedAt))) throw new Error('Confirmación inesperada.')
    return { status: 'saved', value }
  } catch (error) {
    return { status: 'failed', message: error.status === 401 ? 'Tu sesión venció. Inicia sesión nuevamente.'
      : error.status === 409 ? 'Para volver a planificar esta subtarea, revisa su fecha u horas: supera tu capacidad diaria.'
        : 'No pudimos confirmar el estado y la nota. Conservamos tus cambios; si el error continúa, consulta de nuevo el evento antes de reintentar.' }
  } finally { lock.current = false }
}

export function requireEventProgress(value) {
  if (!value || typeof value.eventId !== 'string' || typeof value.eventTitle !== 'string' ||
      !Number.isSafeInteger(value.doneCount) || !Number.isSafeInteger(value.totalCount) ||
      value.doneCount < 0 || value.totalCount < value.doneCount ||
      !Number.isFinite(value.progressPercent) || value.progressPercent < 0 || value.progressPercent > 100 ||
      value.progressPercent !== (value.totalCount ? value.doneCount / value.totalCount * 100 : 0)) {
    throw new Error('No pudimos interpretar el progreso del evento.')
  }
  return value
}

// Preserve the backend grouping and order; state is not inferred from dates.
export function todaySections(groups, status = 'PENDING') {
  if (status === 'DONE') return [{ key: 'done', title: 'Hechas', tasks: groups?.done ?? [] }]
  if (status === 'POSTPONED') return [{ key: 'postponed', title: 'Pospuestas', tasks: groups?.postponed ?? [] }]
  return ['overdue', 'today', 'upcoming'].map((key, n) => ({ key, title: ['Vencidas', 'Para hoy', 'Próximas'][n], tasks: groups?.[key] ?? [] }))
}
