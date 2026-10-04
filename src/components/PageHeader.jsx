import Icon from './Icon'

export default function PageHeader({ title, description, action }) {
  return (
    <header className="app-header">
      <div>
        <span className="app-badge"><Icon name="brand" />EventApp</span>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </header>
  )
}
