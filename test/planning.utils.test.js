import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizePlanning } from '../src/planning.utils.js'

const empty = () => ({ referenceDate: '2026-10-03', overdue: [], today: [], upcoming: [] })

test('planificación cuenta todos los eventos, incluso sin subtareas, y suma solo tareas de Hoy', () => {
  const today = { ...empty(), overdue: [{ estimatedHours: 1.5 }], today: [{ estimatedHours: 1 }, { estimatedHours: 3 }] }
  const original = structuredClone(today)
  const summary = summarizePlanning([{ id: 'a' }, { id: 'sin-subtareas' }], today)
  assert.equal(summary.eventCount, 2)
  assert.equal(summary.taskCount, 3)
  assert.equal(summary.estimatedHours, 5.5)
  assert.deepEqual(summary.sections.map(section => section.count), [1, 2, 0])
  assert.equal(summary.referenceDate, today.referenceDate)
  assert.deepEqual(today, original)
  assert.doesNotMatch(JSON.stringify(summary), /completed|attendance|progress|percentage/)
})

test('planificación vacía representa ceros reales y conserva los tres grupos', () => {
  const summary = summarizePlanning([], empty())
  assert.equal(summary.eventCount, 0)
  assert.equal(summary.taskCount, 0)
  assert.equal(summary.estimatedHours, 0)
  assert.deepEqual(summary.sections.map(section => section.label), ['Vencidas', 'Para hoy', 'Próximas'])
})

test('respuesta incompleta o esfuerzo inválido no se convierte en métricas simuladas', () => {
  for (const response of [null, {}, { ...empty(), today: null }, { ...empty(), referenceDate: '' }]) {
    assert.throws(() => summarizePlanning([], response), /resumen de planificación/)
  }
  for (const estimatedHours of ['1.5', 0, -1, NaN, Infinity]) {
    assert.throws(() => summarizePlanning([], { ...empty(), today: [{ estimatedHours }] }), /resumen de planificación/)
  }
  assert.throws(() => summarizePlanning(null, empty()), /resumen de planificación/)
})
