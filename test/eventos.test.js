import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import { validateSubtask } from '../src/subtasks.utils.js'
import { validateEventForm, eventChanges } from '../src/events.utils.js'

let server, App, AuthContext, Navigation, EventosContent, getEvents, SubtaskForm, CrearEvento, EventActions, SubtaskActions, EventEditor, SubtaskEditor, crudApi, crudActions
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
  ;({ SubtaskForm, EventActions, SubtaskActions, SubtaskEditor } = await server.ssrLoadModule('/src/pages/DetalleEvento.jsx'))
  ;({ default: CrearEvento } = await server.ssrLoadModule('/src/pages/CrearEvento.jsx'))
  ;({ default: EventEditor } = await server.ssrLoadModule('/src/components/EventEditor.jsx'))
  crudApi = await server.ssrLoadModule('/src/api.js')
  crudActions = await server.ssrLoadModule('/src/crud.actions.js')
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

test('crear y editar subtarea simultáneamente conservan IDs únicos y labels asociados', () => {
  const props = {
    referenceDate: '2026-10-03', eventDate: '2026-10-15',
    formData: { title: '', targetDate: '', estimatedHours: '' },
    fieldErrors: { title: 'Escribe un título.' }, submitError: '', isSubmitting: false,
    onChange: () => {}, onSubmit: () => {},
  }
  const html = render(React.createElement(React.Fragment, null,
    React.createElement(SubtaskForm, props),
    React.createElement(SubtaskForm, { ...props, editing: true }),
  ))
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
  for (const match of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(match[1]))
  assert.match(html, /aria-describedby="edit-subtask-title-error"/)
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

test('detalle ofrece controles de editar/eliminar evento y subtarea', () => {
  const eventHtml = render(React.createElement(EventActions, { busy: false }))
  const taskHtml = render(React.createElement(SubtaskActions, { busy: false }))
  assert.match(eventHtml, /Editar evento/)
  assert.match(eventHtml, /Eliminar evento/)
  assert.match(taskHtml, />Editar</)
  assert.match(taskHtml, />Eliminar</)
  const pending = render(React.createElement(EventActions, { busy: true, deleting: true }))
  assert.match(pending, /Eliminando/)
  assert.equal((pending.match(/disabled=""/g) || []).length, 2)
})

test('edición evento muestra campos actuales, guardar y cancelar', () => {
  const html = render(React.createElement(EventEditor, { event, onSave: async () => {}, onCancel: () => {} }))
  assert.match(html, /value="Evento sin subtareas"/)
  assert.match(html, /value="Cultural"/)
  assert.match(html, /Guardar cambios/)
  assert.match(html, /Cancelar/)
})

test('PATCH frontend envía solo diferencias y conserva fecha histórica omitida', () => {
  const old = { ...event, date: '2026-10-01' }
  const form = { title: 'Nuevo', type: old.type, date: old.date, time: '', location: '', description: '', isPriority: false }
  assert.deepEqual(validateEventForm(form, '2026-10-03', old.date), {})
  assert.deepEqual(eventChanges(form, old), { title: 'Nuevo' })
  assert.ok(validateEventForm({ ...form, date: '2026-10-02' }, '2026-10-03', old.date).date)
})

test('subtarea vencida conserva fecha al editar título o esfuerzo pero valida cambios', () => {
  const form = { title: 'Nuevo', targetDate: '2026-10-01', estimatedHours: '1.5' }
  assert.deepEqual(validateSubtask(form, '2026-10-02', '2026-10-03', '2026-10-01'), {})
  assert.ok(validateSubtask({ ...form, targetDate: '2026-10-02' }, '2026-10-15', '2026-10-03', '2026-10-01').targetDate)
  assert.ok(validateSubtask({ ...form, targetDate: '2026-10-16' }, '2026-10-15', '2026-10-03', '2026-10-01').targetDate)
})

test('editor de subtarea vencida permanece habilitado en evento pasado', () => {
  const html = render(React.createElement(SubtaskEditor, {
    subtask: { title: 'Histórica', targetDate: '2026-10-01', estimatedHours: 1 },
    eventDate: '2026-10-02', onSave: async () => {}, onCancel: () => {},
  }))
  assert.match(html, /Editar subtarea/)
  assert.match(html, /value="2026-10-01"/)
  assert.match(html, /Guardar cambios/)
  assert.doesNotMatch(html, /disabled=""/)
})

test('las cuatro funciones API CRUD usan método, ruta, JSON y Bearer correctos', async () => {
  const originalFetch = globalThis.fetch
  const cases = [
    ['updateEvent', ['event-id', { title: 'Nuevo' }], 'PATCH', '/api/eventos/event-id'],
    ['deleteEvent', ['event-id'], 'DELETE', '/api/eventos/event-id'],
    ['updateSubtask', ['event-id', 'task-id', { estimatedHours: 0.5 }], 'PATCH', '/api/eventos/event-id/subtareas/task-id'],
    ['deleteSubtask', ['event-id', 'task-id'], 'DELETE', '/api/eventos/event-id/subtareas/task-id'],
  ]
  try {
    for (const [name, args, method, path] of cases) {
      let called = false
      globalThis.fetch = async (url, options) => {
        called = true
        assert.ok(url.endsWith(path))
        assert.equal(options.method, method)
        assert.equal(options.headers.Authorization, 'Bearer test-only-token')
        if (method === 'PATCH') assert.deepEqual(JSON.parse(options.body), args.at(-1))
        else assert.equal(options.body, undefined)
        return new Response(JSON.stringify({ id: 'result' }), { status: 200 })
      }
      await crudApi[name](...args)
      assert.equal(called, true)
    }
  } finally { globalThis.fetch = originalFetch }
})

test('cancelar confirmación no elimina ni actualiza UI', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('No debería consultarse') }
  let updated = false
  try {
    assert.equal(await crudActions.confirmSubtaskDeletion('e', 's', () => { updated = true }, () => false), false)
    assert.equal(await crudActions.confirmEventDeletion('e', 0, () => { updated = true }, () => false), false)
    assert.equal(updated, false)
  } finally { globalThis.fetch = originalFetch }
})

