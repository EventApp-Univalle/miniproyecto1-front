import { Link } from 'react-router'

export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className="type-badge">{event.type}</span>
        {event.isPriority && <span className="priority-badge">Prioritario</span>}
      </div>
      <h3 className="event-title">{event.title}</h3>
      <div className="event-info">
        <p className="event-detail">
          <span className="icon">🗓️</span> {event.date}
        </p>
        {event.time && <p className="event-detail">
          <span className="icon">⏰</span> {event.time}
        </p>}
        {event.location && <p className="event-detail">
          <span className="icon">📍</span> {event.location}
        </p>}
      </div>
      <div className="event-card-footer">
        <Link to={`/evento/${event.id}`} className="btn-detail">
          Ver evento →
        </Link>
      </div>
    </article>
  )
}
