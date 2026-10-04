export function getBogotaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function validateSubtask(formData, eventDate, referenceDate = getBogotaDate(), originalTargetDate) {
  const fields = {}
  const estimatedHours = Number(formData.estimatedHours)
  if (!formData.title.trim()) fields.title = 'Escribe el título de la subtarea.'
  if (!formData.targetDate) {
    fields.targetDate = 'Selecciona la fecha objetivo.'
  } else {
    const date = new Date(`${formData.targetDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.targetDate) ||
        !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== formData.targetDate) {
      fields.targetDate = 'Selecciona una fecha objetivo válida.'
    } else if (formData.targetDate !== originalTargetDate && formData.targetDate < referenceDate) {
      fields.targetDate = 'La fecha no puede ser anterior a hoy.'
    } else if (formData.targetDate !== originalTargetDate && formData.targetDate > eventDate) {
      fields.targetDate = 'La fecha no puede ser posterior a la fecha del evento.'
    }
  }
  if (!String(formData.estimatedHours).trim() || !Number.isFinite(estimatedHours) || estimatedHours <= 0) {
    fields.estimatedHours = 'Escribe un número de horas mayor que 0. Ej: 1.5.'
  }
  return fields
}
