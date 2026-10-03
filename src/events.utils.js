import { getBogotaDate } from './subtasks.utils.js'

export function validateEventForm(formData, referenceDate = getBogotaDate()) {
  const fields = {}
  if (!formData.title.trim()) fields.title = 'Escribe el nombre del evento.'
  if (!formData.type.trim()) fields.type = 'Escribe el tipo de evento.'
  if (!formData.date) fields.date = 'Selecciona la fecha del evento.'
  else if (formData.date < referenceDate) fields.date = 'La fecha del evento no puede ser anterior a hoy.'
  return fields
}
