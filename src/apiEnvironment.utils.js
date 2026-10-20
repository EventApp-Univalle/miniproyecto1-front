export function resolveApiBaseUrl(value, production = false) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw && !production) return 'http://localhost:3000'
  let url
  try { url = new URL(raw) } catch { throw new Error('Configura VITE_API_BASE_URL con la URL de la API.') }
  const local = ['localhost', '0.0.0.0', '[::1]'].includes(url.hostname) || /^127\./.test(url.hostname) || url.hostname.endsWith('.localhost')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      (production && (url.protocol !== 'https:' || local))) {
    throw new Error('En producción, VITE_API_BASE_URL debe ser una URL HTTPS pública, sin credenciales ni parámetros.')
  }
  return url.href.replace(/\/$/, '')
}

export function apiDocsUrl(base) {
  return base ? `${base}/api-docs/` : null
}
