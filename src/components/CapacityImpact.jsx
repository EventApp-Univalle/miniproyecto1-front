import { useId } from 'react'
import { Link } from 'react-router'
import { getCapacityImpact } from '../capacity.utils'
import { formatConflictDate, formatSuggestedHours } from '../subtaskEdit.utils'
import { subtaskReviewPath } from '../subtaskNavigation.utils'
import Icon from './Icon'

export default function CapacityImpact({ capacity }) {
  const titleId = `capacity-impact-${useId()}`
  const impact = getCapacityImpact(capacity)
  if (!impact) return <p className="capacity-impact-status" role="status">
    El análisis de sobrecarga no está disponible. La capacidad mostrada es el valor confirmado.
  </p>
  if (!impact.hasOverload) return <p className="capacity-impact-status" role="status">
    No hay días con sobrecarga en tu planificación actual y futura.
  </p>

  return <section className="capacity-impact" aria-labelledby={titleId}>
    <div className="capacity-impact-heading" role="status">
      <Icon name="alert" />
      <h3 id={titleId}>{impact.affectedDayCount} {impact.affectedDayCount === 1 ? 'día necesita' : 'días necesitan'} revisión</h3>
    </div>
    <p>Tu límite confirmado es de {formatSuggestedHours(capacity.dailyLimitHours)} h/día. Estas subtareas
      contribuyen a una carga conjunta que lo supera; ninguna se ha modificado automáticamente.</p>
    <ol className="capacity-impact-days">
      {impact.affectedDays.map(day => <li key={day.date} className="capacity-impact-day">
        <h4><time dateTime={day.date}>{formatConflictDate(day.date)}</time></h4>
        <dl className="capacity-impact-totals">
          <div><dt>Planificado</dt><dd>{formatSuggestedHours(day.plannedHours)} h</dd></div>
          <div><dt>Límite diario</dt><dd>{formatSuggestedHours(day.limitHours)} h</dd></div>
          <div><dt>Exceso conjunto</dt><dd>{formatSuggestedHours(day.excessHours)} h</dd></div>
        </dl>
        <ul className="capacity-impact-tasks">
          {day.tasks.map(task => <li key={task.subtaskId}>
            <div><strong>{task.title}</strong><span>{formatSuggestedHours(task.estimatedHours)} h estimadas</span></div>
            <Link className="btn-secondary" to={subtaskReviewPath(task)} aria-label={`Revisar subtarea: ${task.title}`}>
              Revisar subtarea
            </Link>
          </li>)}
        </ul>
      </li>)}
    </ol>
  </section>
}
