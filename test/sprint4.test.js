import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MemoryRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { saveExecution, validateExecution, requireEventProgress, todaySections } from '../src/execution.utils.js'
const original = { id: 'task', eventId: 'event', title: 'Confirmar sonido', targetDate: '2026-10-15', estimatedHours: 2,
  status: 'PENDING', executionNote: null, executionUpdatedAt: null }
const draft = { status: 'DONE', executionNote: ' Confirmado ' }
const confirmed = values => ({ ...original, ...values, executionUpdatedAt: '2026-10-15T15:00:00Z' })
const progress = (done = 2, total = 4) => ({ eventId: 'event', eventTitle: 'Encuentro cultural', doneCount: done, totalCount: total, progressPercent: total ? done / total * 100 : 0 })
let server, api, Editor, Form, Summary, Bar, Page, Card
before(async () => {
  server = await createServer({ envDir: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'sprint4-local-auth', enforce: 'pre',
    resolveId(source, importer) { if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0sprint4-auth' },
    load(id) { if (id === '\0sprint4-auth') return "export const authConfigurationError=''; export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-only-token'}}}),signOut:async()=>({})}};" },
  }] })
  api = await server.ssrLoadModule('/src/api.js')
  ;({ default: Editor, ExecutionForm: Form, ExecutionSummary: Summary } = await server.ssrLoadModule('/src/components/SubtaskExecutionEditor.jsx'))
  ;({ default: Bar } = await server.ssrLoadModule('/src/components/EventProgress.jsx'))
  ;({ ProgresoContent: Page } = await server.ssrLoadModule('/src/pages/Progreso.jsx'))
  ;({ TaskCard: Card } = await server.ssrLoadModule('/src/pages/Hoy.jsx'))
})
after(async () => { await server?.close() })
const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)))
async function withFetch(handler, run) {
  const old = globalThis.fetch; globalThis.fetch = handler
  try { return await run() } finally { globalThis.fetch = old }
}
for (const status of ['DONE', 'POSTPONED', 'PENDING']) test(`guardar ${status} envía solo ejecución y espera confirmación`, async () => {
  let payload
  const result = await saveExecution({ ...draft, status }, original, async values => {
    payload = values; return confirmed(values)
  }, { current: false })
  assert.deepEqual(payload, { status, executionNote: 'Confirmado' })
  assert.equal(result.status, 'saved')
  assert.equal(result.value.targetDate, original.targetDate)
  assert.equal(result.value.estimatedHours, original.estimatedHours)
})
test('nota vacía se envía como null para borrado explícito', async () => {
  const r = await saveExecution({ status: 'DONE', executionNote: ' ' }, original, async values => confirmed(values), { current: false })
  assert.equal(r.value.executionNote, null)
})
test('estados y notas inválidos no generan escrituras', async () => {
  let calls = 0
  for (const value of [{ status: 'BAD', executionNote: '' }, { status: 'DONE', executionNote: 4 }, { status: 'DONE', executionNote: 'x'.repeat(2001) }]) {
    assert.ok(Object.keys(validateExecution(value)).length)
    assert.equal((await saveExecution(value, original, async () => { calls++ }, { current: false })).status, 'invalid')
  }
  assert.equal(calls, 0)
})
test('error conserva el borrador de nota y estado y permite reintentar', async () => {
  const copy = structuredClone(draft)
  const lock = { current: false }
  const r = await saveExecution(draft, original, async () => { throw new Error('secreto') }, lock)
  assert.equal(r.status, 'failed'); assert.deepEqual(draft, copy); assert.equal(lock.current, false)
  assert.doesNotMatch(r.message, /secreto/)
  assert.equal((await saveExecution(draft, original, async values => confirmed(values), lock)).status, 'saved')
})
test('confirmación ausente o incorrecta nunca se anuncia como éxito', async () => {
  for (const row of [null, {}, confirmed({ status: 'POSTPONED' }), confirmed({ status: 'DONE', executionNote: 'otra nota' })]) {
    assert.equal((await saveExecution(draft, original, async () => row, { current: false })).status, 'failed')
  }
})
test('doble envío bloqueado hasta completar la misma escritura', async () => {
  let calls = 0, finish
  const pending = new Promise(resolve => { finish = resolve }), lock = { current: false }
  const save = async () => { calls++; return pending }
  const first = saveExecution(draft, original, save, lock)
  assert.equal((await saveExecution(draft, original, save, lock)).status, 'blocked'); assert.equal(calls, 1)
  finish(confirmed({ status: 'DONE', executionNote: 'Confirmado' }))
  assert.equal((await first).status, 'saved'); assert.equal(lock.current, false)
})
test('editor recupera nota previa, estado y cancelación sin escritura inicial', () => {
  let calls = 0
  const html = render(Editor, { subtask: { ...original, status: 'POSTPONED', executionNote: 'Esperando proveedor' }, onSave() { calls++ } })
  assert.match(html, /Esperando proveedor/)
  assert.match(html, /value="POSTPONED" selected=""/)
  assert.match(html, /Cancelar/); assert.equal(calls, 0)
})
test('formulario accesible bloquea select, nota y botones al guardar', () => {
  const html = render(Form, { id: 'execution', draft, title: 'Sonido', busy: true })
  assert.equal((html.match(/disabled=""/g) || []).length, 4)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /Guardando estado/)
  assert.match(html, /for="execution-note"/)
  assert.match(html, /for="execution-status"/)
  assert.match(html, /maxLength="2000"/i)
})
test('errores de nota y estado están asociados, y error permite reintento', () => {
  const html = render(Form, { id: 'execution', draft, title: 'Sonido', error: 'No pudimos guardar', fields: { executionNote: 'Revisa la nota', status: 'Revisa el estado' } })
  assert.match(html, /role="alert"/); assert.match(html, /Reintentar/)
  assert.match(html, /aria-describedby="execution-note-error"/)
  assert.match(html, /id="execution-status-error"/)
})
for (const status of ['PENDING', 'DONE', 'POSTPONED']) test(`resumen identifica ${status} con texto y nota, no solo color`, () => {
  const html = render(Summary, { subtask: confirmed({ status, executionNote: 'Traza logística' }) })
  assert.match(html, /Pendiente|Hecha|Pospuesta/); assert.match(html, /Traza logística/)
  assert.match(html, /Último cambio/); assert.match(html, /Bogotá/)
})
for (const [done, total, percent] of [[0, 0, 0], [2, 4, 50], [4, 4, 100]]) test(`barra y conteo ${percent} % desde datos confirmados`, () => {
  const html = render(Bar, { progress: progress(done, total) })
  assert.match(html, new RegExp(`>${percent} %<`))
  assert.match(html, new RegExp(`${done} de ${total} gestiones completadas`))
  assert.match(html, new RegExp(`<progress max="100" value="${percent}"`))
  if (!total) assert.match(html, /Añadir subtareas/)
  if (total && done === total) assert.match(html, /No hay tareas pendientes/)
})
test('progreso desconocido y loading no se convierten en cero falso', () => {
  const loading = render(Bar, { loading: true }), error = render(Bar, { error: 'Error', onRetry() {} })
  assert.match(loading, /role="status"/); assert.match(error, /Reintentar progreso/)
  assert.doesNotMatch(loading + error, /<progress/)
  assert.throws(() => requireEventProgress({ ...progress(), progressPercent: 70 }))
})
test('vista Progreso conserva estructura y muestra barras reales por evento', () => {
  const html = render(Page, { summary: { referenceDate: '2026-10-15', eventCount: 1, taskCount: 0, estimatedHours: 0, sections: [], eventProgress: [progress()] } })
  assert.match(html, /Avance por evento/); assert.match(html, /50 %/)
  assert.match(html, /Tu capacidad diaria se administra desde Configuración/)
  assert.doesNotMatch(html, /estarán disponibles posteriormente/)
})
test('Hoy separa estados sin reagrupar ni ordenar los arrays del backend', () => {
  const p = [{ id: '3' }, { id: '1' }], done = [{ id: 'done' }], postponed = [{ id: 'postponed' }]
  const groups = { overdue: [], today: p, upcoming: [], done, postponed }
  assert.equal(todaySections(groups)[1].tasks, p)
  assert.equal(todaySections(groups, 'DONE')[0].tasks, done)
  assert.equal(todaySections(groups, 'POSTPONED')[0].tasks, postponed)
  assert.equal(todaySections(groups).flatMap(g => g.tasks).some(t => t.id === 'done'), false)
})
test('tarjeta de Hoy incluye estado y enlace a la subtarea sin mutarla', () => {
  const row = { ...original, status: 'POSTPONED', executionNote: 'Esperando', eventTitle: 'Evento' }, before = structuredClone(original)
  const html = render(Card, { task: row })
  assert.match(html, /Pospuesta/); assert.match(html, /href="\/evento\/event#subtarea-task"/)
  assert.deepEqual(original, before)
})
test('API ejecución envía Bearer al endpoint dedicado y no planificación', async () => {
  await withFetch(async (url, options) => {
    assert.match(url, /\/api\/eventos\/event\/subtareas\/task\/ejecucion$/)
    assert.equal(options.method, 'PATCH'); assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.deepEqual(JSON.parse(options.body), { status: 'DONE', executionNote: 'Confirmado' })
    return Response.json(confirmed({ status: 'DONE', executionNote: 'Confirmado' }))
  }, async () => assert.equal((await saveExecution(draft, original, values => api.updateSubtaskExecution('event', 'task', values), { current: false })).status, 'saved'))
})
test('GET posterior de progreso refleja cambios persistidos y no inicia escrituras', async () => {
  let done = 0, writes = 0
  await withFetch(async (url, options) => {
    if (url.endsWith('/ejecucion')) { writes++; done++; return Response.json(confirmed({ status: 'DONE', executionNote: 'Confirmado' })) }
    assert.equal(options.method, undefined)
    return Response.json(url.endsWith('/api/progreso') ? [progress(done, 4)] : progress(done, 4))
  }, async () => {
    assert.equal((await api.getEventProgress('event')).progressPercent, 0)
    await saveExecution(draft, original, values => api.updateSubtaskExecution('event', 'task', values), { current: false })
    assert.equal((await api.getEventProgress('event')).progressPercent, 25)
    assert.equal((await api.getProgress())[0].doneCount, 1)
  })
  assert.equal(writes, 1)
})
test('401 conserva expiración global de sesión; 409 de reactivación no es éxito', async () => {
  const previous = globalThis.window; let expired = 0
  globalThis.window = { dispatchEvent() { expired++ } }
  try {
    await withFetch(async () => Response.json({}, { status: 401 }), async () => {
      const result = await saveExecution(draft, original, values => api.updateSubtaskExecution('event', 'task', values), { current: false })
      assert.equal(result.status, 'failed'); assert.match(result.message, /sesión/); assert.equal(expired, 1)
    })
    const result = await saveExecution(draft, original, async () => { throw { status: 409 } }, { current: false })
    assert.equal(result.status, 'failed'); assert.match(result.message, /fecha u horas/)
  } finally { globalThis.window = previous }
})
