import { Link } from 'react-router'
import { formatProgressPercent } from '../quality.utils'
import { requireEventProgress } from '../execution.utils'

export default function EventProgress({ progress, loading = false, error = '', onRetry }) {
  if (loading) return <p className="capacity-status" role="status">Consultando progreso del evento…</p>
  let value
  try { value = requireEventProgress(progress) } catch { /* Unknown is not zero. */ }
  if (error || !value) return <div className="progress-error" role="alert">
    <p>No pudimos cargar el progreso del evento.</p>
    <button type="button" className="btn-secondary" onClick={onRetry} disabled={!onRetry}>Reintentar progreso</button>
  </div>
  return <section className="event-progress" aria-label={`Progreso de ${value.eventTitle}`}>
    <div className="event-progress-heading"><h3>{value.eventTitle}</h3>
      <strong>{formatProgressPercent(value.progressPercent)} %</strong></div>
    <p>{value.doneCount} de {value.totalCount} gestiones completadas.</p>
    <progress max="100" value={value.progressPercent} aria-label={`Avance de ${value.eventTitle}: ${value.doneCount} de ${value.totalCount} gestiones completadas`} />
    {value.totalCount === 0 ? <p>Aún no hay subtareas. <Link to={`/evento/${encodeURIComponent(value.eventId)}`}>Añadir subtareas</Link></p>
      : value.doneCount === value.totalCount && <p>No hay tareas pendientes. Todas las gestiones están hechas.</p>}
  </section>
}
