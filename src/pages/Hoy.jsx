import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getTodayTasks } from '../api'

const priorityOrder = { Alta: 0, Media: 1, Baja: 2 }

function getToday() {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function formatTaskDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

function sortTasks(firstTask, secondTask) {
  return firstTask.date.localeCompare(secondTask.date)
    || priorityOrder[firstTask.priority] - priorityOrder[secondTask.priority]
    || firstTask.estimatedHours - secondTask.estimatedHours
}

function TaskCard({ task }) {
  return (
    <article className="today-task-card">
      <div className="today-task-main">
        <div className="today-task-heading">
          <span className={`priority-dot priority-${task.priority.toLowerCase()}`} />
          <h3>{task.title}</h3>
        </div>
        <p className="today-task-event">{task.eventTitle}</p>
        <div className="today-task-meta">
          <span>📅 {formatTaskDate(task.date)}</span>
          <span>⏱️ {task.estimatedHours} h</span>
        </div>
      </div>
      <div className="today-task-side">
        <span className={`priority-label priority-label-${task.priority.toLowerCase()}`}>
          {task.priority}
        </span>
        <Link to={`/evento/${task.eventId}`} className="btn-detail">
          Ver evento →
        </Link>
      </div>
    </article>
  )
}

const TASKS_PER_PAGE = 5

const PRIORITY_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Media', label: 'Media' },
  { value: 'Baja', label: 'Baja' },
]

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
        <div className="today-empty-state">No hay tareas en esta sección.</div>
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
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    const controller = new AbortController()

    async function loadTasks() {
      setIsLoading(true)
      setLoadError('')

      try {
        setTasks(await getTodayTasks(controller.signal))
      } catch (error) {
        if (error.name === 'AbortError') return
        setLoadError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadTasks()
    return () => controller.abort()
  }, [])

  const today = getToday()
  const sortedTasks = [...tasks].sort(sortTasks)

  const filteredTasks = sortedTasks.filter((task) => {
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    if (dateFilter === 'overdue' && task.date >= today) return false
    if (dateFilter === 'today' && task.date !== today) return false
    if (dateFilter === 'upcoming' && task.date <= today) return false
    return true
  })

  const overdueTasks = filteredTasks.filter((task) => task.date < today)
  const todayTasks = filteredTasks.filter((task) => task.date === today)
  const upcomingTasks = filteredTasks.filter((task) => task.date > today)

  const hasActiveFilters = priorityFilter !== 'all' || dateFilter !== 'all'

  function clearFilters() {
    setPriorityFilter('all')
    setDateFilter('all')
  }

  if (isLoading) {
    return (
      <div className="page-state" role="status" aria-live="polite">
        <span className="state-icon">⏳</span>
        <h1>Cargando tus tareas</h1>
        <p>Estamos organizando tus prioridades del día.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-state" role="alert">
        <span className="state-icon">⚠️</span>
        <h1>No pudimos cargar tus tareas</h1>
        <p>{loadError}</p>
        <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="page-container">
      <header className="app-header">
        <div>
          <span className="app-badge">EventApp</span>
          <h1 className="page-title">Hoy</h1>
          <p className="page-description">Prioriza lo que requiere tu atención</p>
        </div>
        <div className="today-date-badge">
          📅 {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </header>

      <section className="today-priority-summary">
        <div>
          <span className="today-summary-label">Prioridad del día</span>
          <strong>{overdueTasks.length + todayTasks.length} tareas requieren atención</strong>
        </div>
        <span className="today-summary-count">{filteredTasks.length} de {tasks.length} tareas</span>
      </section>

      <section className="today-filters" aria-label="Filtros de tareas">
        <FilterGroup
          label="Prioridad"
          options={PRIORITY_FILTERS}
          value={priorityFilter}
          onChange={setPriorityFilter}
        />
        <FilterGroup
          label="Fecha"
          options={DATE_FILTERS}
          value={dateFilter}
          onChange={setDateFilter}
        />
        {hasActiveFilters && (
          <button type="button" className="filter-clear" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </section>

      {filteredTasks.length > 0 ? (
        <div className="today-task-sections">
          <TaskSection title="Vencidas" tasks={overdueTasks} tone="overdue" />
          <TaskSection title="Para hoy" tasks={todayTasks} tone="today" />
          <TaskSection title="Próximas" tasks={upcomingTasks} tone="upcoming" />
        </div>
      ) : (
        <div className="today-empty-state today-empty-filtered" role="status">
          No hay tareas que coincidan con los filtros seleccionados.
        </div>
      )}
    </div>
  )
}