import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { capacityEditorReducer as reduce, capacityEditorState, saveDailyCapacity, validateDailyCapacity } from '../src/capacity.utils.js'

let server, CapacityPanel, CapacityForm, CapacitySaveNotice, Progreso
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'capacity-tests-no-remote-auth', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0capacity-test-auth'
    },
    load(id) {
      if (id === '\0capacity-test-auth') return "export const supabase = null; export const authConfigurationError = 'Prueba aislada';"
    },
  }] })
  ;({ default: CapacityPanel, CapacitySaveNotice } = await server.ssrLoadModule('/src/components/CapacityPanel.jsx'))
  ;({ default: CapacityForm } = await server.ssrLoadModule('/src/components/CapacityForm.jsx'))
  ;({ default: Progreso } = await server.ssrLoadModule('/src/pages/Progreso.jsx'))
})
after(async () => { await server?.close() })
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))

test('capacidad null muestra Sin configurar sin asignar un valor predeterminado', () => {
  const html = render(CapacityPanel, { capacity: null, onSave: async () => {} })
  assert.match(html, /Sin configurar/)
  assert.match(html, /Configurar capacidad/)
  assert.doesNotMatch(html, /\d+ h\/día/)
})

test('capacidad existente muestra exactamente el valor confirmado', () => {
  const html = render(CapacityPanel, { capacity: 1.5, onSave: async () => {} })
  assert.match(html, /1\.5 h\/día/)
  assert.match(html, /Se aplica a todos tus eventos/)
  assert.doesNotMatch(html, /Sin configurar/)
})

test('cero y negativos son inválidos', () => {
  for (const value of [0, '0', -1, '-0.5']) assert.equal(validateDailyCapacity(value).reason, 'not-positive')
})

test('vacío se distingue de un valor no numérico', () => {
  for (const value of ['', ' ', null, undefined]) assert.equal(validateDailyCapacity(value).reason, 'empty')
  for (const value of ['texto', '01:30', '0x10', true, [], {}]) assert.equal(validateDailyCapacity(value).reason, 'not-numeric')
})

test('valores no finitos no pueden guardarse', () => {
  for (const value of [NaN, Infinity, -Infinity, '1e999']) assert.equal(validateDailyCapacity(value).reason, 'not-finite')
  for (const value of ['NaN', 'Infinity']) assert.ok(validateDailyCapacity(value).error)
})

test('decimales positivos se convierten a número sin imponer máximo 24', () => {
  for (const value of [0.5, '1', '1.5', '8', '12', '25', '0.001']) {
    assert.equal(validateDailyCapacity(value).value, Number(value))
    assert.equal(validateDailyCapacity(value).error, '')
  }
})

test('cancelar descarta borrador y restaura valor previo o Sin configurar', () => {
  for (const capacity of [null, 1.5]) {
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
  let state = reduce(capacityEditorState(1), { type: 'edit' })
  state = reduce(state, { type: 'change', value: '1.5' })
  state = reduce(state, { type: 'saving' })
  const result = await saveDailyCapacity(state.draft, async () => { throw new Error('detalle privado') }, { current: false })
  state = reduce(state, { type: 'failed', error: result.error })
  assert.equal(state.confirmed, 1)
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
  resolve(1.5)
  assert.deepEqual(await first, { status: 'saved', value: 1.5 })
  assert.equal(lock.current, false)
})

test('guardado usa el valor de respuesta y rechaza confirmaciones inexistentes', async () => {
  assert.deepEqual(await saveDailyCapacity('8', async () => 7.5, { current: false }), { status: 'saved', value: 7.5 })
  for (const value of [undefined, null, '8', 0, NaN]) {
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
  const result = await saveDailyCapacity('1.5', async () => 1.5, { current: false })
  const state = reduce(capacityEditorState(null), { type: result.status, value: result.value })
  assert.equal(state.confirmed, 1.5)
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
  assert.doesNotMatch(html, /\bmax=/)
})

test('guardando bloquea campo, Guardar y Cancelar', () => {
  assert.equal((render(CapacityForm, { value: '1.5', saving: true }).match(/disabled=""/g) || []).length, 3)
  const state = reduce({ ...capacityEditorState(1), editing: true, saving: true, draft: '2' }, { type: 'cancel' })
  assert.equal(state.draft, '2')
  assert.equal(state.saving, true)
})

test('integración pendiente no simula capacidad ni ofrece escritura', () => {
  const html = render(CapacityPanel, { available: false })
  assert.match(html, /aún no está disponible/)
  assert.doesNotMatch(html, /Sin configurar|Configurar capacidad|<input|<button|\d+ h\/día/)
})

test('Progreso reserva capacidad antes del resumen incluso mientras este carga', () => {
  const html = render(Progreso)
  assert.ok(html.indexOf('Capacidad diaria') < html.indexOf('Cargando tu planificación'))
  assert.match(html, /aún no está disponible/)
  assert.doesNotMatch(html, /Sin configurar|Configurar capacidad|\d+ h\/día/)
})
