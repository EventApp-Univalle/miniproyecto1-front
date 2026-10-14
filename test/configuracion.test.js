import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, App, Navigation, ConfiguracionContent, ProgresoContent, AuthContext
before(async () => {
  server = await createServer({ envDir: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'configuration-tests-local-session', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './supabase' && importer?.endsWith('/src/auth.js')) return '\0configuration-session'
    },
    load(id) {
      if (id === '\0configuration-session') return 'export const authConfigurationError=""; export const supabase={auth:{getSession:async()=>({data:{session:null}}),signOut:async()=>({})}};'
    },
  }] })
  ;({ default: App } = await server.ssrLoadModule('/src/App.jsx'))
  ;({ default: Navigation } = await server.ssrLoadModule('/src/components/Navigation.jsx'))
  ;({ ConfiguracionContent } = await server.ssrLoadModule('/src/pages/Configuracion.jsx'))
  ;({ ProgresoContent } = await server.ssrLoadModule('/src/pages/Progreso.jsx'))
  ;({ AuthContext } = await server.ssrLoadModule('/src/auth.js'))
})
after(async () => { await server?.close() })
const session = { access_token: 'test-only-token' }
const render = (Component, props = {}, path = '/configuracion', auth = { session, loading: false }) =>
  renderToStaticMarkup(React.createElement(AuthContext.Provider, { value: auth },
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Component, props))))

test('/configuracion no monta el editor para un visitante sin sesión', () => {
  const html = render(App, {}, '/configuracion', { session: null, loading: false })
  assert.doesNotMatch(html, /capacity-panel|Administra tu disponibilidad|Consultando tu capacidad/)
})

test('/configuracion espera la verificación de sesión antes de montar el editor', () => {
  const html = render(App, {}, '/configuracion', { session: null, loading: true })
  assert.match(html, /Comprobando tu sesión/)
  assert.doesNotMatch(html, /capacity-panel/)
})

test('/configuracion autenticada muestra su encabezado y el panel en carga sin capacidad ficticia', () => {
  const html = render(App)
  assert.match(html, /<h1[^>]*>Configuración<\/h1>/)
  assert.match(html, /Define cuántas horas puedes dedicar cada día, entre todos tus eventos/)
  assert.match(html, /Consultando tu capacidad diaria/)
  assert.doesNotMatch(html, /6 h\/día|Predeterminado|Sin configurar/)
})

test('Configuración es un enlace visible de navegación principal con icono y seis acciones', () => {
  const html = render(Navigation)
  assert.match(html, /aria-label="Navegación principal"/)
  assert.match(html, /href="\/configuracion"/)
  assert.match(html, /class="nav-label">Configuración/)
  assert.equal((html.match(/class="nav-item(?: active)?"/g) || []).length, 5)
  assert.match(html, /nav-item nav-logout/)
  assert.doesNotMatch(html, /tabindex="-1"/)
})

test('Configuración tiene clase activa y aria-current solo en su ruta', () => {
  for (const [path, active] of [['/configuracion', true], ['/hoy', false], ['/progreso', false]]) {
    const html = render(Navigation, {}, path)
    const link = html.match(/<a[^>]*href="\/configuracion"[^>]*>/)?.[0]
    assert.ok(link)
    assert.equal(link.includes('aria-current="page"'), active)
    assert.equal(link.includes('class="nav-item active"'), active)
  }
})

test('navegación continúa oculta en Login y Registro', () => {
  assert.equal(render(Navigation, {}, '/login'), '')
  assert.equal(render(Navigation, {}, '/registro'), '')
})

test('Configuración presenta el valor efectivo predeterminado y personalizado con el panel reutilizado', () => {
  for (const capacity of [
    { dailyLimitHours: 6, defaultDailyLimitHours: 6, isDefault: true },
    { dailyLimitHours: 2.75, defaultDailyLimitHours: 6, isDefault: false },
  ]) {
    const html = render(ConfiguracionContent, { capacity, onSave: async () => capacity })
    assert.ok(html.includes(`${capacity.dailyLimitHours} h/día`))
    assert.ok(html.includes(capacity.isDefault ? 'Personalizar' : 'Editar'))
    assert.match(html, /capacity-panel/)
  }
})

test('error de Configuración permite reintento sin mostrar valor predeterminado ni éxito', () => {
  const html = render(ConfiguracionContent, { error: 'Error de consulta', onRetry: () => {} })
  assert.match(html, /No pudimos consultar tu capacidad/)
  assert.match(html, /Reintentar/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /6 h\/día|Capacidad diaria actualizada/)
})

test('Progreso conserva estadísticas y acceso contextual sin montar editor', () => {
  const html = render(ProgresoContent, { summary: { referenceDate: '2026-10-13', eventCount: 2,
    taskCount: 1, estimatedHours: 3.5, sections: [{ key: 'today', label: 'Para hoy', count: 1 }] } })
  assert.match(html, /Tu capacidad diaria se administra desde Configuración/)
  assert.match(html, /href="\/configuracion"/)
  assert.match(html, /Resumen de planificación/)
  assert.match(html, /3,5 h/)
  assert.doesNotMatch(html, /capacity-panel|Horas disponibles por día|Personalizar/)
})

test('Progreso no mantiene consulta ni guardado de capacidad; conserva las consultas del resumen', async () => {
  const source = await readFile(new URL('../src/pages/Progreso.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /getDailyCapacity|updateDailyCapacity|CapacityPanel|requireDailyCapacity/)
  assert.match(source, /getEvents\(controller.signal\)/)
  assert.match(source, /getTodayTasks\(controller.signal\)/)
})
