import { deleteEvent, deleteSubtask } from './api'

export async function confirmEventDeletion(id, subtaskCount, onDeleted, confirm = message => window.confirm(message)) {
  if (subtaskCount > 0) throw new Error('Primero elimina las subtareas de este evento.')
  if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return false
  await deleteEvent(id)
  onDeleted()
  return true
}

export async function confirmSubtaskDeletion(eventId, subtaskId, onDeleted, confirm = message => window.confirm(message)) {
  if (!confirm('¿Eliminar esta subtarea? Esta acción no se puede deshacer.')) return false
  await deleteSubtask(eventId, subtaskId)
  onDeleted(subtaskId)
  return true
}
