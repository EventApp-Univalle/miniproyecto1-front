import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MemoryRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { getCapacityImpact, requireDailyCapacity, saveDailyCapacity, capacityEditorState, capacityEditorReducer as reduce } from '../src/capacity.utils.js'
import { subtaskElementId, subtaskReviewPath, focusLinkedSubtask } from '../src/subtaskNavigation.utils.js'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const empty = { hasOverload: false, affectedDayCount: 0, affectedDays: [] }
const task = (n, event, title, hours) => ({ subtaskId: uuid(n), eventId: uuid(event), title, estimatedHours: hours })
const days = [
  { date: '2026-10-15', plannedHours: 5, limitHours: 4, excessHours: 1,
    tasks: [task(11, 1, 'Confirmar sonido', 2), task(12, 2, 'Preparar materiales', 3)] },
  { date: '2026-10-16', plannedHours: 5.5, limitHours: 4, excessHours: 1.5,
    tasks: [task(13, 1, 'Coordinar transporte', 2.5), task(14, 2, 'Revisar montaje', 3)] },
]
const capacity = impact => ({ dailyLimitHours: 4, defaultDailyLimitHours: 6, isDefault: false,
  ...(impact === undefined ? {} : { impact }) })
const overloaded = () => capacity({ hasOverload: true, affectedDayCount: 2, affectedDays: structuredClone(days) })
let server, Panel, Impact, Notice, Configuration, api
before(async () => {
  server = await createServer({ envDir: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'impact-tests-no-remote-auth', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0impact-test-auth'
    },
    load(id) {
      if (id === '\0impact-test-auth') return "export const authConfigurationError=''; export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-only-token'}}}),signOut:async()=>({error:null})}};"
    },
  }] })
  ;({ default: Panel, CapacitySaveNotice: Notice } = await server.ssrLoadModule('/src/components/CapacityPanel.jsx'))
  ;({ default: Impact } = await server.ssrLoadModule('/src/components/CapacityImpact.jsx'))
  ;({ ConfiguracionContent: Configuration } = await server.ssrLoadModule('/src/pages/Configuracion.jsx'))
  api = await server.ssrLoadModule('/src/api.js')
})
after(async () => { await server?.close() })
const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)))
async function withFetch(handler, run) {
  const previous = globalThis.fetch
  globalThis.fetch = handler
  try { return await run() } finally { globalThis.fetch = previous }
}

// Exercise the same API adapter, persistence confirmation and editor transitions
// used by Configuration; all HTTP responses are mocked, never Supabase writes.
async function save(response) {
  return withFetch(async (url, options) => {
    assert.match(url, /\/api\/configuracion\/capacidad$/)
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { dailyLimitHours: 4 })
    return Response.json(response)
  }, async () => {
    const result = await saveDailyCapacity('4', api.updateDailyCapacity, { current: false })
    return { result, state: reduce(capacityEditorState(null), { type: result.status, value: result.value }) }
  })
}

test('PATCH confirmado sin sobrecarga conserva éxito y análisis vacío conocido', async () => {
  const { result, state } = await save(capacity(empty))
  assert.equal(result.status, 'saved')
  assert.equal(state.notice, 'Capacidad diaria actualizada.')
  const html = render(Panel, { capacity: state.confirmed })
  assert.match(html, /4 h\/día/)
  assert.match(html, /No hay días con sobrecarga/)
  assert.doesNotMatch(html, /necesitan revisión|no está disponible/)
})

test('PATCH con sobrecarga sigue siendo guardado exitoso, sin cambiar subtareas', async () => {
  const response = overloaded(), original = structuredClone(response)
  const { result, state } = await save(response)
  assert.equal(result.status, 'saved')
  assert.ok(state.notice)
  assert.deepEqual(response, original)
  const html = render(Panel, { capacity: state.confirmed })
  assert.match(html, /2 días necesitan revisión/)
  assert.match(html, /ninguna se ha modificado automáticamente/)
  assert.match(render(Notice), /Capacidad diaria actualizada/)
})

test('GET posterior vuelve a mostrar advertencia del servidor sin depender del PATCH', async () => {
  let calls = 0
  await withFetch(async (url, options) => {
    calls++
    assert.match(url, /\/api\/configuracion\/capacidad$/)
    assert.equal(options.method, undefined)
    return Response.json(overloaded())
  }, async () => {
    const confirmed = requireDailyCapacity(await api.getDailyCapacity())
    const html = render(Configuration, { capacity: confirmed })
    assert.match(html, /2 días necesitan revisión/)
    assert.doesNotMatch(html, /Capacidad diaria actualizada/)
  })
  assert.equal(calls, 1)
})

