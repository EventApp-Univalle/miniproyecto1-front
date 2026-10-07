import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { capacityConflictDetails, subtaskChanges, saveSubtaskEdit, cancelCapacityConflict, containConflictFocus } from '../src/subtaskEdit.utils.js'

let server, api, Dialog
const original = { id: 'task', title: 'Sonido', targetDate: '2026-10-12', estimatedHours: 1 }
const draft = { title: 'Sonido nuevo', targetDate: '2026-10-15', estimatedHours: '2.5' }
const details = { targetDate: '2026-10-15', totalHours: 8.5, limitHours: 6 }
const conflictError = value => ({ status: 409, code: 'DAILY_CAPACITY_EXCEEDED', details: value, message: '409 DAILY_CAPACITY_EXCEEDED' })
const run = (onSave, data = draft, extra = {}) => saveSubtaskEdit({ draft: data, original,
  eventDate: '2026-10-20', referenceDate: '2026-10-06', onSave, lock: { current: false }, ...extra })
const render = (props = {}) => renderToStaticMarkup(React.createElement(Dialog,
  { details: capacityConflictDetails(details), draft, eventDate: '2026-10-20', referenceDate: '2026-10-06', ...props }))

before(async () => {
  server = await createServer({ envDir: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'conflict-test-auth', enforce: 'pre',
    resolveId(source, importer) { if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0conflict-test-session' },
    load(id) { if (id === '\0conflict-test-session') return `export const authConfigurationError=''; export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-only-token'}}}),signOut:async()=>({})}};` },
  }] })
  api = await server.ssrLoadModule('/src/api.js')
  ;({ default: Dialog } = await server.ssrLoadModule('/src/components/CapacityConflictDialog.jsx'))
})
after(async () => { await server?.close() })
async function mockFetch(handler, callback) {
  const previous = globalThis.fetch; globalThis.fetch = handler
  try { return await callback() } finally { globalThis.fetch = previous }
}

