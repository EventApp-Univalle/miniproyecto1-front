# Sprint 5 — evidencia técnica de trabajo

Fecha: 2026-10-19. No es el informe académico final ni una evaluación con participantes.

## Línea base y alcance

Frontend `2ba1527`, backend `c10a700`: merges de Sprint 4 confirmados tras fetch. Árboles inicialmente limpios; main actualizado exclusivamente mediante fast-forward. Ramas Sprint 5 independientes. No commits/push/PR, migraciones, cuentas ni despliegues ejecutados.

Línea base: backend 256 pruebas, frontend 182, cero fallos. Frontend: JS principal 552,77 kB / gzip 156,34 kB; CSS 43,31 kB / gzip 7,97 kB. Build 601 ms en esa ejecución: no comparar tiempos de compilación como latencia del usuario.

Las capturas `evidence/before-*.jpg` muestran componentes reales sobre una API simulada local (rótulo QA), sin Supabase ni datos personales. No son maquetas ni prueba de persistencia remota.

## Cinco hallazgos antes de cambiar la UI

Escala Nielsen: 0 no problema; 1 cosmético; 2 menor; 3 importante; 4 crítico. Severidad propuesta por inspección técnica, no por sesiones con usuarios.

| ID | Pantalla/acción | Heurística vulnerada | Evidencia reproducible | Severidad | Impacto / recomendación | Prioridad |
|---|---|---|---|---:|---|---|
| H1 | Hoy → reprogramar | Reconocimiento; flexibilidad y eficiencia | En la tarjeta solo existe “Ver evento”; hay que localizar la subtarea y después Editar. DOM y captura before-hoy-360.jpg. | 2 | Hace menos visible la solución a una fecha vencida. Añadir Reprogramar que abra el editor existente y enfoque fecha, sin guardar al navegar. | Alta |
| H2 | Crear evento con campos vacíos | Recuperación ante errores; visibilidad del estado | En 360 px, pulsar Crear evento vacío: hay tres aria-invalid, pero el foco queda en Crear evento al pie; los errores superiores quedan fuera del área visible. before-create-errors-360.jpg. | 3 | Dificulta corregir el formulario. Añadir resumen anunciable/enlaces, enfocar el primer error y bloquear envíos concurrentes sin borrar el borrador. | Alta |
| H3 | Detalle después de fallo de red | Control y libertad; recuperación ante errores | Rama loadError de DetalleEvento ejecuta window.location.reload(). Reproducible desconectando red y pulsando Intentar de nuevo; verificación inicial por código, captura de fallo pendiente. | 2 | Reinicia toda la aplicación para una consulta y puede perder trabajo local. Reintentar las lecturas con AbortController sin recarga global. | Alta |
| H4 | Botones secundarios y filtros | Consistencia; prevención de errores de interacción | CSS border var(--border) #e5deef sobre blanco: contraste calculado 1,31:1; los inputs #9686ab sí alcanzan 3,34:1. | 2 | Límites de algunos controles poco perceptibles. Usar borde contrastado en controles y conservar el borde decorativo de cards. Añadir salto al contenido y revisar foco. | Alta |
| H5 | Porcentaje del evento | Visibilidad del estado; correspondencia con el mundo real | Render real EventProgress: 19999/20000 y 99,995 produce texto “100 %” por redondeo. HTML en before-progress.txt. | 2 | Puede comunicar finalización incorrecta. Presentar valores intermedios sin redondear a 100; conservar valor real en la barra y el conteo. | Alta |

## Contraste inicial calculado (sRGB)

Texto #696278 sobre #f0ebfa: 4,97:1; warning #996000/#fff3db: 4,74:1; success #187454/#e6f4ed: 5,06:1; danger #b93850/#fcebf0: 4,88:1; primary #7428d9/blanco: 6,89:1. Estos pares no certifican toda la pantalla. Bordes decorativos no se tratan como controles.

## Mejoras implementadas y trazabilidad

