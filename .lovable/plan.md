# Análisis multi-día (períodos): auditoría y diseño

## 1. Resumen ejecutivo

La app ya calcula casi todo de forma correcta para varios días: el pipeline agrega
duraciones crudas de sesión y luego recalcula ratios. El problema no es la matemática,
es el **filtro de fechas**: hoy solo existe un selector de día único (`dateFilter`,
`src/routes/index.tsx:96-106`) y vive dentro de la pestaña Agentes, con auto-fijación al
único día cuando el fichero tiene una sola fecha (`effectiveDate`). No existe rango.

Cambios necesarios, en orden de importancia:

1. Sustituir `dateFilter: string` por un **período normalizado** `{ from, to }` en día
   operativo (`yyyy-MM-dd`), único punto de filtrado consumido por todo el pipeline.
   Un día = `from === to`, así que **no hay una segunda ruta de cálculo** y el resultado
   de 1 día se conserva exactamente.
2. Corregir dos puntos donde el multi-día ya es incorrecto hoy:
   - **Calidad de datos** (`quality` viene del import completo, no del período filtrado):
     `src/lib/wfm/store.tsx:158` y `src/routes/index.tsx:146,308`.
   - **Jornada esperada / T. inactivo**: `workedDays` cuenta solo días **con** sesiones
     (`src/lib/wfm/aggregate.ts:175-179`), por lo que ausencias, festivos y fines de
     semana desaparecen del esperado. Requiere decisión de negocio (ver §4).
3. Añadir capa de **excepciones diarias** (peor día / días fuera de objetivo) para que un
   mes no diluya una sobrecarga puntual. Hoy las alertas son solo del agregado.
4. Etiquetado: el KPI se llama `avgOccupancy` (`types.ts:106`) pero es un ratio ponderado
   por duración, no una media. Renombrar en UI a «Ocupación operativa del período».

Nada se implementa en este paso.

## 2. Mapa de la lógica actual de 1 día

| Análisis | Dónde | Grano actual |
| --- | --- | --- |
| Filtro de fecha (día único) | `routes/index.tsx:96-106` (`dateFilter`, `effectiveDate`, `filteredRecords`) | sesión → `operationalDate` exacto |
| Día operativo | `excel.ts:219,227` + `time.ts:63` (`toDateKey(start ?? end)`, hora local) | fecha civil del **inicio** de sesión |
| Agregación por agente | `aggregate.ts:152-202` (`aggregateAgents`) | sesión → agente-período |
| Ocupación | `aggregate.ts:16-19` (`computeOccupancy`) | ratio de sumas |
| Turno dominante | `aggregate.ts:35-116` (`shiftOverlapSeconds`, `detectShift`) | solape real en segundos, cruza medianoche |
| Reparto por turno | `aggregate.ts:119-150` (`shiftBreakdown`) | agente-día → % de días |
| KPIs Operación | `aggregate.ts:208-230` (`computeKpis`) | suma sobre agentes visibles |
| Distribución de carga | `analysis.ts:13-40` (`loadDistribution`) | recuento de agentes por categoría |
| Análisis por turno | `analysis.ts:62-102` (`aggregateByShift`) | agentes del turno dominante |
| Comparación relativa | `analysis.ts:122-186` (`buildBenchmark`) | agente vs turno/equipo (población `allAgents`) |
| Objetivo de ocupación | `OccupancyTarget.tsx` con `kpis.avgOccupancy` | ratio agregado |
| Alertas | `analysis.ts:196-287` (`deriveAlerts`) | agregado + calidad del import |
| Detalle de agente | `AgentDetail.tsx` (`agent.records`) | sesiones del agente ya filtradas |
| Calidad de datos | `excel.ts:247-255`, `DataQualityPanel.tsx` | **todo el fichero**, sin filtrar |
| Histórico | `history.ts`, `HistoryPanel.tsx` | snapshot por importación |
| Export PNG | `routes/index.tsx:166-177`, `export-image.ts` | nodo con KPIs + distribución + turnos |

## 3. Reglas de agregación multi-día

