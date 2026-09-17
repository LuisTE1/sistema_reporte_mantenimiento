# 🚀 PRODUCTION PROPOSAL — Sistema de Mantenimiento

> Diagnóstico UI/UX Mobile-First, Configuración APK y Optimización de Build  
> Fecha: 2026-09-05 | Auditor: Staff Frontend / UI-UX Mobile-First

---

## 📋 Resumen Ejecutivo

| Aspecto | Estado Actual | Acción Requerida |
|---------|:---:|---|
| **Responsividad Móvil** | 🟡 Parcial | Media queries existentes pero inline-styles sin responsive |
| **Touch-Friendly UI** | 🔴 Deficiente | Botones y targets táctiles por debajo de 44×44px |
| **PWA / Viewport** | 🟡 Parcial | Viewport meta presente, pero sin `viewport-fit=cover` ni `user-scalable=no` |
| **Capacitor (APK)** | 🔴 No configurado | No existe `capacitor.config.ts`, ni carpeta `android/`, ni dependencias instaladas |
| **Android SDK / JDK** | 🔴 No instalado | `java`, `gradle` y `ANDROID_HOME` no disponibles en el sistema |
| **Build de Producción** | 🟢 Funcional | `npm run build` compila sin errores (warning de chunk size esperado) |
| **SEO / Meta tags** | 🟡 Mínimo | Solo `<title>`, falta `<meta name="description">`, favicon, manifest |
| **Tipografía** | 🟢 Buena | Google Fonts `Outfit` cargada correctamente |
| **Paleta de Colores** | 🟢 Buena | Variables CSS con dark-mode nativo coherente |
| **Accesibilidad** | 🟡 Parcial | IDs únicos faltantes en elementos interactivos |

---

## PARTE 1: DIAGNÓSTICO UI/UX MOBILE-FIRST

### 1.1 Arquitectura de Componentes Actual

```
frontend/
├── index.html              ← Entry point (viewport meta OK, sin PWA manifest)
├── vite.config.js           ← Config mínima, sin optimización de chunks
├── package.json             ← 6 dependencias, sin Capacitor
└── src/
    ├── main.jsx             ← React 18 mount point
    ├── supabaseClient.js    ← Configuración Supabase
    ├── styles.css           ← 173 líneas, media query en @768px
    ├── App.jsx              ← Router por rol (Operario / Gerencia)
    └── components/
        ├── Login.jsx        ← 105 líneas (formulario simple)
        ├── Operario.jsx     ← 846 líneas (mobile-view wrapper)
        └── Gerencia.jsx     ← 1926 líneas (desktop-layout + sidebar)
```

### 1.2 Problemas Críticos Detectados para Móvil

#### 🔴 P1 — Inline Styles sin Responsive Fallback

**Problema:** El 85% del layout en `Gerencia.jsx` y `Operario.jsx` usa `style={{...}}` en JSX (no classes CSS). Estos estilos son inmutables por media queries.

**Ejemplos concretos:**
- `Gerencia.jsx:785` — Grid de charts con `gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'` → En pantallas < 360px, esto genera scroll horizontal.
- `Gerencia.jsx:706-735` — Dashboard filters con `display: flex, flexWrap: wrap` pero con `gap: 1rem` fijo que comprime inputs de fecha en pantallas pequeñas.
- `Operario.jsx:728` — `.grid-2` referenciado por className (se colapsa a 1 columna en `@media max-width:768px`), CORRECTO.
- `Gerencia.jsx:1040` — Modal de detalle con `gridTemplateColumns: '1fr 1fr'` fijo → En móvil, los campos Tracto/Carreta quedan truncados.

**Solución propuesta:** Migrar los inline-styles más críticos a clases CSS en `styles.css` con media queries adecuadas, especialmente para grids, flexboxes y padding de containers.

---

#### 🔴 P2 — Targets Táctiles Insuficientes

**Estándar:** WCAG 2.5.5 requiere mínimo 44×44px para áreas de toque en móvil.

| Elemento | Tamaño Actual | Ubicación | Fix |
|----------|:---:|---|---|
| Botón cerrar modal `×` | ~24×24px | `Operario.jsx:839`, `Gerencia.jsx:1037` | Aumentar a 44×44px |
| Chips de estación (dashboard filters) | ~32px altura | `Gerencia.jsx:743` | `min-height: 44px` |
| Botón eliminar foto `×` | 20×20px | `Operario.jsx:772, 788` | Aumentar a 32×32px mínimo |
| Inputs de fecha | padding `0.4rem` | `Gerencia.jsx:715-717` | `min-height: 44px` |
| `btn-text` (cerrar sesión, cancelar) | Solo texto sin padding | Varios | Agregar `padding: 12px 16px` |
| Tabs del sidebar en móvil | padding OK (`1rem`) | ✅ Correcto | — |