| Hallazgo | Cambio | Archivos principales | Evidencia después |
|---|---|---|---|
| H1 | Reprogramar abre el editor existente y enfoca fecha; solo Guardar cambios escribe. No se duplica el cálculo de capacidad. | Hoy.jsx, DetalleEvento.jsx, subtaskNavigation.utils.js | after-hoy-360.jpg; after-reprogram-focus-360.jpg; pruebas H1 |
| H2 | Resumen anunciable, enlaces a campos y foco en el primer error tras un envío rechazado; borrador conservado. Guardado protegido con ref. También se aplica a editar evento. | EventForm.jsx, CrearEvento.jsx, EventEditor.jsx, quality.utils.js | after-create-errors-360.jpg; pruebas H2 |
| H3 | Reintento del detalle vuelve a consultar sin recargar toda la aplicación. | DetalleEvento.jsx | QA con error de lectura controlado: contador 11→14 y cero escrituras; interfaz recuperada |
| H4 | Bordes de controles contrastados, salto al contenido, campos Login obligatorios identificados. Inspección adicional confirmó HTML lang=en para una app española: corregido a es-CO. | index.css, App.jsx, Login.jsx, index.html | after-login-360.jpg; layout-checks.json; login-layout-checks.json |
| H5 | Un porcentaje intermedio no se presenta como 100 % ni como cero por redondeo; se conserva conteo y valor real de la barra. | EventProgress.jsx, quality.utils.js | before-progress.txt; pruebas 0/50/100 y límites; after-progress-qa.jpg |

El contraste de un borde decorativo no es por sí solo una infracción WCAG. H4 es un hallazgo de percepción de controles; no se declara incumplimiento universal a partir de ese único par de colores. El idioma incorrecto es un defecto adicional comprobado por HTML, relevante para lectura asistida.

Durante el recorrido se corrigió también un estado engañoso: el formulario de creación de subtarea mostraba “Guardando…” al abrir otro editor. Ahora se distingue bloqueo por otra acción del POST realmente en curso. Se conserva el bloqueo de doble envío y todo el solucionador POST/PATCH.

## Accesibilidad: alcance comprobado

- Login, Hoy, Eventos, Progreso, Configuración y Crear: lectura del DOM a 360 y 1440 px, sin campos input/select/textarea sin etiqueta y sin overflow horizontal del contenido principal. Resultados en los dos JSON de evidencia. No equivale a revisar todas las combinaciones de datos.
- Detalle y modal de conflicto revisados a 360 px con borradores largos de prueba; editor de fecha enfocado desde Hoy. Modal desplazable, Tab/Shift+Tab permanecen dentro; Escape cancela y devuelve foco a Agregar al plan conservando el borrador. La selección de propuesta no escribe.
- Editor de ejecución: Escape cancela sin escritura; retorno al elemento de la subtarea; estado y nota guardados solo tras confirmar.
- “Saltar al contenido” con Enter enfoca main-content. Formularios muestran labels, required, aria-invalid y errores asociados; el resumen de evento tiene role=alert y enlaces. Login vacío por teclado muestra dos errores y alerta, sin llamada de autenticación.
- Idioma del documento es-CO y título de producto. Foco visible inspeccionado en campo de fecha, formulario y controles de diálogo.
- Contrastes calculados arriba; controles secundarios pasan a borde #9686ab sobre blanco, 3,34:1. No se ejecutó una auditoría automática integral de contraste ni un lector de pantalla.
- Pendiente humano: NVDA/VoiceOver, zoom 200/400 %, alto contraste, teclado en todos los CRUD/confirmaciones y revisión móvil física. No se certifica conformidad WCAG AA total.

## Pruebas automáticas finales

Entorno Node 22.23.3 / npm 10.9.9; dependencias existentes, ninguna añadida.

| Repositorio | Antes | Después | Nuevas pruebas |
|---|---:|---:|---|
| Backend | 256/256 | **263/263**, cero fallos/omitidas | 4 de entorno/servidores Swagger y 3 HTTP de CORS/401/health/errores sin detalles internos |
| Frontend | 182/182 | **192/192**, cero fallos/omitidas | 10: reprogramación, datos conservados, foco/resumen, redondeo, configuración API y enlace Swagger |

Se ejecutaron npm test en ambos repositorios, build y lint frontend; node --check de los siete JS backend nuevos/modificados y JSON.parse de OpenAPI 3.0.3, sin errores. Backend no declara script lint/build. git diff --check correcto en ambos. Las pruebas React/Vite y HTTP local se ejecutaron con permiso de servidor local; usan mocks, no Supabase real. No se eliminaron pruebas anteriores.

