import { API_BASE_URL } from '../api'
import { apiDocsUrl } from '../apiEnvironment.utils'

export default function ApiDocumentationLink({ baseUrl = API_BASE_URL }) {
  const url = apiDocsUrl(baseUrl)
  return <footer className="api-footer">
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">Documentación API<span className="sr-only"> (abre en otra pestaña)</span></a>
      : <span>Documentación API no disponible.</span>}
  </footer>
}
