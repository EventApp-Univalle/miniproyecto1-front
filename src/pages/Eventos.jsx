import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getEvents } from '../api'
import EventCard from '../components/EventCard'

export default function Eventos() {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadEvents() {
      setIsLoading(true)
      setError('')
      try {
        const data = await getEvents(controller.signal)
        if (controller.signal.aborted) return
        if (!Array.isArray(data)) throw new Error('No pudimos interpretar el listado de eventos.')
        setEvents(data)
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'AbortError') setError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    loadEvents()
    return () => controller.abort()
  }, [retry])

  if (isLoading) return (
    <div className="page-state" role="status" aria-live="polite">
      <span className="state-icon" aria-hidden="true"><Icon name="loader" /></span>
      <h1>Cargando tus eventos</h1>
      <p>Estamos consultando tu listado de eventos.</p>
    </div>
  )

  if (error) return (
    <div className="page-state" role="alert">
      <span className="state-icon" aria-hidden="true"><Icon name="alert" /></span>
      <h1>No pudimos cargar tus eventos</h1>
      <p>{error}</p>
      <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>
        Intentar de nuevo
      </button>
    </div>
  )

  return <EventosContent events={events} />
}

export function EventosContent({ events }) {
  return (
    <div className="page-container">
      <PageHeader title="Eventos" description="Consulta tus eventos y abre su plan logístico." action={<Link to="/crear" className="btn-primary"><Icon name="plus" />Crear evento</Link>} />
      {events.length ? (
        <div className="events-grid">
          {events.map(event => <EventCard key={event.id} event={event} />)}
        </div>
      ) : (
        <div className="page-state" role="status">
          <span className="state-icon"><Icon name="inbox" /></span>
          <h2>Aún no tienes eventos.</h2>
          <p>Crea el primero y empieza a organizar su plan logístico.</p>
          <Link to="/crear" className="btn-secondary">Crear evento</Link>
        </div>
      )}
    </div>
  )
}