Build final: VITE_API_BASE_URL=https://eventapp-univalle-backend.onrender.com npm run build. Preview local de ese dist cargó Login y Documentación API sin iniciar sesión; captura production-build-login-desktop.jpg. No se instaló ni actualizó dependencia alguna: package-lock solo incorpora engines 22.x.

## Regresión T1–T4 en navegador local

Se usaron componentes React reales con sesión/API simuladas en un arnés temporal fuera del repositorio, marcado “QA LOCAL · componentes reales · API simulada · sin Supabase”. No se cambiaron datos remotos. Los contadores visibles distinguen lectura/escritura. No forma parte del producto ni se versiona el arnés.

| Flujo | Ejecutado en navegador | Alcance restante |
|---|---|---|
| T1 | Crear evento vacío → errores/foco; creación de subtarea con 409 y posterior 201; exactamente una nueva tarjeta; editar subtarea vía editor existente. | Crear/editar/eliminar evento y confirmaciones cubiertos por suite; repetir con cuenta demo y recarga para persistencia real. |
| T2 | Hoy → Reprogramar; sin escritura al navegar; fecha enfocada; estados Hecha/Pospuesta visibles tras registro. | Orden/filtros/estados cubiertos por suite; validar datos reales del despliegue y filtros manualmente. |
| T3 | POST 409, selección sin escritura, Escape sin perder datos, nueva selección y POST 201; PATCH 409 y ajuste confirmado; capacidad 6→1 guardada con advertencia de dos días; regresar por GET tras resolver elimina advertencia. | Suite conserva conflicto repetido, decimales, aislamiento y sugerencias; repetir capacidad real/concurrencia con datos QA autorizados. |
| T4 | Cancelar nota no escribe; guardar Hecha y nota sí; segunda Hecha → 2/3 = 66,7 %; progreso y Configuración se actualizan. | Suite verifica 0/50/100, Pospuesta y reactivación con 409. Repetir persistencia tras recarga con Supabase y sesión válida. |
| Red | Detalle con GET fallido → Intentar de nuevo recupera sin recarga global. | Suite cubre 401, errores y cancelación; falta sesión real vencida en esta revisión. |

La API del arnés mantiene datos solo en memoria del navegador: recargar reinicia los fixtures. **No es evidencia de persistencia, Auth real ni aislamiento remoto.** La validación humana histórica de Sprint 4 es antecedente, no una repetición automática sobre esta revisión.

## Rendimiento: medición acotada y límites

| Métrica local build Vite | Antes | Después |
|---|---:|---:|
| Chunk JS mayor | 552,77 kB | 256,48 kB |
| JS total aproximado | 552,77 kB | 556,06 kB |
| JS gzip total aproximado | 156,34 kB | 158,83 kB |
| CSS | 43,31 kB / gzip 7,97 | 44,50 kB / gzip 8,22 |

Se separaron SDK Supabase y vendor para caché; desaparece el aviso de chunk >500 kB. **No disminuyó el total de descarga**; todos son imports iniciales. No se afirma una mejora de carga inicial ni Core Web Vitals. Tiempos de compilación no son tiempos de navegación.

Mediciones de solo lectura del despliegue anterior, una muestra por recurso, sin sesión válida: HTML Vercel 200 en 0,392659 s (469 bytes), JS desplegado 200 en 0,408377 s (552804 bytes), health Render 200 en 0,277891 s. No incluyen renderizado, red del usuario ni login; no deben sumarse como tiempo de interacción. Progreso con token deliberadamente inválido devolvió 401 en 8,486075 s: no se atribuye a causa comprobada ni se declara resuelto mediante cambios locales.

El GET del detalle ya paraleliza evento/plan; no se agregó una consulta global ni GET de capacidad a Progreso. El reintento del detalle es explícito; los contadores del arnés comprobaron ausencia de escritura por selección/navegación. StrictMode puede abortar un primer efecto en desarrollo; no se retiró ni se cambió la autorización para ocultar lecturas. Falta medición comparativa con sesión real sobre el despliegue aprobado antes de afirmar mejora de latencia.

## Producción: URLs confirmadas y observaciones de solo lectura

