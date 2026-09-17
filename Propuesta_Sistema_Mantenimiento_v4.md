# Propuesta v4 — Sistema de Control Operativo (Estaciones + Unidades)
> Corrección de fondo sobre la v3: **no existe un rol que reporte un problema para que otro venga a resolverlo.** El operario que hace el trabajo (resolutor/técnico/encargado) es quien reporta lo que él mismo hizo, al momento de hacerlo. El reporte y la resolución son un solo paso, un solo actor.

---

## 1. Qué cambia respecto a la v3

| Tema | v3 (incorrecto) | v4 (corregido) |
|---|---|---|
| Actores del reporte | Cajero reporta → Resolutor resuelve (2 fases, 2 personas) | **Un solo actor**: el que hace el trabajo reporta lo que hizo (1 fase) |
| Estado del reporte | "abierto" esperando a alguien | El reporte **nace ya resuelto (o con su resultado final)**, no queda pendiente de asignación |
| Roles operativos | Cajero, Resolutor, Admin Estación, Gerencia | **Resolutor/Técnico, Admin Estación, Gerencia** (se elimina el cajero) |
| Tabla de datos | `reportes_mantenimiento` + `resoluciones_reporte` separadas | **Se fusionan en una sola tabla** — ya no hace falta el modelo de ticket en dos fases |
| Notificación al crear reporte | "Notifica a resolutores para que lo tomen" | Ya no aplica — el reporte llega completo. Las notificaciones son sobre **stock, fallas recurrentes, préstamos y solicitudes**, no sobre "alguien tiene que venir a resolver" |

Todo lo demás de la v3 (préstamo entre estaciones, "no se pudo solucionar" con motivo, catálogo por estación, visualizador de soluciones, dashboard con alcance, filtro por producto) **se mantiene igual**, solo cambia quién y cómo se registra.

---

## 2. Roles (corregido)

| Rol | Qué hace |
|---|---|
| **Resolutor / Técnico / Encargado** | Hace el mantenimiento en campo (estación o unidad) y **reporta lo que él mismo hizo**: motivo, repuesto usado, solución aplicada, y si no pudo resolverlo, el motivo. Puede solicitar préstamo a otra estación o solicitar un ítem nuevo al catálogo si tiene el permiso. |
| **Administrador de Estación** | Todo lo del resolutor, en su(s) estación(es) asignada(s) + administra el catálogo/stock de su estación + aprueba préstamos que salen de su estación + aprueba solicitudes de nuevo ítem de su estación + ve el Dashboard **solo de su estación**. |
| **Gerencia / Administrador Global** | Ve el Dashboard de **todas las estaciones a las que tenga acceso asignado** + puede aprobar catálogo/solicitudes a nivel general + recibe notificaciones críticas globales + da/quita permisos a otros usuarios. |

El acceso por estación se mantiene igual que en v3: **`usuarios_estaciones_asignadas`** (usuario_id, estacion_id, rol_en_estacion) — un resolutor puede tener acceso a una o varias estaciones si se lo asignan, y ve/opera solo dentro de esas.

---

## 3. Modelo de datos — v4 (tabla de reporte fusionada)

### 3.1 Usuarios y accesos (sin cambios respecto a v3)
- **`usuarios`**: id, nombre, usuario, password_hash, activo
- **`roles`**: id, nombre (resolutor, administrador_estacion, gerente_global)
- **`usuarios_estaciones_asignadas`**: usuario_id, estacion_id, rol_en_estacion
- **`permisos`**: id, nombre (`solicitar_prestamo`, `solicitar_nuevo_item`, `administrar_catalogo`, `aprobar_solicitudes`, `ver_dashboard_global`, `dar_permisos`)
- **`usuarios_permisos`**: usuario_id, permiso_id

### 3.2 Catálogo por estación (sin cambios respecto a v3)
- **`repuestos`**: id, nombre_general, unidad_medida
- **`repuestos_variantes`**: id, repuesto_id (FK), nombre_variante, codigo_interno, activo
- **`catalogo_estacion`**: estacion_id (FK), repuesto_variante_id (FK), disponible_en_esta_estacion
- **`motivos_falla`**: id, nombre, repuesto_id (FK), aplica_a, requiere_variante

### 3.3 Reporte — **tabla única, un solo paso** ⭐ el cambio principal

