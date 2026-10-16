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
