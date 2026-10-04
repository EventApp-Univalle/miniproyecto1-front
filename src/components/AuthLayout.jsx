import Icon from './Icon'

export default function AuthLayout({ title, description, children }) {
  return (
    <div className="auth-layout">
      <section className="auth-story" aria-label="Organiza con EventApp">
        <div className="auth-wordmark"><Icon name="brand" />EventApp</div>
        <p className="auth-eyebrow">Claridad para lo que viene.</p>
        <h2>Tu próximo evento<br />empieza con un plan.</h2>
        <p>Crea tus eventos, organiza sus subtareas y encuentra lo que requiere tu atención hoy.</p>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-art-card"><span className="icon-tile"><Icon name="calendar" /></span><div><strong>De la idea al evento</strong><span className="art-line" /><span className="art-line art-line-short" /></div></div>
          <div className="auth-art-card"><span className="icon-tile"><Icon name="events" /></span><div><strong>Un plan que toma forma</strong><span className="art-line" /><span className="art-line art-line-short" /></div></div>
          <div className="auth-art-footnote"><Icon name="brand" /><span>Todo empieza con claridad.</span></div>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-header">
          <span className="icon-tile"><Icon name="brand" /></span>
          <span className="auth-card-wordmark">EventApp</span>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </div>
  )
}