| Métrica | 1 día hoy | Fórmula período | Grano | Prohibido |
| --- | --- | --- | --- | --- |
| Sesiones | recuento de filas | **SUMA** de filas del período | sesión | promediar sesiones/día |
| Llamadas | suma | **SUMA** | sesión | media diaria |
| T. conversación / ACW / productivo / sesión | suma | **SUMA** de segundos | sesión | medias |
| % Ocupación agente | prod/sesión | **Σ productivo / Σ sesión × 100** | agente-período | media de ocupaciones diarias |
| Días trabajados | `distinct operationalDate` | **DISTINCT COUNT** de días operativos con sesión, dentro del período | agente-día | suma de sesiones |
| Jornada esperada | `días × 7,5 h × factor` | igual, con la definición de «día contable» que se decida en §4 | agente-día | prorrateos implícitos |
| T. inactivo | `max(0, esperado − productivo)` | igual, sobre totales del período | agente-período | sumar inactivos diarios sin `max` por día (decisión §4) |
| Ocupación equipo | ratio de sumas | **Σ productivo equipo / Σ sesión equipo** | período | media de porcentajes por agente o por día |
| Categoría de carga | umbral sobre ocupación | umbral sobre la **ocupación agregada del período** | agente-período | moda/media de categorías diarias |
| Distribución | recuento de agentes | recuento de agentes por categoría de período | agente-período | sumar recuentos diarios (duplica agentes) |
| Ocupación por turno | ratio de sumas del grupo | **Σ productivo / Σ sesión** de los agentes del turno en el período | turno-período | media de ocupaciones turno-día |
| Agentes por turno | recuento | **DISTINCT COUNT** de agentes | agente-período | suma de agentes-día |
| Desviación vs referencia | resta de ratios | resta de los dos ratios de período (p.p.) | período | media de desviaciones diarias |
| Objetivo vs real | resta | `ocupación período − objetivo` (p.p.) | período | media de desviaciones diarias |
| Calidad de datos | recuentos del import | recuentos **recalculados sobre las filas del período** | fila | sumar contadores de import por día |

**Por qué el ratio de sumas y no la media diaria:** la ocupación es una razón entre dos
magnitudes con denominador variable. Un día con 30 min de sesión y otro con 8 h no pesan
igual; la media aritmética de sus porcentajes les daría el mismo peso e inventaría un
valor que no corresponde a ninguna realidad operativa. `Σprod/Σsesión` es la media
ponderada por tiempo de sesión, que es la definición WFM correcta y ya la que usa el código.

**Equivalencia con 1 día:** todas las fórmulas son las actuales; cuando el período
contiene un solo día operativo el conjunto de sesiones filtradas es idéntico al de hoy,
por lo que cada número coincide bit a bit. Requisito de test explícito en §11.

## 4. Reglas WFM especiales (decisiones de negocio requeridas)

El modelo de esperado/inactivo es el único punto donde el código **no contiene suficiente
información** para inferir la regla. Hoy: `workedDays × 7,5 h × (1 + ajuste%)`
(`aggregate.ts:4,178`), con `workedDays` = días con al menos una sesión.

Decisiones necesarias antes de implementar (marcadas como bloqueantes de la fase 3):

1. **Días sin sesiones dentro del período** (ausencia, vacaciones, libranza): ¿cuentan
   como jornada esperada (y por tanto 7,5 h de inactivo) o se excluyen? Recomendación:
   excluir por defecto (comportamiento actual) y mostrar «días del período sin actividad»
   como dato informativo, no como inactividad.
2. **Fines de semana y festivos**: el dataset no trae calendario laboral. Sin un
   calendario configurable no se puede distinguir «no le tocaba» de «no vino».
   Recomendación: no inventar; el criterio 1 lo cubre.
3. **Primer/último día parcial del rango**: como el filtro es por día operativo completo,
   no hay días parciales salvo que se permita filtrar por hora. Recomendación: rango
   siempre por días operativos completos.
4. **Jornadas distintas por agente**: hoy 7,5 h es global. Si existen contratos a tiempo
   parcial hace falta jornada esperada por agente (o por turno). Flag abierto.
5. **Turnos que cruzan medianoche**: el día operativo se toma del **inicio** de la sesión,
   así que una sesión 23:00→07:00 pertenece al día en que empieza. Correcto y debe
   preservarse: el filtro de rango debe comparar `operationalDate`, nunca `start`/`end`
   crudos, o los turnos de noche se partirían entre días.
6. **Varias sesiones por día**: ya soportado (se suman); el día cuenta una sola vez.
7. **Productivo > esperado (sobretiempo)**: hoy `max(0, …)` oculta el exceso. En un mes
   los excesos y defectos se compensan a nivel agregado y esa compensación se pierde con
   el `max` por agente. Decisión requerida: ¿mostrar «sobretiempo» como métrica separada
   (recomendado) o mantener solo el inactivo truncado en 0?
