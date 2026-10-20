import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MemoryRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { focusFirstInvalid, formatProgressPercent } from '../src/quality.utils.js'
import { reprogramTarget, subtaskReprogramPath } from '../src/subtaskNavigation.utils.js'
import { resolveApiBaseUrl, apiDocsUrl } from '../src/apiEnvironment.utils.js'
const id = '00000000-0000-4000-8000-000000000011', eventId = '00000000-0000-4000-8000-000000000001'
let server, Card, Form, Bar, Docs, SubtaskEditor
before(async () => {
  server = await createServer({ envDir: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'quality-no-remote-auth', enforce: 'pre',
    resolveId(source, importer) { if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0quality-auth' },
    load(id) { if (id === '\0quality-auth') return "export const authConfigurationError=''; export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-only-token'}}}),signOut:async()=>({})}};" },
  }] })
  ;({ TaskCard: Card } = await server.ssrLoadModule('/src/pages/Hoy.jsx'))
  ;({ default: Form } = await server.ssrLoadModule('/src/components/EventForm.jsx'))
  ;({ default: Bar } = await server.ssrLoadModule('/src/components/EventProgress.jsx'))
  ;({ default: Docs } = await server.ssrLoadModule('/src/components/ApiDocumentationLink.jsx'))
  ;({ SubtaskEditor } = await server.ssrLoadModule('/src/pages/DetalleEvento.jsx'))
})
after(async () => { await server?.close() })
const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)))
const task = { id, eventId, title: 'Confirmar sonido', eventTitle: 'Evento', targetDate: '2026-12-10', estimatedHours: 2, status: 'PENDING' }

test('H1 reprogramación tiene acción explícita y URL al editor existente, sin escritura', () => {
  const html = render(Card, { task })
  assert.match(html, /Reprogramar subtarea: Confirmar sonido/)
  assert.ok(html.includes(`href="/evento/${eventId}?reprogramar=${id}#subtarea-${id}"`))
  assert.match(html, /Ver evento/)
  assert.equal(reprogramTarget(new URL(subtaskReprogramPath(task), 'http://localhost').search), id)
})
test('H1 pospuestas pueden reprogramarse; hechas conservan acceso al detalle', () => {
  assert.match(render(Card, { task: { ...task, status: 'POSTPONED' } }), /Reprogramar/)
  const done = render(Card, { task: { ...task, status: 'DONE' } })
  assert.doesNotMatch(done, /Reprogramar/); assert.match(done, /Ver evento/)
})
test('H1 query inválida o repetida nunca abre un editor arbitrario', () => {
  for (const query of ['', '?reprogramar=no', `?reprogramar=${id}&reprogramar=${id}`, '?reprogramar=%3Cscript%3E']) assert.equal(reprogramTarget(query), null)
})
test('H1 editor enlazado conserva borrador y confirmación explícita', () => {
  const html = render(SubtaskEditor, { subtask: task, eventDate: '2026-12-15', focusDate: true })
  assert.match(html, /Reprogramar no guarda automáticamente/)
  assert.match(html, /Guardar cambios/)
  assert.match(html, /value="2026-12-10"/)
})
test('H2 foco va al primer campo inválido y no falla ante formularios desmontados', () => {
  let focused = 0
  assert.equal(focusFirstInvalid({ querySelector(selector) { assert.match(selector, /aria-invalid/); return { focus() { focused++ } } } }), true)
  assert.equal(focused, 1); assert.equal(focusFirstInvalid(null), false)
})
test('H2 resumen anuncia errores y ofrece enlaces sin borrar los valores escritos', () => {
  const html = render(Form, { formData: { title: 'Mi evento', type: '', date: '', time: '', location: '', description: '', isPriority: false }, fieldErrors: { type: 'Escribe el tipo de evento.', date: 'Selecciona una fecha.' }, referenceDate: '2026-10-19' })
  assert.match(html, /role="alert"/); assert.match(html, /Revisa los campos indicados/)
  assert.match(html, /href="#type"/); assert.match(html, /href="#date"/)
  assert.match(html, /aria-describedby="type-error"/); assert.match(html, /value="Mi evento"/)
})
test('H5 nunca anuncia 100 % por redondeo si aún quedan gestiones', () => {
  assert.equal(formatProgressPercent(99.995), '> 99,9')
  const html = render(Bar, { progress: { eventId, eventTitle: 'Evento', doneCount: 19999, totalCount: 20000, progressPercent: 99.995 } })
  assert.match(html, /&gt; 99,9 %/); assert.doesNotMatch(html, /<strong>100 %/)
  assert.match(html, /19999 de 20000/); assert.match(html, /value="99.995"/)
})
test('H5 valores mínimos no se confunden con cero; 0, 50 y 100 son exactos', () => {
  assert.equal(formatProgressPercent(0.001), '< 0,1')
  for (const value of [0, 50, 100]) assert.equal(formatProgressPercent(value), String(value))
})
test('producción rechaza localhost, HTTP, URLs vacías y credenciales; desarrollo conserva su fallback', () => {
  for (const url of ['', 'http://localhost:3000', 'https://localhost', 'http://api.test', 'https://user:secret@api.test', 'https://api.test?token=no', 'https://api.test/#fragment']) assert.throws(() => resolveApiBaseUrl(url, true))
  assert.equal(resolveApiBaseUrl('', false), 'http://localhost:3000')
  assert.equal(resolveApiBaseUrl('https://eventapp-univalle-backend.onrender.com/', true), 'https://eventapp-univalle-backend.onrender.com')
})
test('Documentación API deriva del backend configurado, no inventa dominios y abre otra pestaña segura', () => {
  const base = 'https://eventapp-univalle-backend.onrender.com'
  assert.equal(apiDocsUrl(base), `${base}/api-docs/`)
  const html = render(Docs, { baseUrl: base })
  assert.match(html, /href="https:\/\/eventapp-univalle-backend.onrender.com\/api-docs\/"/)
  assert.match(html, /Documentación API/); assert.match(html, /noopener noreferrer/)
  assert.doesNotMatch(html, /localhost/)
  assert.doesNotMatch(render(Docs, { baseUrl: '' }), /href=/)
})
