# Control Operativo: Mantenimiento de Grifos y Unidades

Aplicación para registrar, dar seguimiento y resolver reportes de mantenimiento en grifos (estaciones de servicio) y en unidades de transporte (tractos y carretas). Incluye inventario por estación, control de accesos por permisos y notificaciones. Se distribuye como web instalable (PWA) y como app Android.

## ¿Qué problema resuelve?

El personal operativo de una empresa de grifos y transporte no completaba el registro de mantenimiento en Excel, porque debía llenarlo al llegar a la oficina y muchas veces se olvidaba. Control Operativo permite reportar la falla desde el campo, con foto obligatoria, y darle seguimiento hasta cerrarla.

En producción desde septiembre de 2026, con uso diario del personal operativo y de la gerencia.

## Funcionalidades principales

**Operario**
- Crear reportes de mantenimiento para **Grifos** o **Unidades** (tractos y carretas), con detalles y evidencia fotográfica obligatoria.
- Visor de Soluciones y Base de Conocimiento.
- Trabajo sin conexión: los reportes se guardan en una cola local (IndexedDB) y se sincronizan al volver la red.

**Gerencia**
- Dashboard Operativo con KPIs y gráficos.
- Proyección de fallas: regresión lineal sobre la cantidad de reportes por día, que estima las fallas de los próximos 7 días (`Gerencia.jsx`, sección "Proyección IA").
- Pronóstico de consumo de repuestos en el inventario: calcula el consumo diario a partir de los repuestos registrados en los reportes y estima el consumo de 30 días. Si el pronóstico supera el stock actual, muestra una alerta de compra (`Gerencia.jsx`, pestaña de inventario, columna "Pronóstico IA (30 días)").
- Visor de Soluciones.
- Gestión de Accesos (ABAC): permisos por usuario para dashboard, soluciones, inventario, configuración, crear reportes de grifos/unidades, ver grifos/unidades y editar reportes.
- Inventario global por estación, con movimientos (kardex).
- Configuración de estaciones (islas y lados) y catálogo de tipos de mantenimiento.
- Mantenimiento del sistema: consulta del registro de errores (`error_logs`).

**Transversal**
- Estados de reporte: Pendiente, En Proceso y Resuelto, con historial de seguimiento.
- Inicio de sesión con usuario y contraseña (RPC `login_usuario`), con opción "Recordar mi sesión".
- Notificaciones push: FCM en Android (Capacitor) y Web Push (VAPID) en la versión web/PWA.
- Actualización en tiempo real de permisos mediante suscripción a cambios de la tabla `usuarios`.
- Compresión de fotos a WebP antes de subirlas.
- Guardado de fotos en la galería de Android mediante un plugin nativo propio (`GallerySaver`).
- Caché de catálogos en memoria y en `localStorage`, para trabajar con los datos de la última sincronización.

## Stack tecnológico

- **Frontend:** React 18, Vite 5, JavaScript (JSX), CSS propio (`styles.css`).
- **Gráficos:** chart.js, react-chartjs-2, chartjs-plugin-datalabels.
- **Backend:** Supabase (`@supabase/supabase-js`): base de datos Postgres, RPC, Storage (bucket `evidencias`) y Realtime (`postgres_changes`).
- **Almacenamiento local:** idb-keyval (IndexedDB) y localStorage.
- **App Android:** Capacitor 8 con los plugins app, camera, filesystem, keyboard, local-notifications, network, push-notifications, share y `@capawesome/capacitor-badge`. Incluye un plugin nativo en Java (`GallerySaverPlugin.java`).
- **PWA:** vite-plugin-pwa (estrategia `injectManifest`), service worker propio en `src/sw.js`, y `web-push` para el envío de notificaciones.
- **Despliegue:** GitHub Actions publicando en GitHub Pages (`.github/workflows/deploy-pages.yml`).
- **Utilidades:** `scripts/recomprimir_fotos.mjs` (Node) para recomprimir fotos antiguas.

## Estructura del repositorio

```
frontend/
├── src/
│   ├── App.jsx                  # Sesión, roles, notificaciones y botón "Atrás"
│   ├── main.jsx                 # Arranque y registro del service worker (solo web)
│   ├── sw.js                    # Service worker: caché del shell y push web
│   ├── supabaseClient.js        # Cliente de Supabase
│   ├── components/              # Login, Operario, Gerencia, reportes, visor, modales
│   └── utils/                   # Cola offline, caché, push, permisos, imágenes, etc.
├── android/                     # Proyecto nativo Capacitor (Android)
├── database_supabase.sql        # Esquema base de la base de datos
├── supabase_migration_seguridad.sql
├── scripts/recomprimir_fotos.mjs
└── vite.config.js
```

## Requisitos

- Node.js 20 (la versión que usa el workflow de CI).
- Un proyecto de Supabase con el esquema aplicado.
- Para generar la APK: Android Studio, con `ANDROID_HOME` y `JAVA_HOME` configurados (ver `frontend/README_APK.md`).

## Instalación y ejecución

1. Clonar el repositorio y entrar a la carpeta del frontend:
   ```bash
   git clone https://github.com/LuisTE1/sistema_reporte_mantenimiento.git
   cd sistema_reporte_mantenimiento/frontend
   npm install
   ```

2. Configurar la conexión a Supabase editando `src/supabaseClient.js` con la URL y la clave anónima de tu proyecto.

3. Crear la base de datos en el SQL Editor de Supabase, en este orden:
   - `database_supabase.sql`
   - `supabase_migration_seguridad.sql`

   También hay que crear manualmente un bucket de Storage llamado `evidencias`, que el código usa para las fotos.

4. Ejecutar en desarrollo:
   ```bash
   npm run dev
   ```

5. Generar la versión de producción:
   ```bash
   npm run build
   ```
   Los archivos quedan en `frontend/dist/`.

6. **App Android:** seguir los pasos de `frontend/README_APK.md` (`npm run build`, `npx cap sync`, abrir en Android Studio y compilar). Para las notificaciones FCM, el archivo `android/app/google-services.json` debe estar en la carpeta local; no está versionado.

7. **Versión web / PWA:** al publicar `dist/` en GitHub Pages, la app puede instalarse desde el navegador. En iPhone, desde Safari, usar "Compartir → Agregar a pantalla de inicio".

## Notas

- Parte del backend no está en este repositorio. El cliente llama a una función `send-report-notification` (mencionada en `src/utils/usuario.js`), y usa las tablas `push_tokens` y `push_subscriptions_web`. Ni la función ni los triggers o tareas programadas que envían las notificaciones están versionados aquí, y tampoco el bucket `evidencias` ni esas tablas aparecen en los scripts SQL.
- El `google-services.json` y las claves privadas no deben subirse al repositorio.