test('varias fechas muestran totales, exceso y todas las subtareas implicadas', () => {
  const html = render(Impact, { capacity: overloaded() })
  for (const title of ['Confirmar sonido', 'Preparar materiales', 'Coordinar transporte', 'Revisar montaje']) assert.ok(html.includes(title))
  for (const text of ['Planificado', 'Límite diario', 'Exceso conjunto', '5,5 h', '1,5 h', '2,5 h estimadas']) assert.ok(html.includes(text))
  assert.equal((html.match(/Revisar subtarea<\/a>/g) || []).length, 4)
  assert.match(html, /contribuyen a una carga conjunta/)
  assert.doesNotMatch(html, /culpable|completada|cancelada/)
})

test('fechas ascendentes sin mutar los datos originales ni desplazar el calendario', () => {
  const response = overloaded()
  response.impact.affectedDays.reverse()
  const original = structuredClone(response)
  const html = render(Impact, { capacity: response })
  assert.ok(html.indexOf('15 de octubre de 2026') < html.indexOf('16 de octubre de 2026'))
  assert.deepEqual(response, original)
})

test('enlace dirige al evento y ancla de cada subtarea con nombre accesible', () => {
  const html = render(Impact, { capacity: overloaded() })
  for (const day of days) for (const task of day.tasks) {
    assert.ok(html.includes(`href="/evento/${task.eventId}#subtarea-${task.subtaskId}"`))
    assert.ok(html.includes(`aria-label="Revisar subtarea: ${task.title}"`))
  }
  assert.doesNotMatch(html, /<form|type="submit"/)
})

test('enlace codifica identificadores y no ejecuta llamadas de guardado', () => {
  assert.equal(subtaskReviewPath({ eventId: 'evento/otro', subtaskId: 'tarea?x' }), '/evento/evento%2Fotro#subtarea-tarea%3Fx')
  assert.equal(subtaskElementId(uuid(11)), `subtarea-${uuid(11)}`)
})

test('destino enfoca y desplaza solo la tarjeta vinculada cuando está disponible', () => {
  const calls = []
  const card = { classList: { contains: value => value === 'subtask-card' },
    focus: options => calls.push(['focus', options]), scrollIntoView: options => calls.push(['scroll', options]) }
  const root = { getElementById(id) { assert.equal(id, subtaskElementId(uuid(11))); return card } }
  assert.equal(focusLinkedSubtask(`#${subtaskElementId(uuid(11))}`, root), true)
  assert.deepEqual(calls, [['focus', { preventScroll: true }], ['scroll', { block: 'center' }]])
})

test('ancla ausente, inexistente, malformada o ajena no roba el foco', () => {
  const root = { getElementById() { return null } }
  for (const hash of ['', '#otro', '#subtarea-%', '#subtarea-inexistente']) assert.equal(focusLinkedSubtask(hash, root), false)
  assert.equal(focusLinkedSubtask('#subtarea-ajena', { getElementById: () => ({ classList: { contains: () => false } }) }), false)
})

test('volver después de resolver tareas reemplaza el impacto anterior por GET nuevo', async () => {
  let calls = 0
  await withFetch(async () => Response.json(++calls === 1 ? overloaded() : capacity(empty)), async () => {
    let state = capacityEditorState(await api.getDailyCapacity())
    assert.match(render(Panel, { capacity: state.confirmed }), /2 días necesitan revisión/)
    state = reduce(state, { type: 'source', value: await api.getDailyCapacity() })
    const html = render(Panel, { capacity: state.confirmed })
    assert.match(html, /No hay días con sobrecarga/)
    assert.doesNotMatch(html, /Confirmar sonido|necesitan revisión/)
  })
  assert.equal(calls, 2)
})

test('respuesta antigua sin impact conserva capacidad sin afirmar ausencia de sobrecarga', async () => {
  const { result, state } = await save(capacity())
  assert.equal(result.status, 'saved')
  const html = render(Panel, { capacity: state.confirmed })
  assert.match(html, /4 h\/día/)
  assert.match(html, /análisis de sobrecarga no está disponible/)
  assert.doesNotMatch(html, /No hay días con sobrecarga|necesitan revisión/)
  assert.equal(getCapacityImpact(state.confirmed), null)
})

test('GET antiguo sin impact tampoco inventa lista vacía', async () => {
  await withFetch(async () => Response.json(capacity()), async () => {
    const html = render(Configuration, { capacity: await api.getDailyCapacity() })
    assert.match(html, /análisis de sobrecarga no está disponible/)
    assert.doesNotMatch(html, /No hay días con sobrecarga/)
  })
})