**`reportes_mantenimiento`**
- id, tipo ('estacion'|'unidad')
- **realizado_por_id** (FK) — quien hizo el trabajo y reporta (ya no hay "creado_por" separado de "resuelto_por")
- **colaboradores** (opcional — lista de otros usuarios que ayudaron en el trabajo, si fue en equipo)
- estacion_id / surtidor_id / unidad_id
- motivo_falla_id (FK)
- repuesto_variante_id (FK, nullable si no aplicaba o no se resolvió)
- **descripcion_trabajo_realizado** (qué pasó y qué se hizo — reemplaza los antiguos "descripcion_reportada" + "solucion_aplicada", ahora es un solo relato del propio técnico)
- resultado ('resuelto' | 'resuelto_con_prestamo' | 'no_resuelto')
- motivo_no_resuelto (nullable — catálogo: 'sin_stock' | 'sin_variante_disponible' | 'requiere_especialista_externo' | 'otro')
- descripcion_motivo_no_resuelto (texto libre, obligatorio si no_resuelto)
- prestamo_id (FK, nullable — si el resultado fue "resuelto_con_prestamo")
- foto_antes, foto_despues
- fecha, hora
- **tiempo_trabajo_minutos** (opcional — el técnico puede indicar cuánto le tomó, o se puede calcular si registra hora inicio/fin)
- estado_sync, fecha_creacion_local, fecha_sync_servidor

> Ya no existen los estados "abierto" / "en_proceso" — el reporte nace con su resultado final, porque se registra **después** (o durante) de hacer el trabajo, no antes.

### 3.4 Préstamo entre estaciones (sin cambios respecto a v3)
**`prestamos_repuestos`**: id, repuesto_variante_id, estacion_origen_id, estacion_destino_id, cantidad, reporte_id (FK), autorizado_por_id, estado ('prestado'|'devuelto'|'pendiente_devolucion'), fecha_prestamo, fecha_devolucion_estimada, fecha_devolucion_real

### 3.5 Solicitud de nuevo ítem (ajuste menor de redacción, misma lógica)
**`solicitudes_nuevo_item`**: id, **solicitado_por_id** (FK — el resolutor que estaba en campo y no encontró el repuesto), reporte_id (FK, nullable), estacion_id, descripcion_solicitada, foto_referencia, estado, respondido_por_id, respuesta_admin, fecha_solicitud, fecha_respuesta

### 3.6 Inventario, kardex, reabastecimiento (sin cambios respecto a v3)
- **`inventario_estaciones`**, **`kardex_movimientos_stock`**, **`solicitudes_reabastecimiento`** — igual que v3

### 3.7 Inteligencia, conocimiento y vistas (sin cambios de fondo, solo se leen desde la tabla fusionada)
- **`vista_alertas_stock`**
- **`indicador_fallas_estacion`**, **`indicador_salud_unidad`**
- **`base_conocimiento_soluciones`** — ahora se arma directo desde `reportes_mantenimiento` (ya no hay que cruzar dos tablas)
- **`ranking_expertise`** — igual, basado en `realizado_por_id` + `motivo_falla_id`
- **`notificaciones`**

---

## 4. Flujo de reporte — un solo paso, un solo actor

```
1. Login (Resolutor / Admin de estación / Gerencia, según corresponda)
2. Selecciona Estación → Surtidor/Isla → Lado  (o Unidad → Tracto)
3. Selecciona Motivo de falla
4. 💡 Ayuda contextual (se mantiene igual que en v3):
   "Este mismo problema se reportó 3 veces este mes en esta estación.
   Última solución: 'se cambió manguera, fuga en conexión inferior' —
   por Gerardo, hace 6 días."
5. Si el motivo requiere variante de repuesto:
     a. Ve variantes disponibles EN SU ESTACIÓN (catalogo_estacion)
     b. Si no hay stock/variante en su estación:
          → Sistema muestra disponibilidad en otras estaciones de la
            misma ciudad
          → Opción A: Solicitar préstamo (si tiene permiso)
            → se registra el préstamo, resultado = "resuelto_con_prestamo"
          → Opción B: Solicitar ítem nuevo al catálogo (si tiene permiso)
            → se registra la solicitud, notificación al admin de estación
          → Opción C: Marcar "No se pudo solucionar" + motivo obligatorio
            → resultado = "no_resuelto", queda registrado para auditoría
6. Describe qué se hizo ("descripcion_trabajo_realizado" — su propio relato,
   útil para que otro técnico lo entienda después)
7. Si trabajó con alguien más, puede agregarlo como colaborador (opcional)
8. Foto antes / después
9. Guarda → sync online/offline (igual que siempre)
```

