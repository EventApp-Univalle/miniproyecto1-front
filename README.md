# EventApp — frontend

Aplicación académica de Proyecto Integrador I, Universidad del Valle. Organiza eventos y subtareas, consulta Hoy, resuelve sobrecargas, registra ejecución y muestra progreso.

## Arquitectura

React 19 + Vite 8 + React Router. Supabase Auth gestiona registro/login; React solo usa la **publishable key** y envía `Authorization: Bearer <access_token>` a Express. No accede a tablas Supabase. Los repositorios frontend y backend son independientes; no son un monorepo.

URLs reales confirmadas por el equipo y consultadas por solo lectura el 2026-10-19:

- Frontend: https://miniproyecto1-front-wine.vercel.app
- API: https://eventapp-univalle-backend.onrender.com
- Swagger: https://eventapp-univalle-backend.onrender.com/api-docs/

La URL antigua `organizador-eventos-backend.onrender.com` no es la API vigente. La producción consultada contiene el código de Sprint 4, **no estas correcciones locales de Sprint 5**. No se ejecutó un despliegue.

## Requisitos e instalación

Node **22.23.3** (`.nvmrc`, engines 22.x), npm 10.9.9, Git. Desde este repositorio:

```bash
nvm install
nvm use
npm ci
cp .env.example .env
```

Editar `.env` local, nunca versionarlo:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Son valores públicos de Vite; **nunca** incluir `SUPABASE_SECRET_KEY`, `service_role`, contraseñas o JWT en React. Para usar el backend desplegado, cambiar únicamente la base a `https://eventapp-univalle-backend.onrender.com` y comprobar que CORS permita el origen del frontend. Usar el mismo proyecto Supabase que el backend.

## Ejecución local

En otra terminal, dentro de `organizador-eventos-backend`, configurar su `.env` según su README y ejecutar `npm start` (puerto 3000). Las migraciones son responsabilidad del backend: `sql/001_initial.sql` a `005_subtask_execution.sql`; **no reejecutarlas sobre una base ya inicializada**.

```bash
npm run dev -- --host 127.0.0.1
```

Abrir http://localhost:5173. El login/registro usa Supabase real: no crear cuentas ni modificar datos de producción como parte de pruebas automáticas. Las pruebas de este repositorio usan mocks.

## Verificación

```bash
npm test
npm run lint
git diff --check
```

Build de producción: exige una base API **HTTPS pública**, incluso al compilar localmente; rechaza localhost, valores vacíos, credenciales o parámetros en la URL.

```bash
VITE_API_BASE_URL=https://eventapp-univalle-backend.onrender.com npm run build
npm run preview -- --host 127.0.0.1
```

El SDK y las dependencias se separan para caché; no se afirma que disminuya el total de descarga. Revisar métricas y evidencias en `docs/sprint5/QA.md`.

## Vercel: pasos pendientes tras autorización

1. Revisar los cambios, aprobar integración y publicar la revisión autorizada; aquí no se hizo commit/push/PR/merge de entrega.
2. En el proyecto Vercel existente: Framework Vite, Node 22.x, Install `npm ci`, Build `npm run build`, Output `dist`.
3. Configurar en Production (y por separado Preview si procede):
   - `VITE_API_BASE_URL=https://eventapp-univalle-backend.onrender.com`
   - `VITE_SUPABASE_URL`: URL pública del proyecto correcto.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key de ese proyecto.
4. Confirmar que backend y migraciones compatibles estén disponibles; después realizar el despliegue aprobado. Las variables VITE se incorporan al compilar: cambiarlas requiere nuevo build.
5. Mantener `vercel.json`: reescribe rutas SPA a `/index.html`. Probar recarga directa de `/hoy`, `/configuracion` y `/evento/:id`.
6. Verificar login/logout, 401, Bearer, CORS, T1–T4 y el enlace **Documentación API** del pie. Este deriva de `VITE_API_BASE_URL` y abre `/api-docs/` en una pestaña nueva, sin pasar tokens por URL.
7. Revisar en Supabase Auth las URLs permitidas de producción con el responsable, sin cambiar credenciales ni habilitar acceso a tablas. No se modifica esa configuración automáticamente.

No permitir `*` en CORS ni usar URLs efímeras de Preview sin añadir explícitamente su origen autorizado al backend. No se crearon servicios pagos ni se modificó configuración remota.

## Cuenta demo y recorrido T1–T4

No se publican credenciales reales. El coordinador debe preparar manualmente cuentas separadas **Demo A / Demo B** sin información personal, entregar claves temporales por canal privado y revocarlas/rotarlas después. No se crea una cuenta automáticamente ni se reutilizan cuentas privadas. Sin este paso, el acceso demo compartido sigue pendiente.

Datos sugeridos (creados por el equipo con autorización): evento “Demo encuentro cultural”, fecha futura, subtareas “Confirmar sonido” (5 h) y “Preparar materiales” (2 h). Usar fechas de prueba que permitan mostrar Hoy y el plazo del evento.

- T1: crear evento, plan, editar y eliminar una subtarea de prueba con confirmación.
- T2: grupos de Pendientes, filtros por evento/estado; localizar Hechas y Pospuestas.
- T3: provocar 5 + 2 h con límite 6; resolver mediante propuesta explícita. Reducir límite y comprobar advertencia persistente.
- T4: cuatro subtareas, dos Hechas con nota → 50 %; recargar, comprobar nota y progreso; revertir con validación de capacidad.

No atribuir opiniones ni resultados a participantes. Los ensayos Google Meet y el informe académico se realizarán posteriormente.

## Límites y referencias

- Preparación local de Sprint 5 no equivale a despliegue completado ni certificación WCAG total.
- Falta prueba real con sesión válida y aislamiento A/B de esta revisión; las comprobaciones públicas solo cubren bundle, rutas SPA, CORS y rechazo 401.
- Persisten los límites de concurrencia de capacidad documentados en backend.
- Ayuda oficial: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [contraste de texto WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [contraste de componentes WCAG](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
