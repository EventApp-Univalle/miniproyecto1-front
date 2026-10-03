import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBogotaDate, validateSubtask } from '../src/subtasks.utils.js'

const today = '2026-10-03'
const eventDate = '2026-10-15'
const form = { title: 'Sonido', targetDate: '2026-10-10', estimatedHours: '1.5' }

test('fecha Bogotá respeta el cambio de día local y no el día UTC', () => {
  assert.equal(getBogotaDate(new Date('2026-10-03T04:59:59Z')), '2026-10-02')
  assert.equal(getBogotaDate(new Date('2026-10-03T05:00:00Z')), today)
})

test('validación acepta horas decimales positivas y límites inclusivos', () => {
  for (const estimatedHours of ['0.5', '1', '1.5', '2.5', '0.001']) {
    for (const targetDate of [today, '2026-10-10', eventDate]) {
      assert.deepEqual(validateSubtask({ ...form, estimatedHours, targetDate }, eventDate, today), {})
    }
  }
})

test('validación rechaza reloj, horas vacías, cero, negativas y no finitas', () => {
  for (const estimatedHours of ['', ' ', '01:30', '10:00', '0', '-1', 'NaN', 'Infinity']) {
    assert.ok(validateSubtask({ ...form, estimatedHours }, eventDate, today).estimatedHours)
  }
})

test('validación rechaza fechas fuera del intervalo antes de enviar', () => {
  assert.equal(validateSubtask({ ...form, targetDate: '2026-10-02' }, eventDate, today).targetDate,
    'La fecha no puede ser anterior a hoy.')
  assert.equal(validateSubtask({ ...form, targetDate: '2026-10-16' }, eventDate, today).targetDate,
    'La fecha no puede ser posterior a la fecha del evento.')
})

test('validación rechaza título vacío y fecha ausente o imposible', () => {
  assert.ok(validateSubtask({ ...form, title: ' ' }, eventDate, today).title)
  for (const targetDate of ['', '2026-02-30', 'no-fecha']) {
    assert.ok(validateSubtask({ ...form, targetDate }, eventDate, today).targetDate)
  }
})
