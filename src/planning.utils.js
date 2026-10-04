const sections = [
  { key: 'overdue', label: 'Vencidas' },
  { key: 'today', label: 'Para hoy' },
  { key: 'upcoming', label: 'Próximas' },
]

export function summarizePlanning(events, today) {
  const message = 'No pudimos interpretar el resumen de planificación. Intenta nuevamente.'
  if (!Array.isArray(events) || !/^\d{4}-\d{2}-\d{2}$/.test(today?.referenceDate || '') ||
      !sections.every(({ key }) => Array.isArray(today[key]))) throw new Error(message)
  const tasks = sections.flatMap(({ key }) => today[key])
  if (tasks.some(task => !Number.isFinite(task?.estimatedHours) || task.estimatedHours <= 0)) throw new Error(message)
  const estimatedHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0)
  if (!Number.isFinite(estimatedHours)) throw new Error(message)
  return {
    eventCount: events.length, taskCount: tasks.length, estimatedHours,
    referenceDate: today.referenceDate,
    sections: sections.map(section => ({ ...section, count: today[section.key].length })),
  }
}
