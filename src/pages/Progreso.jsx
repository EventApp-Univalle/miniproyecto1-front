import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getProgress, getTodayTasks } from '../api'
import { summarizePlanning } from '../planning.utils'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import EventProgress from '../components/EventProgress'
import { requireEventProgress } from '../execution.utils'

const hoursFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export default function Progreso() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadSummary() {
      setLoading(true)
      setError('')
      try {
        const [events, today] = await Promise.all([
          getProgress(controller.signal), getTodayTasks(controller.signal),
        ])
        if (!Array.isArray(events)) throw new Error('No pudimos cargar el progreso de tus eventos.')
        events.forEach(requireEventProgress)
        if (!controller.signal.aborted) setSummary({ ...summarizePlanning(events, today), eventProgress: events })
      } catch (err) {
        if (!controller.signal.aborted && err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadSummary()
    return () => controller.abort()
  }, [retry])

  return <ProgresoContent summary={summary} loading={loading} error={error}
    onRetry={() => setRetry(value => value + 1)} />
}

export function ProgresoContent({ summary, loading, error, onRetry }) {
  return <div className="page-container planning-page">
    <PageHeader title="Progreso" description="Una mirada clara a tu planificación actual." />
    <div className="planning-note"><Icon name="info" />
      <p>Tu capacidad diaria se administra desde Configuración.</p>
      <Link to="/configuracion">Ir a Configuración<Icon name="arrow" /></Link>
    </div>
    {loading ? <div className="page-state" role="status" aria-live="polite">
      <span className="state-icon"><Icon name="loader" /></span>
      <h2>Cargando tu planificación</h2><p>Estamos consultando tus eventos y subtareas.</p>
    </div> : error ? <div className="page-state" role="alert">
      <span className="state-icon"><Icon name="alert" /></span>
      <h2>No pudimos cargar el resumen</h2><p>{error}</p>
      <button className="btn-primary" type="button" onClick={onRetry}>Intentar de nuevo</button>
    </div> : summary && <>
    {summary.eventProgress && <section className="event-progress-list" aria-label="Avance logístico por evento">
      <h2>Avance por evento</h2>
      {summary.eventProgress.length ? summary.eventProgress.map(progress => <EventProgress key={progress.eventId} progress={progress} />)
        : <p>Aún no tienes eventos. <Link to="/crear">Crear evento</Link></p>}
    </section>}
    <div className="planning-heading"><span className="type-badge">Planificación actual</span><span>Fecha de referencia: {summary.referenceDate}</span></div>
    <div className="planning-stats" aria-label="Resumen de planificación">
      <SummaryCard icon="calendar" label="Eventos" value={summary.eventCount} description="Incluye eventos sin subtareas." />
      <SummaryCard icon="events" label="Subtareas pendientes" value={summary.taskCount} description="Pendientes de ejecución." />
      <SummaryCard icon="clock" label="Horas estimadas" value={`${hoursFormat.format(summary.estimatedHours)} h`} description="Suma de esas subtareas; no son horas ejecutadas." />
    </div>
    {summary.taskCount > 0 ? <section className="planning-distribution" aria-labelledby="planning-title">
      <div><span className="icon-tile"><Icon name="chart" /></span><h2 id="planning-title">Tu plan, por fecha</h2><p>Distribución de las subtareas según su fecha objetivo.</p></div>
      <div className="planning-rows">
        {summary.sections.map(section => <div key={section.key} className={`planning-row planning-row-${section.key}`}>
          <div className="planning-row-label"><span>{section.label}</span><strong>{section.count} de {summary.taskCount}</strong></div>
          <meter min="0" max={summary.taskCount} value={section.count} aria-label={`${section.label}: ${section.count} de ${summary.taskCount} subtareas`} />
        </div>)}
      </div>
    </section> : <div className="page-state planning-empty" role="status">
      <span className="state-icon"><Icon name="inbox" /></span>
      <h2>{summary.eventProgress?.some(event => event.totalCount > 0) ? 'No hay tareas pendientes' : summary.eventCount ? 'Tu plan está por comenzar' : 'Empieza con tu primer evento'}</h2>
      <p>{summary.eventProgress?.some(event => event.totalCount > 0) ? 'Las gestiones Hechas y Pospuestas siguen disponibles en Hoy y en el detalle de cada evento.' : summary.eventCount ? 'Ya tienes eventos. Añade subtareas para ver su distribución aquí.' : 'Crea un evento y añade su plan logístico.'}</p>
      <Link className="btn-primary" to={summary.eventCount ? '/eventos' : '/crear'}>{summary.eventCount ? 'Ver mis eventos' : 'Crear evento'}</Link>
    </div>}
    <div className="planning-note"><Icon name="info" /><p>El avance cuenta gestiones Hechas sobre el total, incluidas las Pospuestas. La distribución por fecha y las horas muestran solo trabajo pendiente; no son capacidad disponible.</p><Link to="/hoy">Ir a Hoy<Icon name="arrow" /></Link></div>
    </>}
  </div>
}

function SummaryCard({ icon, label, value, description }) {
  return <div className="planning-stat"><span className="icon-tile"><Icon name={icon} /></span><p>{label}</p><strong>{value}</strong><span>{description}</span></div>
}
