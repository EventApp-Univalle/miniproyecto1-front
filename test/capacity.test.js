import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MemoryRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { capacityEditorReducer as reduce, capacityEditorState, saveDailyCapacity, validateDailyCapacity, requireDailyCapacity } from '../src/capacity.utils.js'

let server, CapacityPanel, CapacityForm, CapacitySaveNotice, Progreso, ProgresoContent, api
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'capacity-tests-no-remote-auth', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0capacity-test-auth'
    },
    load(id) {
      if (id === '\0capacity-test-auth') return "export const authConfigurationError = ''; export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-only-token' } } }), signOut: async () => ({ error: null }) } };"
    },
  }] })
  ;({ default: CapacityPanel, CapacitySaveNotice } = await server.ssrLoadModule('/src/components/CapacityPanel.jsx'))
  ;({ default: CapacityForm } = await server.ssrLoadModule('/src/components/CapacityForm.jsx'))
  ;({ default: Progreso, ProgresoContent } = await server.ssrLoadModule('/src/pages/Progreso.jsx'))
  api = await server.ssrLoadModule('/src/api.js')
})
after(async () => { await server?.close() })
const custom = hours => ({ dailyLimitHours: hours, defaultDailyLimitHours: 6, isDefault: false })
const defaultCapacity = { dailyLimitHours: 6, defaultDailyLimitHours: 6, isDefault: true }
const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)))

test('predeterminado muestra respuesta efectiva y ofrece Personalizar', () => {
  const html = render(CapacityPanel, { capacity: defaultCapacity, onSave: async () => {} })
  assert.match(html, /6 h\/día/)
  assert.match(html, /Predeterminado/)
  assert.match(html, /Este es tu límite predeterminado/)
  assert.match(html, /Personalizar/)
  assert.doesNotMatch(html, /Sin configurar/)
})

test('capacidad existente muestra exactamente el valor confirmado', () => {
  const html = render(CapacityPanel, { capacity: custom(1.5), onSave: async () => {} })
  assert.match(html, /1\.5 h\/día/)
  assert.match(html, /Se aplica a todos tus eventos/)
  assert.match(html, /Personalizado/)
  assert.match(html, /Editar/)
  assert.doesNotMatch(html, /Sin configurar/)
})

test('cero y negativos son inválidos', () => {
  for (const value of [0, '0', -1, '-0.5', 0.5, 0.999, 24.001, 25]) assert.equal(validateDailyCapacity(value).reason, 'out-of-range')
})

test('vacío se distingue de un valor no numérico', () => {
  for (const value of ['', ' ', null, undefined]) assert.equal(validateDailyCapacity(value).reason, 'empty')
  for (const value of ['texto', '01:30', '0x10', true, [], {}]) assert.equal(validateDailyCapacity(value).reason, 'not-numeric')
})

test('valores no finitos no pueden guardarse', () => {
  for (const value of [NaN, Infinity, -Infinity, '1e999']) assert.equal(validateDailyCapacity(value).reason, 'not-finite')
  for (const value of ['NaN', 'Infinity']) assert.ok(validateDailyCapacity(value).error)
})

test('rango inclusivo 1–24 admite decimales', () => {
  for (const value of ['1', '1.5', '6', '8', '12', '23.5', '24']) {
    assert.equal(validateDailyCapacity(value).value, Number(value))
    assert.equal(validateDailyCapacity(value).error, '')
  }
})

test('cancelar descarta borrador y restaura respuesta confirmada', () => {
  for (const capacity of [defaultCapacity, custom(1.5)]) {
    let state = reduce(capacityEditorState(capacity), { type: 'edit' })
    state = reduce(state, { type: 'change', value: '12' })
    state = reduce(state, { type: 'cancel' })
    assert.deepEqual(state, capacityEditorState(capacity))
  }
})

test('error de carga y fuente desconocida no se confunden con capacidad null', () => {
  for (const props of [{ capacity: null, error: 'Fallo técnico' }, {}]) {
    const html = render(CapacityPanel, props)
    assert.match(html, /No pudimos consultar tu capacidad/)
    assert.match(html, /role="alert"/)
    assert.doesNotMatch(html, /Sin configurar/)
  }
})

