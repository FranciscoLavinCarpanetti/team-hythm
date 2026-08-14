import { computeOccupancy } from "./aggregate";
import type { AgentMetrics, DataQuality, Kpis, LoadCategory, Shift } from "./types";

export type CategorySlice = {
  key: string;
  name: string;
  status: LoadCategory["status"] | null;
  count: number;
  percentage: number;
};

/** Distribución de agentes por categoría configurada (sin reglas duplicadas). */
export function loadDistribution(
  agents: AgentMetrics[],
  categories: LoadCategory[],
): CategorySlice[] {
  const total = agents.length;
  const ordered = [...categories].sort((a, b) => a.order - b.order);
  const slices: CategorySlice[] = ordered.map((category) => {
    const count = agents.filter((a) => a.category?.id === category.id).length;
    return {
      key: category.id,
      name: category.name,
      status: category.status,
      count,
      percentage: total ? (count / total) * 100 : 0,
    };
  });
  const uncategorized = agents.filter((a) => !a.category).length;
  if (uncategorized) {
    slices.push({
      key: "__none__",
      name: "Sin categoría",
      status: null,
      count: uncategorized,
      percentage: total ? (uncategorized / total) * 100 : 0,
    });
  }
  return slices;
}

export type ShiftMetrics = {
  shiftId: string | null;
  shiftName: string;
  schedule: string | null;
  crossesMidnight: boolean;
  agents: number;
  sessions: number;
  calls: number;
  productiveSeconds: number;
  sessionSeconds: number;
  occupancy: number | null;
  distribution: CategorySlice[];
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

/** Agregado operativo por turno configurado (turnos nocturnos incluidos). */
export function aggregateByShift(
  agents: AgentMetrics[],
  shifts: Shift[],
  categories: LoadCategory[],
): ShiftMetrics[] {
  const build = (
    shiftId: string | null,
    shiftName: string,
    schedule: string | null,
    crossesMidnight: boolean,
  ): ShiftMetrics => {
    const group = agents.filter((a) => a.shiftId === shiftId);
    const productiveSeconds = group.reduce((acc, a) => acc + a.productiveSeconds, 0);
    const sessionSeconds = group.reduce((acc, a) => acc + a.sessionSeconds, 0);
    return {
      shiftId,
      shiftName,
      schedule,
      crossesMidnight,
      agents: group.length,
      sessions: group.reduce((acc, a) => acc + a.sessions, 0),
      calls: group.reduce((acc, a) => acc + a.calls, 0),
      productiveSeconds,
      sessionSeconds,
      occupancy: computeOccupancy(productiveSeconds, sessionSeconds),
      distribution: loadDistribution(group, categories),
    };
  };

  const result = shifts.map((shift) =>
    build(
      shift.id,
      shift.name,
      `${shift.start} – ${shift.end}`,
      toMinutes(shift.end) <= toMinutes(shift.start),
    ),
  );
  const orphans = agents.filter((a) => a.shiftId === null).length;
  if (orphans) result.push(build(null, "Sin turno asignado", null, false));
  return result;
}

export type Benchmark = {
  agentOccupancy: number | null;
  referenceOccupancy: number | null;
  referenceLabel: string;
  referenceKind: "shift" | "team";
  referenceShiftId: string | null;
  referenceShiftName: string | null;
  fallbackReason: string | null;
  teamOccupancy: number | null;
  deviation: number | null;
  status: "above" | "below" | "within" | "unknown";
  label: string;
};

/**
 * Comparación relativa y no competitiva: desviación en puntos porcentuales
 * frente a la referencia del equipo o del turno. No genera rankings.
 */
export function buildBenchmark(
  agent: AgentMetrics,
  agents: AgentMetrics[],
  shiftMetrics: ShiftMetrics[],
  tolerancePoints = 5,
): Benchmark {
  const teamOccupancy = computeOccupancy(
    agents.reduce((a, x) => a + x.productiveSeconds, 0),
    agents.reduce((a, x) => a + x.sessionSeconds, 0),
  );
  const shift = shiftMetrics.find((s) => s.shiftId === agent.shiftId);
  const useShift = Boolean(shift && shift.agents > 1 && shift.occupancy !== null);
  const referenceOccupancy = useShift ? shift!.occupancy : teamOccupancy;
  const referenceLabel = useShift ? `Referencia turno ${shift!.shiftName}` : "Referencia equipo";
  const fallbackReason = useShift
    ? null
    : agent.shiftId === null
      ? "El agente no encaja en ningún turno configurado; se usa la ocupación del equipo."
      : shift && shift.occupancy === null
        ? `El turno ${shift.shiftName} no tiene tiempo de sesión suficiente; se usa la ocupación del equipo.`
        : shift
          ? `El turno ${shift.shiftName} solo tiene 1 agente; se usa la ocupación del equipo.`
          : "No hay datos del turno del agente; se usa la ocupación del equipo.";

  const base = {
    referenceKind: (useShift ? "shift" : "team") as "shift" | "team",
    referenceShiftId: useShift ? shift!.shiftId : null,
    referenceShiftName: useShift ? shift!.shiftName : null,
    fallbackReason,
  };

  if (agent.occupancy === null || referenceOccupancy === null) {
    return {
      agentOccupancy: agent.occupancy,
      referenceOccupancy,
      referenceLabel,
      ...base,
      teamOccupancy,
      deviation: null,
      status: "unknown",
      label: "Sin datos suficientes para comparar",
    };
  }

  const deviation = agent.occupancy - referenceOccupancy;
  const status =
    Math.abs(deviation) <= tolerancePoints ? "within" : deviation > 0 ? "above" : "below";
  const label =
    status === "within"
      ? "Dentro del rango operativo"
      : status === "above"
        ? `Por encima de la ${useShift ? "referencia del turno" : "referencia del equipo"}`
        : `Por debajo de la ${useShift ? "referencia del turno" : "referencia del equipo"}`;

  return {
    agentOccupancy: agent.occupancy,
    referenceOccupancy,
    referenceLabel,
    ...base,
    teamOccupancy,
    deviation,
    status,
    label,
  };
}

export type OperationalAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
};

