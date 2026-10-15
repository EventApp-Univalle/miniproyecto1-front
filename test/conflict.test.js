import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { capacityConflictDetails, subtaskChanges, saveSubtaskEdit, cancelCapacityConflict, containConflictFocus, conflictSuggestions, applyConflictSuggestion, formatConflictDate, formatSuggestedHours, saveSubtaskCreation, appendCreatedSubtask, focusConflictInput } from '../src/subtaskEdit.utils.js'

let server, api, Dialog, Suggestions, CreationForm
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
  ;({ SubtaskForm: CreationForm } = await server.ssrLoadModule('/src/pages/DetalleEvento.jsx'))
  ;({ default: Dialog, ConflictSuggestions: Suggestions } = await server.ssrLoadModule('/src/components/CapacityConflictDialog.jsx'))
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


const proposed = [
  { strategy: 'CHANGE_DATE', targetDate: '2026-10-16', estimatedHours: 2.5 },
  { strategy: 'CHANGE_DATE', targetDate: '2026-10-17', estimatedHours: 2.5 },
  { strategy: 'CHANGE_DATE', targetDate: '2026-10-18', estimatedHours: 2.5 },
  { strategy: 'ADJUST_HOURS', targetDate: '2026-10-15', estimatedHours: 1.5 },
]
const suggestedDetails = () => capacityConflictDetails({ ...details, suggestions: proposed })