test('impacto incompleto o contradictorio es desconocido, nunca un análisis parcial', () => {
  for (const mutate of [
    value => { value.impact = null },
    value => { value.impact.affectedDayCount = 3 },
    value => { value.impact.hasOverload = false },
    value => { value.impact.affectedDays[0].tasks = [] },
    value => { value.impact.affectedDays[0].tasks[0].title = null },
    value => { value.impact.affectedDays[0].tasks[0].estimatedHours = 0 },
    value => { value.impact.affectedDays[0].limitHours = 6 },
    value => { value.impact.affectedDays[0].date = '2026-02-30' },
    value => { value.impact.affectedDays[0].excessHours = Infinity },
    value => { value.impact.affectedDays[1] = value.impact.affectedDays[0] },
  ]) {
    const response = overloaded(); mutate(response)
    assert.equal(getCapacityImpact(response), null)
    const html = render(Panel, { capacity: response })
    assert.match(html, /análisis de sobrecarga no está disponible/)
    assert.doesNotMatch(html, /No hay días con sobrecarga|necesitan revisión/)
    assert.match(html, /4 h\/día/)
  }
})

test('GET fallido oculta análisis anterior, ofrece reintento y no anuncia éxito', async () => {
  let calls = 0
  await withFetch(async () => ++calls === 1 ? Response.json({}, { status: 500 }) : Response.json(overloaded()), async () => {
    await assert.rejects(api.getDailyCapacity(), { status: 500 })
    const html = render(Panel, { capacity: overloaded(), error: 'Error', onRetry() {} })
    assert.match(html, /Reintentar/)
    assert.doesNotMatch(html, /necesitan revisión|Capacidad diaria actualizada/)
    assert.match(render(Panel, { capacity: await api.getDailyCapacity() }), /2 días necesitan revisión/)
  })
})

test('PATCH fallido conserva límite confirmado, impacto y borrador sin anunciar éxito', async () => {
  const original = overloaded()
  let state = reduce(capacityEditorState(original), { type: 'edit' })
  state = reduce(state, { type: 'change', value: '3.5' })
  await withFetch(async () => Response.json({}, { status: 500 }), async () => {
    const result = await saveDailyCapacity(state.draft, api.updateDailyCapacity, { current: false })
    state = reduce(state, { type: 'failed', error: result.error })
    assert.equal(result.status, 'failed')
    assert.equal(state.draft, '3.5')
    assert.deepEqual(state.confirmed, original)
    assert.equal(state.notice, '')
  })
})

test('loading no presenta impacto previo como actual y mantiene anuncio accesible', () => {
  const html = render(Panel, { capacity: overloaded(), loading: true })
  assert.match(html, /Consultando tu capacidad diaria/)
  assert.match(html, /aria-busy="true"/)
  assert.doesNotMatch(html, /necesitan revisión|No hay días con sobrecarga/)
})

test('sobrecarga no evita el bloqueo de doble envío mientras se confirma el PATCH', async () => {
  let calls = 0, finish
  const pending = new Promise(resolve => { finish = resolve })
  const lock = { current: false }
  const onSave = async () => { calls++; return pending }
  const first = saveDailyCapacity('4', onSave, lock)
  assert.equal((await saveDailyCapacity('4', onSave, lock)).status, 'blocked')
  assert.equal(calls, 1)
  finish(overloaded())
  assert.equal((await first).status, 'saved')
  assert.equal(lock.current, false)
})

test('cancelar edición restaura el valor y el impacto confirmado sin escribir', () => {
  const confirmed = overloaded()
  let state = reduce(capacityEditorState(confirmed), { type: 'edit' })
  state = reduce(state, { type: 'change', value: '2' })
  state = reduce(state, { type: 'cancel' })
  assert.deepEqual(state, capacityEditorState(confirmed))
})

test('decimales pequeños del backend se muestran sin redondearlos a cero', () => {
  const response = overloaded()
  response.impact.affectedDays[0].plannedHours = 4.001
  response.impact.affectedDays[0].excessHours = 0.001
  response.impact.affectedDays[0].tasks[0].estimatedHours = 0.001
  const html = render(Impact, { capacity: response })
  assert.match(html, /4,001 h/)
  assert.match(html, /0,001 h/)
})

test('identificadores semánticos son únicos y la lista permite navegación por enlaces', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(React.Fragment, null,
    React.createElement(Impact, { capacity: overloaded() }), React.createElement(Impact, { capacity: overloaded() }))))
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(match[1]))
  assert.match(html, /<ol /)
  assert.match(html, /<dl /)
  assert.match(html, /<time dateTime="2026-10-15"/i)
  assert.doesNotMatch(html, /tabindex="-1"/)
})