> Nota clave: como quien reporta es quien hizo el trabajo, **el reporte se puede llenar en el momento o inmediatamente después** de resolver (o de intentar resolver) — no hay "espera" de que alguien más lo tome.

---

## 5. Notificaciones (ajustadas — ya no hay "reporte esperando resolutor")

| Evento | Destinatario |
|---|---|
| Stock crítico | Admin de estación + Gerencia |
| Falla recurrente en surtidor/unidad | Admin de estación + Gerencia |
| Unidad con score de salud bajo | Admin de estación + Gerencia (flota) |
| Solicitud de préstamo | Admin de la estación **origen** (para autorizar) |
| Préstamo pendiente de devolución (vencido) | Admin estación origen + Gerencia |
| Solicitud de nuevo ítem | Admin de la estación correspondiente |
| Solicitud de nuevo ítem resuelta | El resolutor que la generó |
| Reabastecimiento recibido | Admin de estación |
| "No se pudo solucionar" repetido en el mismo motivo/estación | Gerencia (señal de problema estructural: falta de stock crónica, falta de capacitación, etc.) |
| Dependencia de conocimiento (un solo técnico concentra soluciones) | Gerencia, resumen semanal |
| Resumen semanal (digest) | Gerencia |

---

## 6. Visualizador de Soluciones (sin cambios respecto a v3)

Sigue disponible para **todos los roles** (resolutor, admin de estación, gerencia), filtrado por las estaciones a las que cada usuario tiene acceso asignado. Busca por palabra clave (ej. "filtro") → tarjetas ordenadas por fecha, mostrando quién lo hizo y cómo → se puede abrir el detalle completo.

Esto sigue siendo clave si un técnico está de vacaciones: cualquier otro con acceso a esa estación puede buscar el historial y ver exactamente qué se hizo la última vez, sin depender de que la persona conteste el teléfono.

---

## 7. Dashboard (sin cambios respecto a v3)

Mismo alcance por estación (admin ve solo la suya, gerencia ve las que tenga asignadas), mismas 6 secciones (stock, salud de estaciones, salud de unidades, base de conocimiento/expertise, solicitudes pendientes + préstamos, SLA de tiempos), y el mismo filtro cruzado por producto entre estaciones.

Cada tarjeta de reporte en el dashboard ahora se lee así (ajustado al modelo de un solo actor):
- Realizado por (+ colaboradores, si los hubo)
- Resultado: resuelto / resuelto con préstamo (de qué estación) / no resuelto (con motivo)
- Descripción del trabajo realizado
- Tiempo de trabajo (si se registró)
- Fotos antes/después

---

## 8. Matriz de permisos por funcionalidad (corregida)

| Funcionalidad | Resolutor | Admin Estación | Gerencia Global |
|---|:---:|:---:|:---:|
| Reportar trabajo realizado (con resultado final) | ✅ | ✅ | ✅ |
| Solicitar préstamo a otra estación | ✅ (si tiene permiso) | ✅ | ✅ |
| Aprobar/devolver préstamo | ❌ | ✅ (estación origen) | ✅ |
| Marcar "no se pudo solucionar" | ✅ | ✅ | ✅ |
| Solicitar ítem nuevo al catálogo | ✅ (si tiene permiso) | ✅ | ✅ |
| Aprobar solicitud de ítem nuevo | ❌ | ✅ (su estación) | ✅ |
| Administrar catálogo/stock de una estación | ❌ | ✅ (su estación) | ✅ (todas) |
| Ver Visualizador de Soluciones | ✅ (sus estaciones) | ✅ (sus estaciones) | ✅ (todas las asignadas) |
| Ver Dashboard | ❌ | ✅ (su estación) | ✅ (todas las asignadas) |
| Dar/quitar permisos a usuarios | ❌ | ❌ | ✅ |

---

## 9. Casos de uso formales (corregidos)

### UC-01 — Reportar trabajo realizado (con repuesto disponible)
- **Actor:** Resolutor / Admin de estación / Gerencia
- **Precondición:** Usuario autenticado, con acceso a la estación/unidad
- **Flujo principal:** Login → selecciona estación/unidad → surtidor o tracto → motivo → ve ayuda contextual → selecciona variante disponible en su estación → describe el trabajo realizado → foto antes/después → guarda
- **Postcondición:** Reporte creado con resultado "resuelto", stock descontado, kardex actualizado, indicador de expertise actualizado
- **Flujo alterno:** Sin internet → reporte queda en cola local, se sincroniza al recuperar conexión (el descuento de stock se dispara en ese momento)