test('fallo de guardado conserva borrador y último valor confirmado', async () => {
  let state = reduce(capacityEditorState(custom(1)), { type: 'edit' })
  state = reduce(state, { type: 'change', value: '1.5' })
  state = reduce(state, { type: 'saving' })
  const result = await saveDailyCapacity(state.draft, async () => { throw new Error('detalle privado') }, { current: false })
  state = reduce(state, { type: 'failed', error: result.error })
  assert.deepEqual(state.confirmed, custom(1))
  assert.equal(state.draft, '1.5')
  assert.equal(state.editing, true)
  assert.equal(state.saving, false)
  assert.doesNotMatch(state.saveError, /detalle privado/)
  const html = render(CapacityForm, { value: state.draft, saveError: state.saveError })
  assert.match(html, /value="1\.5"/)
  assert.match(html, /Reintentar/)
})

test('dos envíos simultáneos generan una sola llamada a la fuente', async () => {
  let calls = 0, resolve
  const pending = new Promise(done => { resolve = done })
  const lock = { current: false }
  const onSave = async hours => { calls++; assert.equal(hours, 1.5); return pending }
  const first = saveDailyCapacity('1.5', onSave, lock)
  assert.equal(lock.current, true)
  assert.deepEqual(await saveDailyCapacity('1.5', onSave, lock), { status: 'blocked' })
  assert.equal(calls, 1)
  resolve(custom(1.5))
  assert.deepEqual(await first, { status: 'saved', value: custom(1.5) })
  assert.equal(lock.current, false)
})

test('guardado usa el valor de respuesta y rechaza confirmaciones inexistentes', async () => {
  assert.deepEqual(await saveDailyCapacity('8', async () => custom(7.5), { current: false }), { status: 'saved', value: custom(7.5) })
  for (const value of [undefined, null, '8', 0, NaN, {}, custom(25), { ...defaultCapacity, dailyLimitHours: 8 }]) {
    const lock = { current: false }
    assert.equal((await saveDailyCapacity('8', async () => value, lock)).status, 'failed')
    assert.equal(lock.current, false)
  }
})

test('capacidad inválida no llama a la fuente de escritura', async () => {
  let calls = 0
  for (const value of ['', 0, -1, 'no-numérico']) {
    const result = await saveDailyCapacity(value, async () => { calls++ }, { current: false })
    assert.equal(result.status, 'invalid')
  }
  assert.equal(calls, 0)
})

test('loading es local al panel y se anuncia sin mostrar Sin configurar', () => {
  const html = render(CapacityPanel, { loading: true })
  assert.match(html, /Consultando tu capacidad diaria/)
  assert.match(html, /role="status"/)
  assert.match(html, /aria-busy="true"/)
  assert.doesNotMatch(html, /Sin configurar/)
})

test('éxito se produce después de confirmación y se anuncia accesiblemente', async () => {
  const result = await saveDailyCapacity('1.5', async () => custom(1.5), { current: false })
  const state = reduce(capacityEditorState(null), { type: result.status, value: result.value })
  assert.deepEqual(state.confirmed, custom(1.5))
  assert.equal(state.editing, false)
  assert.equal(state.notice, 'Capacidad diaria actualizada.')
  assert.match(render(CapacitySaveNotice), /role="status"[\s\S]*Capacidad diaria actualizada/)
})

test('labels, ayuda y errores se asocian al input con IDs únicos por instancia', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(CapacityForm, { value: '', fieldError: 'La capacidad diaria es obligatoria.' }),
    React.createElement(CapacityForm, { value: '1.5' })))
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const match of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(match[1]))
  for (const match of html.matchAll(/aria-describedby="([^"]+)"/g)) {
    for (const id of match[1].split(' ')) assert.ok(ids.includes(id))
  }
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /type="number"[\s\S]*step="any"/)
  assert.match(html, /min="1" max="24"/)
})

test('guardando bloquea campo, Guardar y Cancelar', () => {
  assert.equal((render(CapacityForm, { value: '1.5', saving: true }).match(/disabled=""/g) || []).length, 3)
  const state = reduce({ ...capacityEditorState(custom(1)), editing: true, saving: true, draft: '2' }, { type: 'cancel' })
  assert.equal(state.draft, '2')
  assert.equal(state.saving, true)
})

test('datos ausentes o inconsistentes son error, nunca default local', () => {
  for (const capacity of [null, undefined, {}, custom(25)]) {
    assert.throws(() => requireDailyCapacity(capacity))
    const html = render(CapacityPanel, { capacity })
    assert.match(html, /No pudimos consultar tu capacidad/)
    assert.doesNotMatch(html, /Sin configurar|6 h\/día/)
  }
})

