import Icon from '../components/Icon'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getTodayTasks } from '../api'

function formatTaskDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

function TaskCard({ task }) {
  return (
    <article className="today-task-card">
      <div className="today-task-main">
        <div className="today-task-heading">
          <h3>{task.title}</h3>
        </div>
        <p className="today-task-event">{task.eventTitle}</p>
        <div className="today-task-meta">
          <span><Icon name="calendar" /> {formatTaskDate(task.targetDate)}</span>
          <span><Icon name="clock" /> {task.estimatedHours} h</span>
        </div>
      </div>
      <div className="today-task-side">
        <Link to={`/evento/${task.eventId}`} className="btn-detail">
          Ver evento <Icon name="arrow" />
        </Link>
      </div>
    </article>
  )
}

const TASKS_PER_PAGE = 5

const DATE_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'today', label: 'Para hoy' },
  { value: 'upcoming', label: 'Próximas' },
]

function TaskSection({ title, tasks, tone }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * TASKS_PER_PAGE
  const visibleTasks = tasks.slice(startIndex, startIndex + TASKS_PER_PAGE)

  return (
    <section className={`today-task-section today-task-section-${tone}`}>
      <div className="section-header">
        <h2>{title}</h2>
        <span className="counter-pill">{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        <>
          <div className="today-task-list">
            {visibleTasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </div>
          {totalPages > 1 && (
            <nav className="pagination" aria-label={`Paginación de ${title}`}>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Anterior
              </button>
              <span className="pagination-info" aria-live="polite">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente →
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="today-empty-state"><Icon name="check" /><span>No hay tareas en esta sección.</span></div>
      )}
    </section>
  )
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      <span className="filter-group-label">{label}</span>
      <div className="filter-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`filter-chip${value === option.value ? ' filter-chip-active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Hoy() {
  const [groups, setGroups] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [eventOptions, setEventOptions] = useState([])
  const [dateFilter, setDateFilter] = useState('all')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadTasks() {
      setIsLoading(true)
      setLoadError('')
      try {
        const data = await getTodayTasks(controller.signal, eventFilter === 'all' ? undefined : eventFilter)
        if (controller.signal.aborted) return
        if (!data || typeof data.referenceDate !== 'string' ||
            !['overdue', 'today', 'upcoming'].every(key => Array.isArray(data[key]))) {
          throw new Error('No pudimos interpretar la lista de tareas. Inténtalo nuevamente.')
        }
        setGroups(data)
        if (eventFilter === 'all') {
          const events = new Map([...data.overdue, ...data.today, ...data.upcoming]
            .map(task => [task.eventId, task.eventTitle]))
          setEventOptions([...events].map(([value, label]) => ({ value, label })))
        }
      } catch (error) {
        if (controller.signal.aborted || error.name === 'AbortError') return
        setLoadError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    loadTasks()
    return () => controller.abort()
  }, [eventFilter, retry])

  const overdueTasks = groups?.overdue ?? []
  const todayTasks = groups?.today ?? []
  const upcomingTasks = groups?.upcoming ?? []
  const visibleSections = [
    { key: 'overdue', title: 'Vencidas', tasks: overdueTasks },
    { key: 'today', title: 'Para hoy', tasks: todayTasks },
    { key: 'upcoming', title: 'Próximas', tasks: upcomingTasks },
  ].filter(section => dateFilter === 'all' || section.key === dateFilter)
  const totalCount = overdueTasks.length + todayTasks.length + upcomingTasks.length
  const visibleCount = visibleSections.reduce((count, section) => count + section.tasks.length, 0)
  const hasActiveFilters = eventFilter !== 'all' || dateFilter !== 'all'
  function clearFilters() {
    setEventFilter('all')
    setDateFilter('all')
  }

  if (isLoading) return (
    <div className="page-state today-state" role="status" aria-live="polite">
      <span className="state-icon"><Icon name="loader" /></span>
      <h1>Cargando tus tareas</h1>
      <p>Estamos consultando tus subtareas.</p>
    </div>
  )
  if (loadError) return (
    <div className="page-state today-state" role="alert">
      <span className="state-icon"><Icon name="alert" /></span>
      <h1>No pudimos cargar tus tareas</h1>
      <p>{loadError}</p>
      <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>Intentar de nuevo</button>
      {hasActiveFilters && <button type="button" className="btn-secondary" onClick={clearFilters}>Limpiar filtros</button>}
    </div>
  )

  return (
    <div className="page-container today-page">
      <header className="app-header">
        <div>
          <span className="app-badge"><Icon name="brand" />EventApp</span>
          <h1 className="page-title">Hoy</h1>
          <p className="page-description">Prioriza lo que requiere tu atención</p>
        </div>
        <div className="today-date-badge"><Icon name="calendar" /><div><span className="today-date-label">Fecha de referencia</span><span>{groups ? formatTaskDate(groups.referenceDate) : ''}</span></div></div>
      </header>
      <section className="today-priority-summary" aria-label="Resumen de tareas">
        <div className="today-summary-art" aria-hidden="true"><Icon name="calendar" /><span><Icon name="check" /></span></div>
        <div>
          <span className="today-summary-label">Atención del día</span>
          <strong><span className="today-attention-count">{overdueTasks.length + todayTasks.length}</span><span>tareas requieren atención</span></strong>
        </div>
        <span className="today-summary-count"><Icon name="events" /><span>{visibleCount} de {totalCount} tareas</span></span>
      </section>
      <details className="today-order-help">
        <summary><Icon name="info" /><span>¿Cómo se ordena?</span><span className="help-chevron" aria-hidden="true">⌄</span></summary>
        <p>Las subtareas se agrupan en Vencidas, Para hoy y Próximas según su fecha objetivo. Dentro de cada grupo se ordenan por fecha y, en caso de empate, primero se muestra la de menor esfuerzo estimado.</p>
      </details>
      <section className="today-filters" aria-label="Filtros de tareas">
        <div className="filter-group">
          <label className="filter-group-label" htmlFor="today-event-filter">Evento</label>
          <select id="today-event-filter" value={eventFilter} onChange={event => setEventFilter(event.target.value)}>
            <option value="all">Todos los eventos</option>
            {eventOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <FilterGroup label="Fecha" options={DATE_FILTERS} value={dateFilter} onChange={setDateFilter} />
        {hasActiveFilters && <button type="button" className="filter-clear" onClick={clearFilters}>Limpiar filtros</button>}
      </section>
      {visibleCount > 0 ? (
        <div className="today-task-sections">
          {visibleSections.map(section => (
            <TaskSection key={eventFilter + '-' + section.key} title={section.title} tasks={section.tasks} tone={section.key} />
          ))}
        </div>
      ) : (
        <div className="today-empty-state today-empty-filtered" role="status">
          <span className="today-empty-icon"><Icon name="inbox" /></span>
          {hasActiveFilters ? (
            <>
              <p>No hay subtareas para los filtros seleccionados.</p>
              <button type="button" className="btn-secondary" onClick={clearFilters}>Limpiar filtros</button>
            </>
          ) : (
            <>
              <p>Aún no tienes subtareas. Crea un evento y añade su plan de trabajo.</p>
              <Link to="/crear" className="btn-secondary">Crear evento</Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
