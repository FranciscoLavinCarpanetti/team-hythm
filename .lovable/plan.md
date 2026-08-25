# Inventario funcional — Agent Performance Hub (estado actual, sin cambios de código)

Documento base para manual de usuario. Todo lo indicado está verificado en el código actual.

## 1. Arquitectura y alcance

- SPA React + TanStack Start, ruta única `/` (`src/routes/index.tsx`). 100 % en el navegador: no hay backend, base de datos ni cálculo en servidor.
- Persistencia: `localStorage`. Claves: `wfm-config-v1` (configuración), `wfm-history-v1` (histórico, máx. 8 importaciones), `wfm.access.email`, `wfm.access.allowlist`.
- Datos de sesiones y AUX viven en memoria; el histórico sí se guarda en el navegador.

## 2. Pantallas / pestañas

Cabecera: título, nº de sesiones importadas, hora de última carga, botón "Vaciar datos", botón "Salir". Selector de período (visible con datos).

1. **Operación** — carga de ficheros, botón "Exportar informe (PNG)", bloque exportable (cabecera de informe, KPIs, Ocupación vs objetivo, Distribución de carga, Análisis por turno, Distribución del tiempo AUX, Excepciones diarias) y, fuera del export, Alertas operativas, Calidad de datos y Calidad AUX.
2. **Agentes** — buscador, filtro por turno, filtro por categoría, tabla ordenable y modal de detalle.
3. **Histórico** — tabla de importaciones (Archivo, Importado, Periodo, Filas, Válidas, No válidas, Duplicadas, Agentes), ver/borrar importación, aviso de "solo lectura" y comparación de dos conjuntos.
4. **Configuración** — Ajuste de horas esperadas, Parámetros operativos (objetivo/tolerancia), Categorías de carga, Turnos, Estados AUX y Cuentas con acceso.

## 3. Entradas de datos

### 3.1 Excel de sesiones (obligatorio, `.xlsx`)

Columnas detectadas por nombre (con alias, sin acentos, insensible a mayúsculas; se admite coincidencia parcial). Obligatorias: Sesión, Agente, Inicio sesión, Fin sesión, (WS) Tiempo de sesión, (TC-S) Total llamadas sesión, (TT) Tiempo en conversación, (ACW) Tiempo gestión llamada, (TPT) Total tiempo productivo. Opcional: Pupitre. `SLA sesión` y `TAUX-WS` no se leen ni se muestran.

Reglas de validación por fila:
- Falta agente o sesión → fila descartada (error).
- Duplicado por `Sesión|Agente` → descartada (aviso), no se cuenta dos veces.
- Duración no parseable (`h:mm[:ss]`, `Date`, o serial Excel: <10 = fracción de día, ≥10 = segundos) → descartada (error). Vacío = 0.
- Llamadas no numéricas o negativas → descartada (error).
- Sin fechas válidas → se conserva, pero sin fecha operativa ni turno (aviso).
- 0 llamadas → aviso informativo (la sesión sí cuenta).
- TPT > WS → aviso de anomalía (no se corrige el dato).
- Sin ninguna fila válida, o faltan columnas, o `.xlsx` ilegible → error de importación bloqueante con detalle.

Fecha operativa = día natural del **inicio** (fallback: fin), por lo que una sesión que cruza medianoche pertenece íntegra al día de inicio.

Al importar: se reemplaza el dataset, se conserva la configuración (turnos, categorías, ajustes, mapeos AUX), el período se reinicia al rango completo y se guarda una instantánea en el histórico.

### 3.2 Excel AUX de estados (opcional, `.xlsx`)

Obligatorias: Sesión, Agente, Estado AUX, Inicio estado, Fin estado, TAUX. Opcional: Pupitre. Carga independiente: no altera el dataset de sesiones ni la ocupación.

