# Aclarar «Referencia» y «Equipo» en Comparación relativa

## Qué dice hoy el código (verificado)

- `aggregateByShift` (src/lib/wfm/analysis.ts) calcula la ocupación del turno como tiempo productivo total ÷ tiempo de sesión total de los agentes cuyo **turno dominante** es ese turno. Ese es el 51,1% que ves en Operación → Análisis por turno.
- `buildBenchmark` usa como **Referencia** la ocupación de ese mismo turno del agente, pero **solo si el turno tiene más de 1 agente**; si no, cae a la ocupación del equipo. **Equipo** es siempre la ocupación agregada de todos los agentes.
- En src/routes/index.tsx los turnos se calculan con `visibleAgents` (con filtros/búsqueda aplicados) mientras que el equipo del benchmark usa `allAgents`, así que ambos valores pueden no venir de la misma población.

Con eso, tu intuición es correcta: si Romy pertenece al turno Tarde, **Referencia debería mostrar 51,1% y Equipo 42,7%**. Que Referencia muestre 42,7% indica que el turno dominante detectado para ella no es Tarde (trabaja repartida entre turnos) o que ese turno quedó con un solo agente tras los filtros. Cuál de los dos es, hay que confirmarlo con los datos cargados: es el primer paso.

## Plan

1. Verificar en el dataset actual el turno dominante de Romy Miryam Revatta Segura y el número de agentes del turno Tarde, para saber por qué cae al equipo.
2. Hacer coherente la población: pasar a `buildBenchmark` la misma base que alimenta el análisis por turno (evitar la mezcla `visibleAgents` / `allAgents`), sin cambiar ninguna fórmula de ocupación.
3. Hacer explícito el origen de la Referencia en la tarjeta: la etiqueta secundaria ya indica «Referencia turno X» o «Referencia equipo»; reforzarlo para que quede claro cuando se usa el equipo como sustituto y por qué (turno con un solo agente o reparto entre turnos), y actualizar el texto del icono de ayuda para que coincida con el comportamiento real.
4. Si el agente reparte su jornada entre varios turnos, mostrar en la Referencia el turno usado junto con el porcentaje de días de ese turno, para que el 51,1% frente al 42,7% sea interpretable.

## Notas técnicas

- Sin cambios en `computeOccupancy`, `aggregateAgents`, umbrales, categorías ni tolerancia de desviación (5 p.p.).
- Cambios previstos: src/routes/index.tsx (población pasada al benchmark), src/lib/wfm/analysis.ts (solo etiquetado de la referencia si hace falta), src/components/wfm/AgentDetail.tsx (copys de ayuda y detalle del turno de referencia).
- Sin rankings, sin SLA, sin lenguaje competitivo.
