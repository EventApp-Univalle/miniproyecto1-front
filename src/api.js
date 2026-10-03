import { getSession, expireSession } from './auth'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', fields } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function request(path, { expectedStatus, ...options } = {}) {
  let response
  const session = await getSession()
  if (!session?.access_token) {
    expireSession()
    throw new ApiError('Inicia sesión para continuar.', { status: 401, code: 'AUTH_REQUIRED' })
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${session.access_token}` },
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(
      'No fue posible conectar con el servidor. Verifica que el backend esté activo.'
    )
  }

  let data = null

  if (response.status === 401) {
    expireSession()
    throw new ApiError('Tu sesión dejó de ser válida. Inicia sesión nuevamente.', {
      status: 401, code: 'INVALID_TOKEN',
    })
  }

  try {
    data = await response.json()
  } catch {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    })
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || 'No fue posible completar la operación.',
      {
        status: response.status,
        code: data?.error?.code || 'API_ERROR',
        fields: data?.error?.fields,
      }
    )
  }

  if (expectedStatus && response.status !== expectedStatus) {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', {
      status: response.status,
      code: 'UNEXPECTED_STATUS',
    })
  }

  return data
}

function jsonOptions(method, body, signal) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  }
}

export function createEvent(event, signal) {
  return request('/api/eventos', {
    ...jsonOptions('POST', event, signal),
    expectedStatus: 201,
  })
}

export function getTodayTasks(signal, eventId) {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
  return request(`/api/tareas/hoy${query}`, {
    expectedStatus: 200,
    signal,
  })
}

export function getEvent(id, signal) {
  return request(`/api/eventos/${encodeURIComponent(id)}`, {
    expectedStatus: 200,
    signal,
  })
}

export function getEvents(signal) {
  return request('/api/eventos', { expectedStatus: 200, signal })
}

export function getSubtasks(eventId, signal) {
  return request(
    `/api/eventos/${encodeURIComponent(eventId)}/subtareas`,
    {
      expectedStatus: 200,
      signal,
    }
  )
}

export function createSubtask(eventId, subtask, signal) {
  return request(
    `/api/eventos/${encodeURIComponent(eventId)}/subtareas`,
    {
      ...jsonOptions('POST', subtask, signal),
      expectedStatus: 201,
    }
  )
}
