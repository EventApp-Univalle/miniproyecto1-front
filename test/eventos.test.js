import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import { validateEventForm } from '../src/events.utils.js'

let server, App, AuthContext, Navigation, EventosContent, getEvents, SubtaskForm, CrearEvento
const event = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Evento sin subtareas', type: 'Cultural', date: '2026-10-15',
  time: null, location: null, description: null, isPriority: false,
  createdAt: '2026-10-01T12:00:00Z',
}

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    plugins: [{
      name: 'test-auth-session',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0test-supabase'
      },
      load(id) {
        if (id === '\0test-supabase') return `
          export const authConfigurationError = '';
          export const supabase = { auth: {
            getSession: async () => ({ data: { session: { access_token: 'test-only-token' } }, error: null })
          } };`
      },
    }],
  })
  ;({ default: App } = await server.ssrLoadModule('/src/App.jsx'))
  ;({ AuthContext } = await server.ssrLoadModule('/src/auth.js'))
  ;({ default: Navigation } = await server.ssrLoadModule('/src/components/Navigation.jsx'))
  ;({ EventosContent } = await server.ssrLoadModule('/src/pages/Eventos.jsx'))
  ;({ getEvents } = await server.ssrLoadModule('/src/api.js'))
  ;({ SubtaskForm } = await server.ssrLoadModule('/src/pages/DetalleEvento.jsx'))
  ;({ default: CrearEvento } = await server.ssrLoadModule('/src/pages/CrearEvento.jsx'))
})
after(async () => { await server?.close() })

function render(component, route = '/eventos') {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, component))
}

test('Navigation enlaza Eventos a /eventos y lo marca activo', () => {
  const html = render(React.createElement(Navigation))
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/eventos"[^>]*>[\s\S]*?Eventos<\/span>/)
})

test('App resuelve /eventos con sesión y renderiza la página Eventos, sin caer en Hoy', () => {
  const html = render(React.createElement(AuthContext.Provider, {
    value: { session: { user: { id: 'test-user' } }, loading: false },
  }, React.createElement(App)))
  assert.match(html, /Cargando tus eventos/)
  assert.doesNotMatch(html, /Cargando tus tareas/)
})

test('getEvents consulta /api/eventos con Bearer y conserva eventos sin subtareas', async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  let called = false
  globalThis.fetch = async (url, options) => {
    called = true
    assert.match(url, /\/api\/eventos$/)
    assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.equal(options.signal, controller.signal)
    return new Response(JSON.stringify([event]), { status: 200 })
  }
  try {
    assert.deepEqual(await getEvents(controller.signal), [event])
    assert.equal(called, true)
  } finally { globalThis.fetch = originalFetch }
})

test('el listado renderiza un evento sin información de subtareas y enlaza su detalle', () => {
  const html = render(React.createElement(EventosContent, { events: [event] }))
  assert.match(html, /Evento sin subtareas/)
  assert.match(html, /Cultural/)
  assert.match(html, /2026-10-15/)
  assert.match(html, new RegExp(`href="/evento/${event.id}"`))
  assert.match(html, /Ver evento/)
})

test('el listado vacío ofrece Crear evento', () => {
  const html = render(React.createElement(EventosContent, { events: [] }))
  assert.match(html, /Aún no tienes eventos\./)
  assert.match(html, /href="\/crear"/)
})

function renderSubtaskForm(eventDate = '2026-10-15') {
  return render(React.createElement(SubtaskForm, {
    referenceDate: '2026-10-03', eventDate,
    formData: { title: '', targetDate: '', estimatedHours: '' },
    fieldErrors: {}, submitError: '', isSubmitting: false,
    onChange: () => {}, onSubmit: () => {},
  }))
}

test('formulario de subtarea usa horas decimales y límites de fecha del evento', () => {
  const html = renderSubtaskForm()
  assert.match(html, /Horas estimadas/)
  assert.match(html, /<input[^>]*id="estimatedHours"[^>]*type="number"[^>]*min="0"[^>]*step="any"[^>]*placeholder="Ej: 1.5"/)
  assert.match(html, /<input[^>]*id="targetDate"[^>]*min="2026-10-03"[^>]*max="2026-10-15"/)
  assert.doesNotMatch(html, /type="time"|HH:mm|disabled=""/)
})

test('evento pasado deshabilita campos y creación con un mensaje claro', () => {
  const html = renderSubtaskForm('2026-10-02')
  assert.match(html, /El evento ya pasó/)
  assert.equal((html.match(/disabled=""/g) || []).length, 4)
})

test('evento fechado hoy aún permite crear subtareas para hoy', () => {
  const html = renderSubtaskForm('2026-10-03')
  assert.match(html, /min="2026-10-03" max="2026-10-03"/)
  assert.doesNotMatch(html, /disabled=""|El evento ya pasó/)
})

test('Crear evento fija min en hoy Bogotá incluso cuando UTC está en el día siguiente', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-03T04:59:59Z') })
  const html = render(React.createElement(CrearEvento), '/crear')
  assert.match(html, /<input[^>]*id="date"[^>]*type="date"[^>]*min="2026-10-02"/)
})

test('validación de Crear evento acepta hoy y cualquier fecha futura', () => {
  for (const date of ['2026-10-03', '2030-01-01']) {
    assert.deepEqual(validateEventForm({ title: 'Encuentro', type: 'Cultural', date }, '2026-10-03'), {})
  }
})

test('validación de Crear evento rechaza fecha pasada con mensaje claro', () => {
  const fields = validateEventForm({ title: 'Encuentro', type: 'Cultural', date: '2026-10-02' }, '2026-10-03')
  assert.equal(fields.date, 'La fecha del evento no puede ser anterior a hoy.')
})