- Frontend: https://miniproyecto1-front-wine.vercel.app
- API: https://eventapp-univalle-backend.onrender.com
- Swagger: https://eventapp-univalle-backend.onrender.com/api-docs/

El dominio histórico organizador-eventos-backend.onrender.com NO es la API actual: su health inicial respondió pero Swagger 404. Sus tiempos iniciales 12,36/0,23/0,27 s quedan descartados para evaluar el servicio vigente. La aclaración del humano permitió comprobar las URLs correctas sin modificar servicios.

Verificado:

- Bundle público Vercel referencia el Render vigente; contiene rutas/campos de ejecución y progreso de Sprint 4 y envío Bearer. No basta para demostrar cada flujo privado, pero descarta la hipótesis de una versión exclusivamente Sprint 1/2.
- Recargas HTTP de /hoy, /configuracion y /evento/:id devuelven 200 del shell SPA. vercel.json existente se conserva. No implica acceso a datos privados sin sesión.
- OpenAPI desplegado se titula “EventApp API - Sprint 4” y documenta ejecución, progreso y demás rutas actuales. Su selector solo incluye localhost: defecto confirmado, corregido **localmente** con Render y localhost; no publicado aún.
- Preflight PATCH desde origen Vercel: 204, Access-Control-Allow-Origin exacto, Authorization/Content-Type permitidos. GET /api/progreso sin token → 401 AUTH_REQUIRED; token ficticio inválido → 401 INVALID_TOKEN. No se usaron tokens/credenciales reales ni se probaron escrituras remotas.

Preparación local: Node 22.x/.nvmrc, PORT validado, CORS explícito en producción, logs sin mensajes arbitrarios de DB, enlace Documentación API en el pie desde VITE_API_BASE_URL, guardia de build contra localhost/HTTP y READMEs reproducibles. No se modificó autenticación, contrato de endpoints, SQL, secretos ni configuración remota.

OpenAPI conserva sus diez paths y todos los endpoints hasta Sprint 4, Bearer y ejemplos; solo cambia servers. El título Sprint 4 describe el contrato funcional que se conserva, no un despliegue Sprint 5 ya efectuado.

## Matriz técnica de cierre C1–C6

| Criterio | Estado técnico | Evidencia / pendiente |
|---|---|---|
| C1 Heurística | Hallazgos documentados | Cinco reproducibles, severidad/prioridad y evidencia de código/captura; no sesiones con participantes. |
| C2 Mejoras | Implementadas y verificadas localmente | H1/H2/H3/H5 funcionales + H4 accesibilidad; pruebas y capturas. |
| C3 Accesibilidad | PARCIAL | Teclado, labels, foco, idioma, contrastes muestreados y responsive; pendiente lector de pantalla/zoom y revisión completa. |
| C4 Estabilidad E2E | PARCIAL | 455 pruebas totales y QA local con mocks; pendiente T1–T4 reales, persistencia y A/B en revisión desplegada. |
| C5 Producción | PARCIAL | URLs existentes verificadas por lectura; configuración/código/README preparados; falta aprobación y despliegue de Sprint 5, prueba Auth válida y cuenta demo segura. |
| C6 Evidencias | Preparadas, entrega pendiente | Este registro, capturas, suites, archivos y bases Git; faltan commits/PR autorizados y evidencias de usuarios reales posteriores. |

## QA mínimo pendiente y operaciones humanas