8. **Sesiones sin fecha válida** (`operationalDate === null`, `excel.ts:186-195`): hoy
   entran en «todas las fechas» y desaparecen al filtrar un día. Recomendación: quedan
   fuera de cualquier período y se reportan en Calidad de datos.

## 5. Comparación relativa (multi-día)

Semántica a conservar (`analysis.ts:122-186`): agente vs turno dominante si el turno tiene
>1 agente y ocupación calculable; si no, vs equipo, con `fallbackReason`.

Diseño de período:
- Población de referencia = **todos los agentes del período** (`allAgents`, ya es así en
  `routes/index.tsx:141-152`), no los agentes visibles tras búsqueda/filtros. Se mantiene.
- Turno dominante del agente = turno con mayor solape en segundos **en todo el período**
  (`detectShift`), no el turno del último día.
- `referenceOccupancy` = ratio agregado del turno en el período; `teamOccupancy` = ratio
  agregado del equipo en el período. Ambos sobre sumas, nunca medias de valores diarios.
- Tolerancia y estado (`within`/`above`/`below`) sin cambios: se aplican a la desviación
  del período.
- Añadir en el detalle, cuando el período tiene >1 día: el reparto por turno ya existente
  y, opcionalmente, el número de días en que el agente quedó fuera de tolerancia.

## 6. Objetivo de ocupación (multi-día)

- Real = `kpis.avgOccupancy` del período (ratio agregado). Renombrar la etiqueta a
  «Ocupación del período» para no sugerir promedio de días.
- Desviación = `real − objetivo` en p.p.; estado por tolerancia configurada (70 % ±5 pp).
- Prohibido: promediar desviaciones diarias o contar días dentro de objetivo como si
  fuera el estado del período.
- Complemento recomendado en multi-día: bajo el KPI, «X de N días operativos fuera de
  objetivo» + peor día, calculado con la ocupación agregada **de cada día** (grano
  día-equipo). Es información adicional, no sustituye al valor del período.

## 7. Alertas y excepciones

- **De período (agregado)**: concentración de carga alta, capacidad infrautilizada,
  agentes sin turno, agentes sin ocupación calculable. Se mantienen tal cual sobre las
  métricas del período.
- **De calidad**: filas inválidas, duplicados, sesiones anómalas, sesiones sin llamadas
  → deben pasar a calcularse **sobre el período filtrado** (hoy son del import completo).
- **Nuevas, solo cuando el período tiene >1 día**: «día(s) con sobrecarga» y
  «día(s) por debajo del objetivo», con la fecha del peor día. Grano día-equipo, obtenido
  de un índice por día que se calcula una vez.
- Regla de producto: el panel de Operación en modo período muestra **dos bloques**:
  estado del período + excepciones diarias. Así un mes equilibrado no oculta un día crítico.

## 8. Detalle de agente

- Cabecera = resumen del **período** (ya lo es, porque `AgentMetrics` se agrega sobre las
  sesiones filtradas).
- Tabla de sesiones = sesiones del agente dentro del período, ordenadas por inicio desc
  (comportamiento actual conservado).
- Añadir, solo si el período >1 día: bloque plegable «Desglose diario» con una fila por
  día operativo (sesiones, llamadas, productivo, sesión, ocupación del día, turno del día).
  La ocupación de cada fila es el ratio de sumas de ese día; la del encabezado sigue
  siendo la del período, y no coinciden con su media — se indica con nota explicativa.
- Con período de 1 día, la vista queda visualmente idéntica a la actual (bloque diario
  oculto).

## 9. UX y modelo de estado del rango

- Estado: `period: { from: string; to: string }` (día operativo `yyyy-MM-dd`), elevado del
  nivel de pestaña al nivel de dashboard, visible en Operación **y** Agentes.
- Inicialización al importar: `from = dates[0]`, `to = dates[dates.length-1]` (todo el
  fichero). Con una sola fecha, `from === to` → resultado idéntico al actual.
- Controles: selector de rango con presets derivados de los datos disponibles
  («Todo el período», «Último día», «Últimos 3 días», «Últimos 7 días», «Este mes») más
  dos selectores de día inicio/fin limitados a las fechas presentes en el dataset.
- Normalización: si `from > to` se intercambian; los días sin datos dentro del rango no
  rompen nada (simplemente no aportan sesiones).
- El filtro es siempre `record.operationalDate >= from && <= to` (comparación de cadenas
  `yyyy-MM-dd`, segura lexicográficamente), preservando la semántica nocturna de §4.5.
- La etiqueta del informe y el nombre del PNG exportado usan el rango
  (`informe-ocupacion-<from>_<to>.png`).