/** Alertas derivadas de datos reales: no se generan avisos sin causa. */
export function deriveAlerts(
  agents: AgentMetrics[],
  distribution: CategorySlice[],
  kpis: Kpis,
  quality: DataQuality | null,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  distribution
    .filter((slice) => slice.status === "high" && slice.count > 0)
    .forEach((slice) => {
      alerts.push({
        id: `high-${slice.key}`,
        severity: slice.percentage >= 30 ? "critical" : "warning",
        title: `Concentración de carga alta: ${slice.name}`,
        description: `${slice.count} de ${agents.length} agentes (${slice.percentage.toFixed(1).replace(".", ",")}%) están en la categoría "${slice.name}".`,
      });
    });

  const lowSlices = distribution.filter((s) => s.status === "low" && s.percentage >= 50);
  lowSlices.forEach((slice) => {
    alerts.push({
      id: `low-${slice.key}`,
      severity: "warning",
      title: `Capacidad infrautilizada: ${slice.name}`,
      description: `${slice.count} agentes (${slice.percentage.toFixed(1).replace(".", ",")}%) se sitúan en "${slice.name}".`,
    });
  });

  if (kpis.withoutShift > 0) {
    alerts.push({
      id: "no-shift",
      severity: "warning",
      title: "Agentes sin turno asignado",
      description: `${kpis.withoutShift} agente(s) no encajan en ningún horario configurado. Revisa los turnos en Configuración.`,
    });
  }

  const noOccupancy = agents.filter((a) => a.occupancy === null).length;
  if (noOccupancy > 0) {
    alerts.push({
      id: "no-occupancy",
      severity: "info",
      title: "Agentes sin ocupación calculable",
      description: `${noOccupancy} agente(s) sin tiempo de sesión registrado; no se calcula ocupación.`,
    });
  }

  if (quality) {
    if (quality.invalidRows > 0) {
      alerts.push({
        id: "invalid-rows",
        severity: "critical",
        title: "Filas no válidas en la importación",
        description: `${quality.invalidRows} fila(s) descartadas por datos incompletos o no válidos. Consulta Calidad de datos.`,
      });
    }
    if (quality.duplicateRows > 0) {
      alerts.push({
        id: "duplicate-rows",
        severity: "warning",
        title: "Sesiones duplicadas detectadas",
        description: `${quality.duplicateRows} fila(s) duplicadas (misma sesión y agente) excluidas del agregado para no contar doble.`,
      });
    }
    if (quality.anomalousSessions > 0) {
      alerts.push({
        id: "anomalous",
        severity: "warning",
        title: "Sesiones anómalas",
        description: `${quality.anomalousSessions} sesión(es) con tiempo productivo superior al tiempo de sesión.`,
      });
    }
    if (quality.zeroCallSessions > 0) {
      alerts.push({
        id: "zero-calls",
        severity: "info",
        title: "Sesiones sin llamadas",
        description: `${quality.zeroCallSessions} sesión(es) registradas sin ninguna llamada.`,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export type ComparisonRow = {
  label: string;
  a: number | null;
  b: number | null;
  delta: number | null;
  format: "number" | "duration" | "percent";
};

function diff(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return b - a;
}

export function compareDatasets(
  aAgents: AgentMetrics[],
  bAgents: AgentMetrics[],
  aKpis: Kpis,
  bKpis: Kpis,
): ComparisonRow[] {
  void aAgents;
  void bAgents;
  return [
    {
      label: "Agentes",
      a: aKpis.agents,
      b: bKpis.agents,
      delta: bKpis.agents - aKpis.agents,
      format: "number",
    },
    {
      label: "Sesiones",
      a: aKpis.sessions,
      b: bKpis.sessions,
      delta: bKpis.sessions - aKpis.sessions,
      format: "number",
    },
    {
      label: "Llamadas",
      a: aKpis.calls,
      b: bKpis.calls,
      delta: bKpis.calls - aKpis.calls,
      format: "number",
    },
    {
      label: "T. Productivo",
      a: aKpis.productiveSeconds,
      b: bKpis.productiveSeconds,
      delta: bKpis.productiveSeconds - aKpis.productiveSeconds,
      format: "duration",
    },
    {
      label: "Ocupación operativa",
      a: aKpis.avgOccupancy,
      b: bKpis.avgOccupancy,
      delta: diff(aKpis.avgOccupancy, bKpis.avgOccupancy),
      format: "percent",
    },
  ];
}

export type ShiftComparisonRow = {
  shiftName: string;
  aOccupancy: number | null;
  bOccupancy: number | null;
  aCalls: number;
  bCalls: number;
  aAgents: number;
  bAgents: number;
};

export function compareByShift(a: ShiftMetrics[], b: ShiftMetrics[]): ShiftComparisonRow[] {
  const keys = Array.from(new Set([...a, ...b].map((s) => s.shiftId ?? "__none__")));
  return keys.map((key) => {
    const left = a.find((s) => (s.shiftId ?? "__none__") === key);
    const right = b.find((s) => (s.shiftId ?? "__none__") === key);
    return {
      shiftName: left?.shiftName ?? right?.shiftName ?? "Sin turno asignado",
      aOccupancy: left?.occupancy ?? null,
      bOccupancy: right?.occupancy ?? null,
      aCalls: left?.calls ?? 0,
      bCalls: right?.calls ?? 0,
      aAgents: left?.agents ?? 0,
      bAgents: right?.agents ?? 0,
    };
  });
}