1. Revisar diff de ambas ramas y aprobar integración/publicación. No hubo commit, push ni nuevo merge de entrega.
2. Verificar variables privadas Render y públicas Vercel siguiendo ambos README; no cambiarlas sin aprobación. Backend primero; frontend después. No reejecutar SQL sobre una base existente.
3. Preparar manualmente Demo A y Demo B sin datos personales; compartir claves temporales por canal privado. No publicar contraseñas en README ni capturas. No se creó ninguna cuenta.
4. Ejecutar T1: evento futuro, subtareas, editar, cancelar y confirmar eliminación solo de datos QA; recargar y comprobar persistencia.
5. T2: datos de ayer/hoy/futuro, empate por esfuerzo, filtros evento/estado, vacío/error/reintento, Hechas y Pospuestas fuera de urgentes pendientes.
6. T3: 5+2 con límite 6 (POST y PATCH 409), seleccionar no guarda, confirmar sí; conflicto nuevo; capacidad reducida guarda/advierte; recarga mantiene impacto y resolverlo elimina advertencia. Comprobar sin duplicados.
7. T4: nota + Hecha/Pospuesta, recarga, porcentajes 0/50/100, reactivar DONE con capacidad llena → 409; progreso y Hoy coherentes.
8. Seguridad: login/logout, acceso manual privado sin sesión, 401 vencido, A/B y 404 ajeno; Network Bearer y CORS sin fotografiar tokens.
9. Render /health y Swagger: servidor público seleccionable; probar Try it out únicamente con QA autorizado. Frontend: enlace al Swagger real y recargas SPA.
10. Teclado, lector de pantalla, zoom y móvil físico; medir latencia con sesión válida. Después sesiones Meet con personas reales y documentos académicos finales.

## Evidencias a conservar

Carpeta evidence: before-hoy-360.jpg, before-create-errors-360.jpg, before-progress.txt; after-hoy-360.jpg, after-reprogram-focus-360.jpg, after-create-errors-360.jpg, after-conflict-360.jpg, after-capacity-impact-360.jpg, after-progress-qa.jpg, after-progress-desktop.jpg, after-login-360.jpg y production-build-login-desktop.jpg. Los JSON registran tamaños DOM de 360/1440; las capturas del navegador pueden excluir barras del viewport. Son capturas reales, no maquetas.

Después de autorizar producción: guardar capturas T1–T4 con datos demo, Network sin credenciales, Swagger público, 0/50/100 y advertencias antes/después. Registrar resultados observados, fecha, versión y persona responsable. Kanban y DoD deben enlazar hallazgo → cambio → prueba → commit/PR cuando existan; no se inventan enlaces ni actualizaciones de tablero.

No hay Word/Excel académico final, entrevistas, participantes ni opiniones simuladas. No se modificó AGENTS.md ni SPRINT1.md.

## Archivos de esta revisión (sin commit)

### miniproyecto1-front

- `.env.example`
- `.nvmrc`
- `README.md`
- `docs/sprint5/QA.md`
- `docs/sprint5/evidence/after-capacity-impact-360.jpg`
- `docs/sprint5/evidence/after-conflict-360.jpg`
- `docs/sprint5/evidence/after-create-errors-360.jpg`
- `docs/sprint5/evidence/after-hoy-360.jpg`
- `docs/sprint5/evidence/after-login-360.jpg`
- `docs/sprint5/evidence/after-progress-desktop.jpg`
- `docs/sprint5/evidence/after-progress-qa.jpg`
- `docs/sprint5/evidence/after-reprogram-focus-360.jpg`
- `docs/sprint5/evidence/before-create-errors-360.jpg`
- `docs/sprint5/evidence/before-hoy-360.jpg`
- `docs/sprint5/evidence/before-progress.txt`
- `docs/sprint5/evidence/layout-checks.json`
- `docs/sprint5/evidence/login-layout-checks.json`
- `docs/sprint5/evidence/production-build-login-desktop.jpg`
- `docs/sprint5/verification.json`
- `index.html`
- `package-lock.json`
- `package.json`
- `src/App.jsx`
- `src/api.js`
- `src/apiEnvironment.utils.js`
- `src/components/ApiDocumentationLink.jsx`
- `src/components/EventEditor.jsx`
- `src/components/EventForm.jsx`
- `src/components/EventProgress.jsx`
- `src/index.css`
- `src/pages/CrearEvento.jsx`
- `src/pages/DetalleEvento.jsx`
- `src/pages/Hoy.jsx`
- `src/pages/Login.jsx`
- `src/quality.utils.js`
- `src/subtaskNavigation.utils.js`
- `test/quality.test.js`
- `vite.config.js`

### organizador-eventos-backend

- `.env.example`
- `.gitignore`
- `.nvmrc`
- `README.md`
- `docs/openapi.json`
- `package-lock.json`
- `package.json`
- `src/app.js`
- `src/config.js`
- `src/configuracion.routes.js`
- `src/environment.utils.js`
- `src/eventos.routes.js`
- `test/production.http.test.js`
- `test/production.test.js`