Estado normalizado quitando acentos y sufijos entre paréntesis («Descanso (30')» → `descanso`). Estados oficiales soportados (10): Formación, Descanso (30'), Pausa (7'), Nesting, Coordinación, Soporte, Gestion Personal, Tickets, Reunión, Incidencia Técnica. Cualquier otro estado se marca como no reconocido y no se conserva en configuración.

Descartes: falta clave, estado vacío, fechas inválidas o `fin < inicio`, TAUX inválido; duplicado exacto (sesión+agente+estado+intervalo) como aviso.

### 3.3 Qué se puede concluir de cada fichero

- **Solo sesiones**: sesiones, llamadas, TT, ACW, TPT, WS, ocupación, tiempo inactivo, categoría, turno, comparativas y desglose diario. No se puede saber en qué se emplea el tiempo no productivo.
- **Sesiones + AUX**: además, reparto del tiempo de sesión por macro-categoría (pausas, desarrollo, etc.) y cobertura. El AUX **no** modifica ocupación, horas esperadas ni tiempo inactivo: es descriptivo.
- **Solo AUX**: no aporta nada; sin sesiones no hay emparejamiento (la clave es Sesión+Agente).

## 4. Cálculos y reglas de negocio

- **Ocupación** = TPT sumado / WS sumado × 100. Nunca se promedian porcentajes de sesión. Si WS = 0 → sin ocupación (`—`).
- **Agregado por agente**: sesiones = nº de filas; llamadas, TT, ACW, TPT y WS = sumas.
- **Días trabajados** = nº de fechas operativas distintas.
- **Jornada activa esperada** = días trabajados × 7,5 h (8 h − 30 min) × (1 + ajuste %/100), con suelo en 0.
- **Tiempo inactivo** = máx(0, jornada esperada − TPT).
- **KPIs del período** (sobre los agentes visibles tras filtros): agentes, sesiones, llamadas, T. productivo, esperado, inactivo, ocupación media ponderada (TPT total / WS total), y recuentos por carga baja (low + moderate-low), equilibrada, alta (high + very-high + critical) y sin turno.
- **Turno del agente**: solape real en segundos entre cada sesión y cada ventana de turno (con soporte de cruce de medianoche); gana el turno con más segundos. Si no hay solape, se usa la hora de inicio. Los turnos se derivan siempre de horarios configurados.
- **Reparto por turno** (`shiftBreakdown`): por día operativo se detecta el turno dominante y se pondera por segundos de sesión de ese día; en la tabla se ocultan restos <1 %.
- **Categorización**: primera categoría (por orden) cuyo rango contiene la ocupación, mín. y máx. inclusive.
- **Ocupación vs objetivo**: desviación en puntos porcentuales; dentro de tolerancia = "en objetivo", fuera = por debajo / por encima.
- **Excepciones diarias** (solo con período de 2+ días): ocupación por día (ratio propio de cada día) comparada con objetivo ± tolerancia; se identifican días por encima, por debajo, en objetivo y el día de mayor desviación.
- **Distribución del tiempo (AUX)**: WS = 100 %. Precedencia TT → ACW → AUX. El AUX se recorta al hueco WS − TT − ACW (recorte proporcional, informado en diagnósticos); solapes AUX se resuelven por unión de intervalos (gana el intervalo más temprano) y se recortan a los límites de la sesión. Cobertura = clasificado / WS. Resto = "Sin clasificar".

## 5. Filtros, orden y detalle

- **Período**: presets Todo el período / Último día / Últimos 3 / Últimos 7 / Este mes, más rango personalizado. Filtra por fecha operativa; un solo día se expresa como `from = to`.
- **Agentes**: búsqueda por nombre (subcadena), filtro por turno (incluye "sin turno") y por categoría (incluye "sin categoría").
- **Orden**: por agente, turno, sesiones, llamadas, T. conversación, T. ACW, T. productivo, T. inactivo, % ocupación y categoría. Orden por defecto: llamadas descendente; empates por nombre.
- **Detalle de agente (modal)**: turno, sesiones, llamadas, T. sesión, TT, ACW, TPT, días trabajados, jornada esperada, T. inactivo, % ocupación; distribución del tiempo (si hay AUX); comparación relativa; desglose diario (períodos multi-día); reparto por turno; y tabla de sesiones (Sesión, Inicio, Fin, Duración, Llamadas, TT, ACW, TPT, % Ocupación). Sin SLA en ningún punto.
- **Comparación relativa**: referencia = ocupación del turno del agente si ese turno tiene más de 1 agente y ocupación calculable; si no, ocupación del equipo, indicando el motivo del fallback. Desviación en pp con tolerancia de ±5 pp; lenguaje descriptivo, sin rankings.

## 6. Configuración

- **Ajuste de horas esperadas**: porcentaje positivo o negativo sobre la jornada de 7,5 h/día (defecto 0), con vista previa sobre el dataset activo.
- **Parámetros operativos**: objetivo de ocupación (defecto 70 %, válido 0–100) y tolerancia (defecto ±5 pp, máx. 50).
- **Categorías de carga** (defecto, versión 2, con validación de solapes, rangos 0–100 y nombre obligatorio): Baja 0–55, Moderadamente baja 55,01–59,99, Equilibrada 60–75, Alta 75,01–85, Muy alta 85,01–90, Crítica 90,01–100.
- **Turnos** (defecto): Mañana 07:00–15:00, Tarde 15:00–23:00, Noche 23:00–07:00 (cruce de medianoche soportado).
- **Estados AUX**: macro-categorías configurables (Pausas, Desarrollo, Soporte operativo, Reunión, Causa) y mapeo por defecto: descanso/pausa → Pausas; formación/nesting → Desarrollo; coordinación/soporte/tickets → Soporte operativo; reunión → Reunión; gestión personal/incidencia técnica → Causa.
- **Cuentas con acceso**: gestión del allowlist y botón para copiar la lista lista para pegar en código.

## 7. Calidad de datos y alertas

- **Calidad de datos** (recalculada por período): filas totales, válidas, no válidas, duplicadas, agentes, sesiones sin llamadas, sesiones anómalas, agentes sin turno e incidencias sin fecha (fuera de cualquier período).
- **Calidad AUX**: filas cargadas, emparejadas, no emparejadas, duplicadas, no válidas, solapes, registros recortados y segundos recortados, registros fuera de sesión, sesiones sin intervalo, discrepancias de pupitre, estados desconocidos, estados sin macro-categoría, agentes con y sin AUX, y segundos sin clasificar.
- **Alertas operativas** derivadas solo de datos reales: concentración de carga alta (crítica si ≥30 % de agentes), capacidad infrautilizada (≥50 % en carga baja), agentes sin turno, agentes sin ocupación calculable, filas no válidas, duplicados y sesiones anómalas o sin llamadas.

## 8. Histórico y exportación

- Cada importación guarda instantánea completa (registros, incidencias, calidad, fechas) en el navegador, máximo 8; si se llena la cuota se descartan los registros de las más antiguas conservando metadatos (quedan como "sin registros" y no se pueden reabrir ni comparar).
- Ver una importación pasada activa un modo solo lectura con aviso y botón de retorno a la última.
- Comparación A/B entre dos importaciones: agentes, sesiones, llamadas, T. productivo y ocupación operativa, más comparación por turno (ocupación, llamadas, agentes).
- Exportación: PNG del bloque de informe a 1400 px de ancho y doble resolución, fondo blanco, nombre `informe-ocupacion-<período>.png`. Excluye alertas operativas y calidad de datos. No hay exportación a Excel/CSV/PDF.

## 9. Acceso

- Puerta de acceso en cliente por correo: allowlist base en `src/lib/wfm/access-list.ts` (administradores: g.medina, d.viramalay, alperez; autorizados: jmontalban, m.sousa, f.lavin — todos @telpark.com), ampliable en `localStorage`.
- Solo administradores añaden/quitan correos; los administradores no se pueden eliminar. La sesión se recuerda en el navegador hasta "Salir".
- **Limitación importante**: no hay verificación de identidad (ni contraseña, ni código, ni servidor). Es una barrera de UI: cualquiera que conozca un correo autorizado, o que edite el almacenamiento local, entra.

## 10. Limitaciones y casos límite

- Sin backend: los datos no se comparten entre usuarios ni dispositivos; borrar datos del navegador elimina histórico y configuración (la lista de correos en código sobrevive).
- Ocupación no calculable si WS = 0; el agente aparece sin categoría y se informa en alertas.
- Sesiones sin fechas válidas: se agregan en importes y sumas, pero no tienen día operativo, así que quedan **fuera de cualquier filtro de período**, del desglose diario y de la detección de turno.
- Duplicados por `Sesión|Agente`: solo se conserva la primera aparición; dos sesiones legítimas con el mismo identificador se perderían.
- Tiempo inactivo asume 7,5 h activas por día trabajado para todos los agentes (ajustable solo de forma global): no contempla jornadas parciales, bajas ni vacaciones. Un día con una sesión de 10 minutos cuenta como día completo esperado.
- El turno es inferido de los horarios configurados y del dato real; no existe asignación manual efectiva por agente en el cálculo.
- El AUX exige coincidencia exacta de Sesión + Agente; nombres o identificadores distintos entre ficheros producen filas no emparejadas y cobertura baja.
- "Sin clasificar" puede ser alto sin que implique inactividad: puede deberse a AUX ausente, recortes por precedencia o estados sin mapear.
- El histórico compara importaciones completas, no períodos seleccionados dentro de una misma importación.
- Todos los cálculos se hacen con la zona horaria del navegador; ficheros generados en otra zona pueden desplazar la fecha operativa.
- SLA nunca se muestra, tal como exige el requisito.
