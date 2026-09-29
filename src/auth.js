const SESSION_KEY = 'eventapp_session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function startLocalSession(email) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ email, startedAt: new Date().toISOString() })
  )
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}