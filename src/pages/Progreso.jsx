import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { getEvents, getTodayTasks, getDailyCapacity, updateDailyCapacity } from '../api'
import { requireDailyCapacity } from '../capacity.utils'
import { summarizePlanning } from '../planning.utils'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import CapacityPanel from '../components/CapacityPanel'

const hoursFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export default function Progreso() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const [capacity, setCapacity] = useState(null)
  const [capacityLoading, setCapacityLoading] = useState(true)
  const [capacityError, setCapacityError] = useState('')
  const [capacitySaving, setCapacitySaving] = useState(false)
  const [capacityRetry, setCapacityRetry] = useState(0)
  const saveController = useRef(null)

  useEffect(() => () => saveController.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadCapacity() {
      setCapacityLoading(true)
      setCapacityError('')
      try {
        const result = requireDailyCapacity(await getDailyCapacity(controller.signal))
        if (!controller.signal.aborted) setCapacity(result)
      } catch (err) {
        if (!controller.signal.aborted && err.name !== 'AbortError') setCapacityError('No pudimos consultar tu capacidad.')
      } finally {
        if (!controller.signal.aborted) setCapacityLoading(false)
      }
    }
    loadCapacity()
    return () => controller.abort()
  }, [capacityRetry])

  async function saveCapacity(hours) {
    const controller = new AbortController()
    saveController.current = controller
    setCapacitySaving(true)
    try {
      const result = requireDailyCapacity(await updateDailyCapacity(hours, controller.signal))
      if (!controller.signal.aborted) setCapacity(result)
      return result
    } finally {
      if (!controller.signal.aborted) setCapacitySaving(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    async function loadSummary() {
      setLoading(true)
      setError('')
      try {
        const [events, today] = await Promise.all([
          getEvents(controller.signal), getTodayTasks(controller.signal),
        ])
        if (!controller.signal.aborted) setSummary(summarizePlanning(events, today))
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
    onRetry={() => setRetry(value => value + 1)} capacity={capacity} capacityLoading={capacityLoading}
    capacityError={capacityError} capacitySaving={capacitySaving} onSave={saveCapacity}
    onCapacityRetry={() => setCapacityRetry(value => value + 1)} />
}

export function ProgresoContent({ summary, loading, error, onRetry, capacity,
  capacityLoading, capacityError, capacitySaving, onSave, onCapacityRetry }) {
  return <div className="page-container planning-page">
    <PageHeader title="Progreso" description="Una mirada clara a tu planificación actual." />
    <CapacityPanel capacity={capacity} loading={capacityLoading} error={capacityError}
      saving={capacitySaving} onSave={onSave} onRetry={onCapacityRetry} />
    {loading ? <div className="page-state" role="status" aria-live="polite">
      <span className="state-icon"><Icon name="loader" /></span>
      <h2>Cargando tu planificación</h2><p>Estamos consultando tus eventos y subtareas.</p>
    </div> : error ? <div className="page-state" role="alert">
      <span className="state-icon"><Icon name="alert" /></span>
      <h2>No pudimos cargar el resumen</h2><p>{error}</p>
      <button className="btn-primary" type="button" onClick={onRetry}>Intentar de nuevo</button>
    </div> : summary && <>
    <div className="planning-heading"><span className="type-badge">Planificación actual</span><span>Fecha de referencia: {summary.referenceDate}</span></div>
    <div className="planning-stats" aria-label="Resumen de planificación">
      <SummaryCard icon="calendar" label="Eventos" value={summary.eventCount} description="Incluye eventos sin subtareas." />
      <SummaryCard icon="events" label="Subtareas" value={summary.taskCount} description="En tu planificación actual." />
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
      <h2>{summary.eventCount ? 'Tu plan está por comenzar' : 'Empieza con tu primer evento'}</h2>
      <p>{summary.eventCount ? 'Ya tienes eventos. Añade subtareas para ver su distribución aquí.' : 'Crea un evento y añade su plan logístico.'}</p>
      <Link className="btn-primary" to={summary.eventCount ? '/eventos' : '/crear'}>{summary.eventCount ? 'Ver mis eventos' : 'Crear evento'}</Link>
    </div>}
    <div className="planning-note"><Icon name="info" /><p>Este resumen muestra planificación. Las métricas de ejecución estarán disponibles posteriormente.</p><Link to="/hoy">Ir a Hoy<Icon name="arrow" /></Link></div>
    </>}
  </div>
}

function SummaryCard({ icon, label, value, description }) {
  return <div className="planning-stat"><span className="icon-tile"><Icon name={icon} /></span><p>{label}</p><strong>{value}</strong><span>{description}</span></div>
}