---

#### 🟡 P3 — Scrolling y Overflow en Pantallas Pequeñas

- **Tablas (`Gerencia.jsx`):** Las tablas de usuarios e inventario tienen `min-width: 600px` en el CSS, lo cual fuerza scroll horizontal en móvil. ✅ Este es un comportamiento aceptable, pero falta un indicador visual de scroll ("swipe →").
- **Modales:** Los modales usan `maxHeight: '90vh', overflowY: 'auto'`, ✅ correcto.
- **Charts:** Los gráficos Chart.js no son redimensionados explícitamente al cambiar de viewport. Capacitor renderiza en WebView sin resize events automáticos.

**Solución propuesta:** Añadir `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no">` y CSS para safe-area-inset.

---

#### 🟡 P4 — Fonts y Legibilidad

- **Font base:** `Outfit` → Excelente para móvil, pesos 300-700 cargados.
- **Problemas específicos:**
  - `Gerencia.jsx:797` — Labels de Pareto truncados a 15 caracteres, OK para desktop, ilegible en móvil (texto rotado a 45° no entra).
  - `.subtitle` a `0.875rem` (14px) → Mínimo aceptable.
  - Inputs de filtro con `fontSize: '0.8rem'` → Debajo del umbral de legibilidad en algunos Android (recomiendo `0.875rem`).

---

#### 🟡 P5 — Animaciones y Transiciones

- **Hovers:** Múltiples `onMouseOver` / `onMouseOut` para `transform: scale(1.02)` → Estos no aplican en pantalla táctil. No causan daño pero no aportan feedback visual en APK.
- **Transiciones existentes:** `transition: all 0.2s` en cards y sidebar, ✅ funcionales.
- **Falta:** No hay estado visual de `:active` ni `:focus-visible` para feedback táctil.

**Solución propuesta:** Añadir CSS `:active` states para todos los elementos interactivos con `transform: scale(0.97)` y `opacity: 0.85` como feedback instantáneo.

---

### 1.3 Problemas de UX Específicos para APK

| Problema | Detalle | Impacto |
|----------|---------|---------|
| **Status Bar overlap** | Sin `safe-area-inset-top` | Contenido queda debajo de la barra de estado del Android |
| **Notch / Cutout** | Sin `viewport-fit: cover` | En devices con notch, zonas laterales quedan cortadas |
| **Splash screen** | No existe configuración | App muestra pantalla blanca 1-3s al iniciar |
| **App icon** | No existe configuración | Se usará icono genérico de Android |
| **Back button nativo** | Sin handler | El botón "atrás" de Android cierra la app en vez de navegar |
| **Keyboard push** | Sin `resize` mode | Al abrir teclado, los inputs pueden quedar detrás del teclado |
| **Orientación** | Sin restricción | App funciona en landscape pero la UI no está optimizada para ello |

---

## PARTE 2: ESTADO DE CONFIGURACIÓN PARA APK

### 2.1 Herramienta Recomendada: Capacitor (Ionic)

**Razón:** El proyecto es una SPA React con Vite. Capacitor es la solución nativa más liviana y compatible. No requiere reescribir nada de React.

**Versión detectada via npx:** `@capacitor/cli@8.5.1` (disponible para descarga).

### 2.2 Archivos Necesarios (No Existen Aún)

| Archivo | Estado | Propósito |
|---------|:---:|---|
| `capacitor.config.ts` | 🔴 Falta | Configuración principal (appId, appName, webDir) |
| `android/` | 🔴 Falta | Proyecto nativo de Android (generado por `cap add android`) |
| `android/app/src/main/res/` | 🔴 Falta | Iconos (mipmap) y splash screens |
| `.browserslistrc` | 🔴 Falta | Target de navegadores para el build |

### 2.3 Estado del Entorno Local

```
✅ Node.js        — Instalado (npx funcional via cmd.exe)
✅ npm             — Funcional (npm run build OK)
✅ Vite 5.4.21     — Funcional
✅ Capacitor CLI   — Disponible (8.5.1 via npx)
❌ Java JDK        — No encontrado (where java vacío)
❌ Android SDK      — No encontrado (ANDROID_HOME no definido)
❌ Gradle           — No encontrado (where gradle vacío)
```