test('muestra tres fechas colombianas y un ajuste con horas de esfuerzo', () => {
  const html = render({ details: suggestedDetails() })
  assert.match(html, /Soluciones sugeridas por EventApp/)
  for (const day of [16, 17, 18]) assert.match(html, new RegExp(`${day} de octubre de 2026`))
  assert.match(html, /Reducir a 1,5 h/)
  assert.match(html, /15 de octubre de 2026/)
  assert.equal((html.match(/class="conflict-suggestion"/g) || []).length, 4)
  assert.match(html, /Conserva las horas estimadas/)
  assert.doesNotMatch(html, /[0-2]\d:[0-5]\d/)
})
test('seleccionar fecha cambia solo fecha, sin mutar ni persistir', () => {
  const originalDraft = structuredClone(draft)
  const next = applyConflictSuggestion(draft, proposed[0])
  assert.deepEqual(next, { ...draft, targetDate: '2026-10-16' })
  assert.deepEqual(draft, originalDraft)
})
test('seleccionar ajuste cambia solo horas y conserva fecha y título pendientes', () => {
  assert.deepEqual(applyConflictSuggestion(draft, proposed[3]), { ...draft, estimatedHours: '1.5' })
})
test('no pierde ediciones manuales posteriores al conflicto', () => {
  const edited = { title: 'Otro título pendiente', targetDate: '2026-10-19', estimatedHours: '3.75' }
  assert.deepEqual(applyConflictSuggestion(edited, proposed[0]), { ...edited, targetDate: '2026-10-16' })
  assert.deepEqual(applyConflictSuggestion(edited, proposed[3]), { ...edited, estimatedHours: '1.5' })
})
test('confirmar fecha sugerida hace PATCH coherente, no pierde título ni horas', async () => {
  let sent
  const selectedDraft = applyConflictSuggestion(draft, proposed[0])
  const result = await run(async changes => { sent = changes }, selectedDraft, { strategy: 'date' })
  assert.equal(result.status, 'saved')
  assert.deepEqual(sent, { title: 'Sonido nuevo', targetDate: '2026-10-16', estimatedHours: 2.5 })
})
test('confirmar ajuste sugerido mantiene fecha y manda número JSON', async () => {
  const selectedDraft = applyConflictSuggestion(draft, proposed[3])
  const result = await run(async changes => {
    assert.deepEqual(changes, { title: 'Sonido nuevo', targetDate: '2026-10-15', estimatedHours: 1.5 })
  }, selectedDraft, { strategy: 'hours' })
  assert.equal(result.status, 'saved')
})
test('request y segundo conflicto preservan propuestas nuevas sin cambiar borrador', async () => {
  const selectedDraft = applyConflictSuggestion(draft, proposed[0])
  const nextProposals = [{ strategy: 'CHANGE_DATE', targetDate: '2026-10-19', estimatedHours: 2.5 }]
  const nextDetails = { targetDate: '2026-10-16', totalHours: 7, limitHours: 6, suggestions: nextProposals }
  await mockFetch(async () => Response.json({ error: conflictError(nextDetails) }, { status: 409 }), async () => {
    const result = await run(changes => api.updateSubtask('event', 'task', changes), selectedDraft, { strategy: 'date' })
    assert.equal(result.status, 'conflict')
    assert.deepEqual(result.details.suggestions, nextProposals)
    assert.equal(selectedDraft.targetDate, '2026-10-16')
    const html = render({ details: result.details, draft: selectedDraft })
    assert.match(html, /19 de octubre de 2026/)
    assert.doesNotMatch(html, /Seleccionar fecha 17 de octubre/)
  })
})
test('lista vacía muestra motivo del backend y conserva acciones manuales', () => {
  const html = render({ details: { ...details, excessHours: 2.5, suggestions: [], noSuggestionsReason: 'El plazo del evento ya pasó.' } })
  assert.match(html, /El plazo del evento ya pasó/)
  assert.match(html, /Elegir otra fecha/); assert.match(html, /Ajustar horas/)
})
test('409 anterior sin suggestions conserva diálogo y resolución manual', async () => {
  const result = await run(async () => { throw conflictError(details) })
  assert.equal(result.status, 'conflict')
  const html = render({ details: result.details })
  assert.match(html, /No recibimos sugerencias automáticas/)
  assert.match(html, /Elegir otra fecha/); assert.match(html, /Ajustar horas/)
})
test('decimales pequeños no se muestran como cero ni se redondean en selección', () => {
  const tiny = { strategy: 'ADJUST_HOURS', targetDate: '2026-10-15', estimatedHours: 0.001 }
  assert.equal(formatSuggestedHours(tiny.estimatedHours), '0,001')
  assert.equal(applyConflictSuggestion(draft, tiny).estimatedHours, '0.001')
  assert.match(render({ details: { ...suggestedDetails(), suggestions: [tiny] } }), /Reducir a 0,001 h/)
})
test('cancelar después de seleccionar no escribe ni descarta el borrador', () => {
  const current = applyConflictSuggestion(draft, proposed[0])
  const snapshot = structuredClone(current); let closed = false
  cancelCapacityConflict({ preventDefault() {} }, false, () => { closed = true })
  assert.equal(closed, true); assert.deepEqual(current, snapshot)
})
test('doble confirmación de propuesta bloquea segundo envío', async () => {
  const current = applyConflictSuggestion(draft, proposed[0]); const lock = { current: false }
  let done, calls = 0
  const save = async () => { calls++; await new Promise(resolve => { done = resolve }) }
  const first = run(save, current, { lock })
  assert.equal((await run(save, current, { lock })).status, 'blocked')
  assert.equal(calls, 1); done(); assert.equal((await first).status, 'saved')
})
test('guardando deshabilita propuestas y alternativas manuales', () => {
  const html = render({ details: suggestedDetails(), busy: true })
  assert.equal((html.match(/disabled=""/g) || []).length, 7)
  assert.match(html, /aria-busy="true"/)
})
test('propuesta seleccionada tiene nombre accesible y estado visual no solo por color', () => {
  const html = renderToStaticMarkup(React.createElement(Suggestions, { details: suggestedDetails(), selected: proposed[0] }))
  assert.match(html, /aria-label="Seleccionar fecha 16 de octubre de 2026/)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  assert.match(html, />Seleccionada</)
  assert.match(html, /aria-labelledby=/)
})
test('foco incluye botones sugeridos al recorrer extremos con teclado', () => {
  let focused = ''
  const suggestion = { focus() { focused = 'suggestion' } }, cancel = { focus() { focused = 'cancel' } }
  const currentTarget = { querySelectorAll: () => [suggestion, cancel] }
  containConflictFocus({ key: 'Tab', target: cancel, currentTarget, preventDefault() {} })
  assert.equal(focused, 'suggestion')
  containConflictFocus({ key: 'Tab', shiftKey: true, target: suggestion, currentTarget, preventDefault() {} })
  assert.equal(focused, 'cancel')
})
test('fechas se formatean como calendario colombiano sin mover el día', () => {
  assert.equal(formatConflictDate('2026-10-15'), '15 de octubre de 2026')
  assert.equal(formatConflictDate(''), 'Fecha por confirmar')
})
test('propuestas incompletas o desconocidas no generan opciones inventadas', () => {
  for (const invalid of [null, { ...proposed[0], estimatedHours: 0 }, { ...proposed[0], estimatedHours: '2' },
    { ...proposed[0], targetDate: '2026-02-30' }, { ...proposed[0], strategy: 'UNKNOWN' }]) {
    assert.deepEqual(conflictSuggestions({ suggestions: [invalid] }), [])
    assert.equal(applyConflictSuggestion(draft, invalid), draft)
  }
})
test('cuando no llega motivo se muestra alternativa de resolución manual', () => {
  assert.match(render({ details: { ...suggestedDetails(), suggestions: [] } }), /No hay soluciones sugeridas disponibles/)
})


test('sobrecarga de milésimas mantiene exceso positivo y cifras visibles precisas', () => {
  const precise = capacityConflictDetails({ targetDate: '2026-10-15', totalHours: 6.001, limitHours: 6 })
  assert.equal(precise.excessHours, 0.001)
  const html = render({ details: precise })
  assert.match(html, /6,001 h/)
  assert.match(html, /reducir al menos 0,001 h/)
})


const createdTask = { id: 'created-task', eventId: 'event', ...draft, estimatedHours: 2.5, createdAt: '2026-10-15T10:00:00Z' }
const createDraft = (data = draft, extra = {}) => saveSubtaskCreation({ draft: data,
  eventDate: '2026-10-20', referenceDate: '2026-10-06', lock: { current: false },
  onCreate: values => api.createSubtask('event', values), ...extra })

test('creación POST 409 conserva sugerencias y borrador completo sin éxito', async () => {
  const current = structuredClone(draft)
  await mockFetch(async (url, options) => {
    assert.match(url, /\/api\/eventos\/event\/subtareas$/)
    assert.equal(options.method, 'POST')
    return Response.json({ error: conflictError({ ...details, suggestions: proposed }) }, { status: 409 })
  }, async () => {
    const result = await createDraft(current)
    assert.equal(result.status, 'conflict'); assert.deepEqual(result.details.suggestions, proposed)
    assert.deepEqual(current, draft)
  })
})
test('creación POST antiguo sin suggestions sigue resolviéndose manualmente', async () => {
  await mockFetch(async () => Response.json({ error: conflictError(details) }, { status: 409 }), async () => {
    const result = await createDraft()
    assert.equal(result.status, 'conflict')
    assert.match(render({ details: result.details }), /No recibimos sugerencias automáticas/)
  })
})
test('creación POST con suggestions vacío mantiene motivo y acciones manuales', async () => {
  const result = await createDraft(draft, { onCreate: async () => { throw conflictError({ ...details, suggestions: [], noSuggestionsReason: 'No hay fechas libres.' }) } })
  assert.equal(result.status, 'conflict')
  const html = render({ details: result.details })
  assert.match(html, /No hay fechas libres/); assert.match(html, /Elegir otra fecha/); assert.match(html, /Ajustar horas/)
})
test('crear resolviendo fecha reintenta POST, con título y horas intactos', async () => {
  const current = applyConflictSuggestion(draft, proposed[0])
  await mockFetch(async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { title: 'Sonido nuevo', targetDate: '2026-10-16', estimatedHours: 2.5 })
    return Response.json({ ...createdTask, targetDate: '2026-10-16' }, { status: 201 })
  }, async () => {
    const result = await createDraft(current)
    assert.equal(result.status, 'created'); assert.equal(result.subtask.targetDate, '2026-10-16')
  })
})
test('crear resolviendo horas reintenta POST y conserva fecha y título', async () => {
  await mockFetch(async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { title: 'Sonido nuevo', targetDate: '2026-10-15', estimatedHours: 1.5 })
    return Response.json({ ...createdTask, estimatedHours: 1.5 }, { status: 201 })
  }, async () => assert.equal((await createDraft(applyConflictSuggestion(draft, proposed[3]))).status, 'created'))
})
test('seleccionar propuesta de creación no ejecuta fetch ni crea una subtarea', async () => {
  await mockFetch(async () => assert.fail('Seleccionar no debe escribir'), async () => {
    const current = applyConflictSuggestion(draft, proposed[0])
    assert.equal(current.targetDate, '2026-10-16'); assert.equal(current.title, draft.title)
  })
})
test('POST 201 agrega solo registro confirmado sin mutar listado anterior ni duplicar IDs', async () => {
  const list = [{ id: 'other' }]
  const result = await createDraft(draft, { onCreate: async () => createdTask })
  assert.equal(result.status, 'created')
  const appended = appendCreatedSubtask(list, result.subtask)
  assert.deepEqual(appended, [list[0], createdTask]); assert.equal(list.length, 1)
  assert.equal(appendCreatedSubtask(appended, result.subtask), appended)
})
test('segundo POST 409 renueva sugerencias sin descartar valores del usuario', async () => {
  const current = applyConflictSuggestion(draft, proposed[0])
  const updatedDetails = { targetDate: current.targetDate, totalHours: 9, limitHours: 6,
    suggestions: [{ strategy: 'CHANGE_DATE', targetDate: '2026-10-19', estimatedHours: 2.5 }] }
  await mockFetch(async (url, options) => {
    assert.equal(options.method, 'POST')
    return Response.json({ error: conflictError(updatedDetails) }, { status: 409 })
  }, async () => {
    const result = await createDraft(current)
    assert.equal(result.status, 'conflict'); assert.equal(result.details.totalHours, 9)
    assert.deepEqual(result.details.suggestions, updatedDetails.suggestions)
    assert.equal(current.title, draft.title); assert.equal(current.targetDate, '2026-10-16')
  })
})
test('cancelar creación conflictiva o Escape conserva borrador y no ejecuta otro POST', () => {
  const current = applyConflictSuggestion(draft, proposed[3]); const snapshot = structuredClone(current)
  let cancelled = 0
  cancelCapacityConflict({ preventDefault() {} }, false, () => { cancelled++ })
  assert.equal(cancelled, 1); assert.deepEqual(current, snapshot)
  cancelCapacityConflict({ preventDefault() {} }, true, () => { cancelled++ })
  assert.equal(cancelled, 1)
})
test('doble envío en creación produce un solo POST incluso antes del siguiente render', async () => {
  const lock = { current: false }; let requests = 0, done
  await mockFetch(async (url, options) => {
    requests++; assert.equal(options.method, 'POST')
    await new Promise(resolve => { done = resolve })
    return Response.json(createdTask, { status: 201 })
  }, async () => {
    // Use a direct deferred source to inspect the synchronous lock before auth resolves.
    let resolve
    const onCreate = () => new Promise(finish => { resolve = finish })
    const first = createDraft(draft, { lock, onCreate })
    assert.equal(lock.current, true)
    assert.equal((await createDraft(draft, { lock, onCreate })).status, 'blocked')
    resolve(createdTask); assert.equal((await first).status, 'created'); assert.equal(lock.current, false)
    const actual = createDraft(draft, { lock })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal((await createDraft(draft, { lock })).status, 'blocked')
    assert.equal(requests, 1); done(); assert.equal((await actual).status, 'created')
  })
})
test('error de red en creación conserva borrador y no se convierte en éxito', async () => {
  await mockFetch(async () => { throw new Error('Sin red') }, async () => {
    const result = await createDraft()
    assert.equal(result.status, 'failed'); assert.match(result.message, /conectar con el servidor/)
    assert.equal(result.subtask, undefined); assert.equal(draft.title, 'Sonido nuevo')
  })
})
test('401 de POST mantiene el evento de sesión vencida existente', async () => {
  const previous = globalThis.window; let expired = 0
  globalThis.window = { dispatchEvent(event) { assert.equal(event.type, 'eventapp:session-expired'); expired++ } }
  try {
    await mockFetch(async () => Response.json({}, { status: 401 }), async () => {
      const result = await createDraft()
      assert.equal(result.status, 'failed'); assert.match(result.message, /sesión/); assert.equal(expired, 1)
    })
  } finally { globalThis.window = previous }
})
test('POST 400 conserva mensajes de validación y campos', async () => {
  await mockFetch(async () => Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Revisa los campos indicados.', fields: { targetDate: 'Fecha inválida.' } } }, { status: 400 }), async () => {
    const result = await createDraft()
    assert.equal(result.status, 'failed'); assert.deepEqual(result.fields, { targetDate: 'Fecha inválida.' })
    assert.equal(result.message, 'Revisa los campos indicados.')
  })
})
test('creación nunca considera éxito una respuesta 200 ni un 201 sin registro válido', async () => {
  await mockFetch(async () => Response.json(createdTask, { status: 200 }), async () => {
    assert.equal((await createDraft()).status, 'failed')
  })
  await mockFetch(async () => Response.json({}, { status: 201 }), async () => {
    const result = await createDraft(); assert.equal(result.status, 'failed'); assert.equal(result.subtask, undefined)
  })
})
test('creación mantiene validación de fechas, horas y evento pasado antes de POST', async () => {
  await mockFetch(async () => assert.fail('No debe enviarse POST'), async () => {
    for (const current of [{ ...draft, title: '' }, { ...draft, estimatedHours: 0 }, { ...draft, targetDate: '2026-10-05' }, { ...draft, targetDate: '2026-10-21' }]) {
      assert.equal((await createDraft(current)).status, 'invalid')
    }
    assert.equal((await createDraft(draft, { eventDate: '2026-10-05' })).status, 'failed')
  })
})
test('acción manual enfoca el campo numérico y selecciona todo para reemplazarlo', () => {
  const calls = []
  const input = { focus() { calls.push('focus') }, select() { calls.push('select') } }
  focusConflictInput(input, 'hours'); assert.deepEqual(calls, ['focus', 'select'])
  calls.length = 0; focusConflictInput(input, 'date'); assert.deepEqual(calls, ['focus'])
})


test('formulario de fondo bloqueado por conflicto no finge seguir guardando', () => {
  const html = renderToStaticMarkup(React.createElement(CreationForm, {
    referenceDate: '2026-10-06', eventDate: '2026-10-20', formData: draft, fieldErrors: {},
    submitError: '', isSubmitting: false, blocked: true,
  }))
  assert.equal((html.match(/disabled=""/g) || []).length, 4)
  assert.match(html, /Agregar al plan/); assert.doesNotMatch(html, /Guardando/)
  assert.match(html, /aria-busy="false"/)
})
test('formulario de creación en request deshabilita controles y anuncia guardado', () => {
  const html = renderToStaticMarkup(React.createElement(CreationForm, {
    referenceDate: '2026-10-06', eventDate: '2026-10-20', formData: draft, fieldErrors: {},
    submitError: '', isSubmitting: true,
  }))
  assert.equal((html.match(/disabled=""/g) || []).length, 4)
  assert.match(html, /Guardando/); assert.match(html, /aria-busy="true"/)
})