### UC-02 — Reportar trabajo resuelto con préstamo de otra estación
- **Actor:** Resolutor / Admin de estación
- **Precondición:** No hay stock/variante en su estación; sí hay en otra de la misma ciudad
- **Flujo principal:** Al no encontrar la variante, sistema muestra disponibilidad en estaciones cercanas → solicita préstamo → admin de estación origen autoriza → se registra `prestamos_repuestos` → reporte se guarda con resultado "resuelto_con_prestamo"
- **Postcondición:** Stock descontado en estación origen, notificación de devolución pendiente creada
- **Flujo posterior (UC-02b):** Al devolver físicamente el repuesto, admin de estación origen marca "devuelto", stock se reintegra

### UC-03 — Reportar que no se pudo solucionar
- **Actor:** Resolutor / Admin de estación
- **Precondición:** No hay repuesto disponible, ni en su estación ni por préstamo, o requiere especialista externo
- **Flujo principal:** Selecciona "No se pudo solucionar" → elige motivo del catálogo → describe el motivo en texto → guarda
- **Postcondición:** Reporte queda con resultado "no_resuelto", registro auditable disponible para gerencia

### UC-04 — Solicitar ítem nuevo al catálogo
- **Actor:** Resolutor (con permiso) o Admin de estación
- **Precondición:** La variante necesaria no existe en el catálogo de ninguna estación accesible
- **Flujo principal:** Desde el reporte en curso, solicita nuevo ítem → describe qué necesita, foto opcional → se notifica al admin de esa estación
- **Flujo alterno:** Admin aprueba → decide si se agrega permanentemente al catálogo o fue caso puntual → notifica al solicitante
- **Postcondición:** Catálogo actualizado (si aplica), reporte puede completarse

### UC-05 — Administrar catálogo de una estación
- **Actor:** Admin de estación
- **Precondición:** Usuario tiene rol `administrador_estacion` en esa estación
- **Flujo principal:** Entra a "Mi catálogo" → agrega/edita variantes disponibles, define stock inicial y mínimo de alerta
- **Postcondición:** `catalogo_estacion` e `inventario_estaciones` actualizados

### UC-06 — Consultar el Visualizador de Soluciones
- **Actor:** Cualquier usuario autenticado
- **Precondición:** Usuario tiene al menos una estación asignada
- **Flujo principal:** Busca por palabra clave → selecciona estación (si tiene más de una asignada) → ve tarjetas ordenadas por fecha → abre detalle de una tarjeta
- **Postcondición:** Ninguna (solo consulta)

### UC-07 — Ver Dashboard (alcance por estación)
- **Actor:** Admin de estación o Gerencia global
- **Precondición:** Usuario tiene permiso `ver_dashboard_global` o rol `administrador_estacion`
- **Flujo principal:** Entra al Dashboard → ve su estación (o selecciona entre las suyas si es gerencia) → navega las 6 secciones → filtra por producto/fecha/motivo/realizado_por
- **Postcondición:** Ninguna (solo lectura), puede exportar

### UC-08 — Recibir notificación crítica
- **Actor:** Sistema → Admin de estación / Gerencia
- **Precondición:** Se cumple un umbral (stock crítico, falla recurrente, unidad en riesgo, préstamo vencido, "no resuelto" repetido)
- **Flujo principal:** Sistema genera notificación push + registro en `notificaciones`
- **Postcondición:** Usuario puede tocar la notificación y navegar al detalle relevante

### UC-09 — Dar permisos a un usuario
- **Actor:** Gerencia global
- **Precondición:** Usuario con permiso `dar_permisos`
- **Flujo principal:** Selecciona usuario → asigna estaciones (`usuarios_estaciones_asignadas`) → asigna rol por estación → asigna permisos adicionales
- **Postcondición:** El usuario ve reflejados sus nuevos accesos en su próximo login

---

## 10. Siguiente paso

Esta v4 ya queda alineada con cómo funciona realmente tu operación: **una sola persona hace y reporta**, sin depender de que alguien más tome un ticket. El resto de la inteligencia (préstamos, auditoría de "no resuelto", catálogo por estación, visualizador, dashboard con alcance) sigue funcionando igual de bien sobre este modelo simplificado — de hecho es más simple de construir que el modelo de dos fases.

¿Seguimos con la **priorización por fases (MVP → Fase 2 → Fase 3)** para que tu equipo sepa qué construir primero, ahora sobre esta versión ya corregida?