test('Progreso reserva capacidad antes del resumen incluso mientras este carga', () => {
  const html = render(Progreso)
  assert.ok(html.indexOf('Capacidad diaria') < html.indexOf('Cargando tu planificación'))
  assert.match(html, /Consultando tu capacidad diaria/)
  assert.doesNotMatch(html, /Sin configurar|Configurar capacidad|\d+ h\/día/)
})

async function withFetch(handler, run) {
  const previous = globalThis.fetch
  globalThis.fetch = handler
  try { return await run() } finally { globalThis.fetch = previous }
}

test('GET capacidad usa Bearer, signal y conserva default completo', async () => {
  const controller = new AbortController()
  await withFetch(async (url, options) => {
    assert.match(url, /\/api\/configuracion\/capacidad$/)
    assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.equal(options.signal, controller.signal)
    return Response.json(defaultCapacity)
  }, async () => assert.deepEqual(await api.getDailyCapacity(controller.signal), defaultCapacity))
})

test('PATCH envía número JSON y usa objeto confirmado, no borrador', async () => {
  await withFetch(async (url, options) => {
    assert.match(url, /\/api\/configuracion\/capacidad$/)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { dailyLimitHours: 8 })
    return Response.json(custom(7.5))
  }, async () => {
    const result = await saveDailyCapacity('8', api.updateDailyCapacity, { current: false })
    assert.deepEqual(result, { status: 'saved', value: custom(7.5) })
    assert.equal(result.value.isDefault, false)
  })
})

test('GET fallido puede reintentarse sin sustituir capacidad por default', async () => {
  let calls = 0
  await withFetch(async () => ++calls === 1
    ? Response.json({ error: { code: 'INTERNAL_ERROR', message: 'No disponible' } }, { status: 500 })
    : Response.json(defaultCapacity), async () => {
    await assert.rejects(api.getDailyCapacity(), { status: 500 })
    assert.deepEqual(await api.getDailyCapacity(), defaultCapacity)
    assert.equal(calls, 2)
  })
})

test('error GET de capacidad no impide mostrar resumen real', () => {
  const html = render(ProgresoContent, { capacityError: 'Error', loading: false,
    summary: { referenceDate: '2026-10-06', eventCount: 1, taskCount: 1, estimatedHours: 2,
      sections: [{ key: 'today', label: 'Para hoy', count: 1 }] } })
  assert.match(html, /No pudimos consultar tu capacidad/)
  assert.match(html, /Resumen de planificación/)
  assert.match(html, /2 h/)
  assert.doesNotMatch(html, /No pudimos cargar el resumen/)
})

test('400 de PATCH muestra validación comprensible y conserva borrador', async () => {
  await withFetch(async () => Response.json({ error: { code: 'VALIDATION_ERROR', message: 'detalle técnico' } }, { status: 400 }), async () => {
    const result = await saveDailyCapacity('8', api.updateDailyCapacity, { current: false })
    assert.equal(result.status, 'failed')
    assert.match(result.error, /entre 1 y 24/)
    assert.doesNotMatch(result.error, /detalle técnico/)
    const state = reduce({ ...capacityEditorState(defaultCapacity), draft: '8', editing: true }, { type: 'failed', error: result.error })
    assert.equal(state.draft, '8')
    assert.deepEqual(state.confirmed, defaultCapacity)
  })
})

test('GET y PATCH exigen 200, no anuncian éxito ante 201', async () => {
  await withFetch(async () => Response.json(custom(8), { status: 201 }), async () => {
    await assert.rejects(api.getDailyCapacity(), { code: 'UNEXPECTED_STATUS' })
    assert.equal((await saveDailyCapacity('8', api.updateDailyCapacity, { current: false })).status, 'failed')
  })
})

test('401 de capacidad mantiene evento de sesión vencida y ApiError existente', async () => {
  const previousWindow = globalThis.window
  let expired = 0
  globalThis.window = { dispatchEvent(event) { assert.equal(event.type, 'eventapp:session-expired'); expired++ } }
  try {
    await withFetch(async () => Response.json({}, { status: 401 }), async () => {
      await assert.rejects(api.getDailyCapacity(), { status: 401, code: 'INVALID_TOKEN' })
      await assert.rejects(api.updateDailyCapacity(8), { status: 401, code: 'INVALID_TOKEN' })
      assert.equal(expired, 2)
    })
  } finally { globalThis.window = previousWindow }
})

test('GET abortado conserva AbortError y no es reemplazado por valor predeterminado', async () => {
  await withFetch(async () => { throw new DOMException('Cancelado', 'AbortError') }, async () => {
    await assert.rejects(api.getDailyCapacity(), { name: 'AbortError' })
  })
})
