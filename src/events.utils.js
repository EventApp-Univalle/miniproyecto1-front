import { getBogotaDate } from './subtasks.utils.js'

export function validateEventForm(formData, referenceDate = getBogotaDate(), originalDate) {
  const fields = {}
  if (!formData.title.trim()) fields.title = 'Escribe el nombre del evento.'
  if (!formData.type.trim()) fields.type = 'Escribe el tipo de evento.'
  if (!formData.date) fields.date = 'Selecciona la fecha del evento.'
  else if (formData.date !== originalDate && formData.date < referenceDate) fields.date = 'La fecha del evento no puede ser anterior a hoy.'
  return fields
}

export function eventChanges(form, event) {
  const values = { ...form, title: form.title.trim(), type: form.type.trim(),
    time: form.time || null, location: form.location.trim() || null, description: form.description.trim() || null }
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== event[key]))
}