> **IMPORTANTE:** Sin Java JDK y Android SDK, no es posible compilar la APK directamente en este sistema. Las opciones son:
> 1. **Instalar Android Studio** en tu PC (incluye JDK + SDK + Gradle).
> 2. **Usar un CI/CD en la nube** como GitHub Actions con un runner Android.
> 3. Yo dejo el proyecto 100% preparado (Capacitor configurado, iconos generados, `cap sync` ejecutado) para que tú solo abras el proyecto en Android Studio y presiones "Build APK".

---

## PARTE 3: OPTIMIZACIÓN DEL BUILD DE PRODUCCIÓN

### 3.1 Estado Actual del Build

```
✅ npm run build — Sale exitoso
⚠️ Warning: chunk index-XXXX.js = 668 KB (> 500 KB)
   Causa: Gerencia.jsx (124 KB fuente) + Chart.js + Supabase en un solo bundle
```

### 3.2 Optimizaciones Propuestas

#### A. Code Splitting (Reducir el chunk principal)

```js
// vite.config.js — Propuesta
export default defineConfig({
  plugins: [react()],
  base: './',  // ← CRÍTICO para Capacitor (rutas relativas)
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
})
```

**Resultado esperado:** Chunk principal baja de ~668KB a ~300KB. Carga percibida más rápida.

#### B. HTML Meta Tags para Producción y APK

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  <meta name="description" content="Sistema de Control Operativo de Mantenimiento - Grifos y Unidades" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="icon" href="/favicon.ico" />
  <title>Control Operativo - Mantenimiento</title>
</head>
```

#### C. Capacitor Configuration (Propuesta)

```ts
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mantenimiento.controloperativo',
  appName: 'Control Operativo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
```

---

## PARTE 4: PLAN DE IMPLEMENTACIÓN (Sujeto a Aprobación)

### Etapa 2 — Cambios UI/UX (Sin tocar lógica de datos)

| # | Cambio | Archivo(s) | Riesgo |
|---|--------|-----------|:---:|
| 1 | Migrar inline-styles críticos a clases CSS responsivas | `styles.css` | 🟢 Bajo |
| 2 | Añadir `:active` states para feedback táctil | `styles.css` | 🟢 Bajo |
| 3 | Aumentar touch targets (botones de cerrar, chips, inputs) | `styles.css` | 🟢 Bajo |
| 4 | Agregar `safe-area-inset` para status bar y notch | `styles.css`, `index.html` | 🟢 Bajo |
| 5 | Mejorar modales para que sean full-screen en móvil | `styles.css` | 🟢 Bajo |
| 6 | Añadir scroll-indicator para tablas en móvil | `styles.css` | 🟢 Bajo |
| 7 | Optimizar chart containers para viewport pequeño | `styles.css` | 🟢 Bajo |
| 8 | Actualizar head con meta tags de producción | `index.html` | 🟢 Bajo |

### Etapa 3 — Configuración APK

| # | Acción | Comando / Archivo |
|---|--------|-------------------|
| 1 | Actualizar `vite.config.js` con `base: './'` y code splitting | `vite.config.js` |
| 2 | Instalar dependencias Capacitor | `npm install @capacitor/core @capacitor/cli` |
| 3 | Crear `capacitor.config.ts` | Nuevo archivo |
| 4 | Generar iconos y splash screens | Archivos de recursos |
| 5 | Ejecutar `npx cap init` + `npx cap add android` | Terminal |
| 6 | Ejecutar `npm run build` + `npx cap sync` | Terminal |
| 7 | Documentar comandos finales para el usuario | `README_APK.md` |

---

## ⏸️ ESPERANDO TU APROBACIÓN

> **Este documento es solo el diagnóstico y plan.** No he modificado ningún archivo del proyecto.
> 
> Por favor revisa y dime:
> 1. ¿Apruebas el plan tal cual o hay algo que quieras ajustar?
> 2. ¿Cuál es el nombre oficial de la app y el appId que prefieres? (Propuse `com.mantenimiento.controloperativo` / `Control Operativo`)
> 3. ¿Tienes un logo o ícono que quieras usar para la APK? Si no, puedo generar uno con IA.
> 4. ¿Deseas que restrinja la app solo a modo vertical (portrait) en el APK?