- No se crea una ruta de cálculo «modo 1 día»: solo hay un pipeline parametrizado.

## 10. Cambios de arquitectura (mínimos)

1. `src/lib/wfm/period.ts` (nuevo): tipo `Period`, `normalizePeriod`, `filterByPeriod`,
   `periodDays`, `periodLabel`, presets.
2. `src/lib/wfm/store.tsx`: guardar `period` en el contexto y resetearlo en
   `applyImport` / `applySnapshot` / `clearData`. La configuración persistida
   (turnos, categorías, ajuste, objetivo, tolerancia) no cambia de forma.
3. `src/lib/wfm/aggregate.ts`: sin cambios de fórmula. Añadir `aggregateByDay(records, …)`
   reutilizando `aggregateAgents` por día, para excepciones diarias y desglose.
4. `src/lib/wfm/quality.ts` (nuevo) o función en `excel.ts`: `recomputeQuality(records,
   issues, period)` para que Calidad de datos y sus alertas sean del período.
5. `src/routes/index.tsx`: reemplazar `dateFilter`/`effectiveDate` por `period`; mantener
   los `useMemo` existentes y añadir uno para el índice diario, calculado solo si >1 día.
6. `src/components/wfm/PeriodPicker.tsx` (nuevo) y ajustes de etiquetas en `KpiSummary`,
   `OccupancyTarget`, `AgentDetail`, `OperationalAlerts`.
7. Sin duplicar lógica: un solo `filterByPeriod` y un solo `aggregateAgents`.

## 11. Rendimiento y pruebas

- Coste actual dominante: `shiftBreakdown` llama a `detectShift` por día y `detectShift`
  recorre `records × shifts`, y `shiftOverlapSeconds` itera **día a día del intervalo de
  la sesión**. Es `O(sesiones × turnos)` por agente, pero se recalcula dentro de
  `aggregateAgents` y de nuevo en `shiftBreakdown` (doble pasada).
  Con 30 días y ~40 000 filas eso son varios millones de operaciones por recálculo, y hoy
  se dispara con cada cambio de filtro.
- Optimizaciones recomendadas: calcular el solape por (sesión × turno) **una sola vez** y
  reutilizarlo en `detectShift` y `shiftBreakdown`; indexar `records` por
  `operationalDate` y por agente una vez tras el import; memoizar el índice diario.
- Objetivo: filtro de rango en <150 ms para 30 días / 50 000 filas.
- Pruebas mínimas: (a) período de 1 día = resultado actual, campo a campo;
  (b) ocupación agregada ≠ media de ocupaciones diarias en un caso construido;
  (c) sesión nocturna 23:00→07:00 asignada a un solo día y a un solo turno;
  (d) agente presente solo 2 de 7 días → `workedDays = 2`;
  (e) calidad de datos del período no suma duplicados fuera del rango;
  (f) recuento de agentes por turno sin duplicar agentes multi-día.

## 12. Fases y criterios de aceptación

**Fase 1 — Período central (sin cambio de fórmulas).** `period.ts`, estado en store,
`PeriodPicker` en Operación y Agentes, etiquetas y export por rango.
Aceptación: con un fichero de 1 día todos los números y la vista son idénticos a hoy;
con varios días el rango filtra correctamente y los turnos nocturnos no se parten.

**Fase 2 — Calidad y alertas por período.** `recomputeQuality`, alertas de calidad sobre
el rango, bloque de excepciones diarias (peor día, días fuera de objetivo).
Aceptación: los contadores de calidad cambian al cambiar el rango y nunca superan los del
import; un día crítico dentro de un mes equilibrado aparece señalado.

**Fase 3 — Modelo de esperado/inactivo (bloqueada por §4).** Implementar la regla que se
confirme para ausencias, jornadas por agente y sobretiempo.
Aceptación: la previsualización de Configuración y el T. inactivo de Operación coinciden
para cualquier rango.

**Fase 4 — Detalle diario y rendimiento.** Desglose diario en el detalle de agente,
solape de turnos calculado una vez, índices por fecha/agente.
Aceptación: cambio de rango en <150 ms con 30 días y ~50 000 filas.

## Decisiones que necesito de ti

1. Días del período sin sesiones: ¿esperado 7,5 h (cuenta como inactividad) o excluidos?
2. ¿Existe jornada distinta por agente/turno o 7,5 h es universal?
3. ¿Quieres «sobretiempo» como métrica visible además del T. inactivo?
4. ¿Presets de rango que quieres ver (último día, 3, 7, mes, todo)?