test('confirmar eliminación actualiza lista y contador solo tras respuesta exitosa', async () => {
  const originalFetch = globalThis.fetch
  let tasks = [{ id: 's' }, { id: 'other' }]
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 's', deleted: true }), { status: 200 })
  try {
    assert.equal(await crudActions.confirmSubtaskDeletion('e', 's', id => { tasks = tasks.filter(t => t.id !== id) }, () => true), true)
    assert.deepEqual(tasks, [{ id: 'other' }])
    assert.equal(tasks.length, 1)
  } finally { globalThis.fetch = originalFetch }
})

test('eliminar evento con subtareas se bloquea antes de confirmar o consultar', async () => {
  await assert.rejects(() => crudActions.confirmEventDeletion('e', 1, () => {}, () => { throw new Error('No debería confirmar') }), /Primero elimina las subtareas/)
})

test('fallo de eliminación conserva la UI y permite mostrar error', async () => {
  const originalFetch = globalThis.fetch
  let updated = false
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'No fue posible eliminar.' } }), { status: 500 })
  try {
    await assert.rejects(() => crudActions.confirmSubtaskDeletion('e', 's', () => { updated = true }, () => true), /No fue posible eliminar/)
    assert.equal(updated, false)
  } finally { globalThis.fetch = originalFetch }
})

test('PATCH propaga conflicto de fecha con mensaje y campo del backend', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: {
    code: 'VALIDATION_ERROR', message: 'Hay subtareas con fecha posterior a la nueva fecha del evento.',
    fields: { date: 'Hay subtareas posteriores.' },
  } }), { status: 400 })
  try {
    await assert.rejects(() => crudApi.updateEvent('event-id', { date: '2026-10-09' }), error => {
      assert.equal(error.status, 400)
      assert.equal(error.fields.date, 'Hay subtareas posteriores.')
      assert.match(error.message, /subtareas/)
      return true
    })
  } finally { globalThis.fetch = originalFetch }
})