test('ApiError conserva details además de fields, status y code', () => {
  const error = new api.ApiError('Error', { status: 409, code: 'DAILY_CAPACITY_EXCEEDED', fields: { title: 'Campo' }, details })
  assert.deepEqual(error.details, details); assert.equal(error.status, 409); assert.equal(error.fields.title, 'Campo')
})
test('request conserva details recibidos en PATCH 409', async () => {
  await mockFetch(async () => Response.json({ error: conflictError(details) }, { status: 409 }), async () => {
    await assert.rejects(api.updateSubtask('event', 'task', draft), error => {
      assert.deepEqual(error.details, details); assert.equal(error.code, 'DAILY_CAPACITY_EXCEEDED'); return true
    })
  })
})
test('PATCH 200 conserva ruta, método, Bearer y respuesta actualizada', async () => {
  const updated = { ...original, ...draft, estimatedHours: 2.5 }
  await mockFetch(async (url, options) => {
    assert.match(url, /\/api\/eventos\/event\/subtareas\/task$/)
    assert.equal(options.method, 'PATCH'); assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    return Response.json(updated)
  }, async () => assert.deepEqual(await api.updateSubtask('event', 'task', draft), updated))
})
test('409 produce estado de conflicto con datos para abrir diálogo', async () => {
  const result = await run(async () => { throw conflictError(details) })
  assert.equal(result.status, 'conflict'); assert.equal(result.details.excessHours, 2.5)
})
test('diálogo muestra total planificado', () => assert.match(render(), /8,5 h/))
test('diálogo muestra límite diario', () => assert.match(render(), /6 h/))
test('diálogo muestra exceso calculado', () => assert.match(render(), /reducir al menos 2,5 h/))
test('diálogo no expone status HTTP', () => assert.doesNotMatch(render(), /409/))
test('diálogo no expone código ni endpoint', () => assert.doesNotMatch(render(), /DAILY_CAPACITY_EXCEEDED|\/api\//))
test('ofrece Elegir otra fecha y Ajustar horas', () => {
  assert.match(render(), /Elegir otra fecha/); assert.match(render(), /Ajustar horas/)
})
test('resolver fecha reenvía título y horas pendientes con nueva fecha', async () => {
  let sent
  assert.equal((await run(async changes => { sent = changes }, { ...draft, targetDate: '2026-10-16' }, { strategy: 'date' })).status, 'saved')
  assert.deepEqual(sent, { title: 'Sonido nuevo', targetDate: '2026-10-16', estimatedHours: 2.5 })
})
test('resolver horas reenvía título y fecha pendientes con nuevas horas', async () => {
  let sent
  assert.equal((await run(async changes => { sent = changes }, { ...draft, estimatedHours: '0.5' }, { strategy: 'hours' })).status, 'saved')
  assert.deepEqual(sent, { title: 'Sonido nuevo', targetDate: '2026-10-15', estimatedHours: 0.5 })
})
test('segundo 409 reemplaza cifras y conserva posibilidad de tercer intento', async () => {
  let calls = 0
  const save = async () => { calls++; if (calls < 3) throw conflictError({ ...details, totalHours: calls === 1 ? 8.5 : 7 }) }
  const first = await run(save), second = await run(save), third = await run(save)
  assert.equal(first.details.totalHours, 8.5); assert.equal(second.details.totalHours, 7)
  assert.equal(second.details.excessHours, 1); assert.equal(third.status, 'saved')
})
test('resultado saved tras 200 permite cerrar conflicto sin hacerlo ante 409', async () => {
  await mockFetch(async () => Response.json({ ...original, ...draft }), async () => {
    assert.equal((await run(changes => api.updateSubtask('event', 'task', changes))).status, 'saved')
  })
})
test('subtarea original y borrador no mutan mientras PATCH está pendiente o falla', async () => {
  const snapshot = structuredClone(original), copy = structuredClone(draft)
  let reject
  const pending = run(() => new Promise((resolve, fail) => { reject = fail }))
  assert.deepEqual(original, snapshot); reject(conflictError(details)); await pending
  assert.deepEqual(original, snapshot); assert.deepEqual(draft, copy)
})
test('cancelar resolución solo llama cierre, conserva borrador y no escribe', () => {
  let closed = false
  const copy = structuredClone(draft)
  cancelCapacityConflict({ preventDefault() {} }, false, () => { closed = true })
  assert.equal(closed, true); assert.deepEqual(draft, copy)
})
test('cambios parciales omiten campos intactos sin perder título', () => {
  assert.deepEqual(subtaskChanges({ ...original, title: 'Cambio' }, original), { title: 'Cambio' })
})
test('horas decimales permanecen numéricas al reintentar', async () => {
  await run(async changes => assert.equal(changes.estimatedHours, 2.5))
})
test('fecha anterior a hoy no se envía al resolver fecha', async () => {
  const result = await run(() => assert.fail('No debe escribir'), { ...draft, targetDate: '2026-10-05' }, { strategy: 'date' })
  assert.equal(result.status, 'invalid'); assert.match(result.fields.targetDate, /anterior/)
})
test('fecha posterior al evento no se envía', async () => {
  const result = await run(() => assert.fail('No debe escribir'), { ...draft, targetDate: '2026-10-21' }, { strategy: 'date' })
  assert.equal(result.status, 'invalid')
})
test('fecha calendario inválida no se envía', async () => {
  assert.equal((await run(() => assert.fail(), { ...draft, targetDate: '2026-02-30' })).status, 'invalid')
})
test('cero, vacío y horas no finitas no se envían', async () => {
  for (const estimatedHours of ['0', '', '-1', 'Infinity', 'NaN']) {
    assert.equal((await run(() => assert.fail(), { ...draft, estimatedHours })).status, 'invalid')
  }
})
test('error inesperado permite reintentar sin mostrar mensaje técnico', async () => {
  const result = await run(async () => { throw new Error('SQL interno') })
  assert.equal(result.status, 'failed'); assert.match(result.message, /Intenta nuevamente/); assert.doesNotMatch(result.message, /SQL/)
})
test('401 conserva expireSession y estado ApiError existente', async () => {
  const previous = globalThis.window; let expired = 0
  globalThis.window = { dispatchEvent(event) { assert.equal(event.type, 'eventapp:session-expired'); expired++ } }
  try {
    await mockFetch(async () => Response.json({}, { status: 401 }), async () => {
      await assert.rejects(api.updateSubtask('event', 'task', draft), { status: 401, code: 'INVALID_TOKEN' })
      assert.equal(expired, 1)
    })
  } finally { globalThis.window = previous }
})
test('doble envío genera un único PATCH', async () => {
  let done, calls = 0
  const lock = { current: false }
  const onSave = () => { calls++; return new Promise(resolve => { done = resolve }) }
  const first = run(onSave, draft, { lock })
  assert.equal((await run(onSave, draft, { lock })).status, 'blocked')
  assert.equal(calls, 1); done(); assert.equal((await first).status, 'saved'); assert.equal(lock.current, false)
})
test('Escape solicita cancelar y previene cierre nativo sin sincronización', () => {
  let prevented = false, closed = false
  cancelCapacityConflict({ preventDefault() { prevented = true } }, false, () => { closed = true })
  assert.equal(prevented, true); assert.equal(closed, true)
})
test('Escape no cierra durante guardado', () => {
  cancelCapacityConflict({ preventDefault() {} }, true, () => assert.fail('No debe cerrar'))
})
test('semántica accesible del diálogo y IDs relacionados', () => {
  const html = render()
  assert.match(html, /role="dialog" aria-modal="true"/)
  for (const match of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) {
    for (const id of match[1].split(' ')) assert.ok(html.includes(`id="${id}"`))
  }
})
test('todas las opciones quedan deshabilitadas al guardar', () => {
  assert.equal((render({ busy: true }).match(/disabled=""/g) || []).length, 3)
})
test('estructura mantiene clases responsive y acciones semánticas', () => {
  const html = render()
  assert.match(html, /capacity-conflict-dialog/); assert.match(html, /conflict-strategies/)
  assert.equal((html.match(/type="button"/g) || []).length, 3)
})
test('details inconsistentes no generan cifras falsas ni éxito', async () => {
  for (const value of [undefined, { ...details, totalHours: '8.5' }, { ...details, limitHours: NaN }, { ...details, targetDate: '2026-02-30' }]) {
    assert.equal(capacityConflictDetails(value), null)
    assert.equal((await run(async () => { throw conflictError(value) })).status, 'failed')
  }
})
test('PATCH fields y errores de red mantienen contrato ApiError', async () => {
  await mockFetch(async () => Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Validación', fields: { targetDate: 'Fecha inválida' } } }, { status: 400 }), async () => {
    await assert.rejects(api.updateSubtask('event', 'task', draft), error => error.fields.targetDate === 'Fecha inválida')
  })
  await mockFetch(async () => { throw new Error('Privado') }, async () => {
    await assert.rejects(api.updateSubtask('event', 'task', draft), { status: 0, code: 'NETWORK_ERROR' })
  })
})

test('Tab y Shift+Tab mantienen foco entre extremos del diálogo', () => {
  let focused = '', prevented = false
  const first = { focus() { focused = 'first' } }, last = { focus() { focused = 'last' } }
  const currentTarget = { querySelectorAll: () => [first, { disabled: true }, last] }
  containConflictFocus({ key: 'Tab', target: last, currentTarget, shiftKey: false, preventDefault() { prevented = true } })
  assert.equal(focused, 'first'); assert.equal(prevented, true)
  containConflictFocus({ key: 'Tab', target: first, currentTarget, shiftKey: true, preventDefault() {} })
  assert.equal(focused, 'last')
})
test('guardando sin controles activos mantiene foco en diálogo', () => {
  let focused = false, prevented = false
  containConflictFocus({ key: 'Tab', currentTarget: { querySelectorAll: () => [{ disabled: true }], focus() { focused = true } }, preventDefault() { prevented = true } })
  assert.equal(focused, true); assert.equal(prevented, true)
})
