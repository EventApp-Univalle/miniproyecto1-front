export const subtaskElementId = id => `subtarea-${id}`

export function subtaskReviewPath({ eventId, subtaskId }) {
  return `/evento/${encodeURIComponent(eventId)}#${encodeURIComponent(subtaskElementId(subtaskId))}`
}

// Only focus a subtask card requested by the link, after its data has loaded.
export function focusLinkedSubtask(hash, root) {
  if (!hash?.startsWith('#subtarea-')) return false
  let id
  try { id = decodeURIComponent(hash.slice(1)) } catch { return false }
  const card = root.getElementById(id)
  if (!card?.classList.contains('subtask-card')) return false
  card.focus({ preventScroll: true })
  card.scrollIntoView({ block: 'center' })
  return true
}

export function subtaskReprogramPath(task) {
  return `/evento/${encodeURIComponent(task.eventId)}?reprogramar=${encodeURIComponent(task.id)}#${encodeURIComponent(subtaskElementId(task.id))}`
}

export function reprogramTarget(search) {
  const params = new URLSearchParams(search)
  const id = params.get('reprogramar')
  return params.getAll('reprogramar').length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? '') ? id : null
}
