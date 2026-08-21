import { describe, expect, it } from "vitest";
import {
  detectPreset,
  filterByPeriod,
  fullPeriod,
  isSingleDay,
  normalizePeriod,
  periodDates,
  periodFileSuffix,
  periodLabel,
  presetPeriod,
} from "../period";
import {
  ACTIVE_SECONDS_PER_DAY,
  aggregateAgents,
  computeKpis,
  computeOccupancy,
  detectShift,
} from "../aggregate";
import {
  aggregateByShift,
  agentDailyBreakdown,
  buildBenchmark,
  dailyMetrics,
  deriveDailyExceptions,
  loadDistribution,
} from "../analysis";
import { recomputeQuality, filterIssuesByPeriod, countUndatedIssues } from "../quality";
import { targetState } from "@/components/wfm/OccupancyTarget";
import { DEFAULT_CATEGORIES, DEFAULT_SHIFTS } from "../store";
import type { ParseIssue, SessionRecord } from "../types";

const H = 3600;

function record(
  partial: Partial<SessionRecord> & {
    agent: string;
    sessionId: string;
    date: string;
    startHour?: number;
  },
): SessionRecord {
  const { date, startHour = 8, ...rest } = partial;
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!, startHour, 0, 0);
  const sessionSeconds = rest.sessionSeconds ?? 8 * H;
  return {
    sessionId: rest.sessionId,
    agent: rest.agent,
    desk: "",
    start,
    end: new Date(start.getTime() + sessionSeconds * 1000),
    operationalDate: date,
    sessionSeconds,
    calls: rest.calls ?? 10,
    conversationSeconds: rest.conversationSeconds ?? 2 * H,
    acwSeconds: rest.acwSeconds ?? 1 * H,
    productiveSeconds: rest.productiveSeconds ?? 4 * H,
  };
}

const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"];

const dataset: SessionRecord[] = [
  // Día 1: sesión corta con ocupación muy alta (día crítico)
  record({ agent: "Ana", sessionId: "s1", date: "2026-08-01", sessionSeconds: H, productiveSeconds: 0.95 * H }),
  // Día 2 y 3: jornadas largas equilibradas
  record({ agent: "Ana", sessionId: "s2", date: "2026-08-02", sessionSeconds: 8 * H, productiveSeconds: 5 * H }),
  record({ agent: "Ana", sessionId: "s3", date: "2026-08-03", sessionSeconds: 4 * H, productiveSeconds: 2 * H }),
  record({ agent: "Ana", sessionId: "s3b", date: "2026-08-03", sessionSeconds: 4 * H, productiveSeconds: 2 * H }),
  record({ agent: "Beto", sessionId: "s4", date: "2026-08-02", sessionSeconds: 8 * H, productiveSeconds: 4 * H }),
  record({ agent: "Beto", sessionId: "s5", date: "2026-08-04", sessionSeconds: 8 * H, productiveSeconds: 6 * H }),
];

describe("modelo de período", () => {
  it("normaliza rangos invertidos", () => {
    expect(normalizePeriod({ from: "2026-08-04", to: "2026-08-01" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-04",
    });
  });

  it("inicializa al rango completo y detecta un solo día", () => {
    expect(fullPeriod(dates)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
    expect(isSingleDay({ from: "2026-08-02", to: "2026-08-02" })).toBe(true);
    expect(fullPeriod(["2026-08-02"])).toEqual({ from: "2026-08-02", to: "2026-08-02" });
  });

  it("los presets seleccionan las fechas esperadas", () => {
    expect(presetPeriod("all", dates)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
    expect(presetPeriod("last-day", dates)).toEqual({ from: "2026-08-04", to: "2026-08-04" });
    expect(presetPeriod("last-3", dates)).toEqual({ from: "2026-08-02", to: "2026-08-04" });
    expect(presetPeriod("last-7", dates)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
    expect(presetPeriod("this-month", dates)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
    expect(presetPeriod("all", [])).toBeNull();
    expect(detectPreset({ from: "2026-08-04", to: "2026-08-04" }, dates)).toBe("last-day");
    expect(detectPreset({ from: "2026-08-02", to: "2026-08-03" }, dates)).toBe("custom");
  });

  it("filtra por día operativo y tolera días sin registros", () => {
    const filtered = filterByPeriod(dataset, { from: "2026-08-02", to: "2026-08-03" });
    expect(filtered.map((r) => r.sessionId)).toEqual(["s2", "s3", "s3b", "s4"]);
    expect(filterByPeriod(dataset, { from: "2026-09-01", to: "2026-09-30" })).toHaveLength(0);
    expect(periodDates(dates, { from: "2026-08-02", to: "2026-08-09" })).toEqual([
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
    ]);
  });

  it("etiquetas y nombres de archivo reflejan el rango", () => {
    expect(periodLabel({ from: "2026-08-01", to: "2026-08-01" })).toBe("01/08/2026");
    expect(periodLabel({ from: "2026-08-01", to: "2026-08-07" })).toBe("01/08/2026 – 07/08/2026");
    expect(periodFileSuffix({ from: "2026-08-01", to: "2026-08-07" })).toBe(
      "2026-08-01_2026-08-07",
    );
    expect(periodFileSuffix({ from: "2026-08-01", to: "2026-08-01" })).toBe("2026-08-01");
  });
});

describe("equivalencia con la lógica de un día", () => {
  const day = "2026-08-02";
  // Referencia: filtrado por igualdad estricta de día operativo (lógica anterior).
  const legacy = dataset.filter((r) => r.operationalDate === day);
  const viaPeriod = filterByPeriod(dataset, { from: day, to: day });

  it("el conjunto filtrado es idéntico", () => {
    expect(viaPeriod).toEqual(legacy);
  });

  it("las métricas por agente coinciden campo a campo", () => {
    const a = aggregateAgents(legacy, DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
    const b = aggregateAgents(viaPeriod, DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
    expect(b).toEqual(a);
    expect(computeKpis(b)).toEqual(computeKpis(a));
    expect(loadDistribution(b, DEFAULT_CATEGORIES)).toEqual(
      loadDistribution(a, DEFAULT_CATEGORIES),
    );
    expect(aggregateByShift(b, DEFAULT_SHIFTS, DEFAULT_CATEGORIES)).toEqual(
      aggregateByShift(a, DEFAULT_SHIFTS, DEFAULT_CATEGORIES),
    );
  });

  it("la jornada esperada e inactividad no cambian de fórmula", () => {
    const [agent] = aggregateAgents(viaPeriod, DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
    expect(agent!.workedDays).toBe(1);
    expect(agent!.expectedActiveSeconds).toBe(ACTIVE_SECONDS_PER_DAY);
    expect(agent!.idleSeconds).toBe(
      Math.max(0, ACTIVE_SECONDS_PER_DAY - agent!.productiveSeconds),
    );
  });
});

describe("agregación multi-día", () => {
  const period = { from: "2026-08-01", to: "2026-08-04" };
  const records = filterByPeriod(dataset, period);
  const agents = aggregateAgents(records, DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
  const ana = agents.find((a) => a.agent === "Ana")!;

  it("suma duraciones, llamadas y sesiones", () => {
    expect(ana.sessions).toBe(4);
    expect(ana.calls).toBe(40);
    expect(ana.sessionSeconds).toBe(H + 8 * H + 4 * H + 4 * H);
    expect(ana.productiveSeconds).toBeCloseTo(0.95 * H + 5 * H + 2 * H + 2 * H, 6);
  });

  it("la ocupación es Σ productivo / Σ sesión, no la media de ocupaciones diarias", () => {
    const expected = (ana.productiveSeconds / ana.sessionSeconds) * 100;
    expect(ana.occupancy).toBeCloseTo(expected, 10);

    const daily = agentDailyBreakdown(ana.records, DEFAULT_SHIFTS).map((d) => d.occupancy!);
    const meanOfDaily = daily.reduce((a, x) => a + x, 0) / daily.length;
    expect(Math.abs(meanOfDaily - ana.occupancy!)).toBeGreaterThan(1);
  });

  it("categoriza la ocupación agregada del período", () => {
    const kpis = computeKpis(agents);
    expect(kpis.avgOccupancy).toBeCloseTo(
      (agents.reduce((a, x) => a + x.productiveSeconds, 0) /
        agents.reduce((a, x) => a + x.sessionSeconds, 0)) *
        100,
      10,
    );
    expect(ana.category?.id).toBe("moderadamente-baja");
  });

  it("varias sesiones el mismo día cuentan un solo día trabajado", () => {
    expect(ana.workedDays).toBe(3);
  });

  it("no duplica agentes presentes en varios días al contarlos por turno", () => {
    const shiftRows = aggregateByShift(agents, DEFAULT_SHIFTS, DEFAULT_CATEGORIES);
    expect(shiftRows.reduce((a, x) => a + x.agents, 0)).toBe(2);
    const morning = shiftRows.find((s) => s.shiftId === "manana")!;
    expect(morning.agents).toBe(2);
    expect(morning.occupancy).toBeCloseTo(
      computeOccupancy(morning.productiveSeconds, morning.sessionSeconds)!,
      10,
    );
  });

  it("la comparación relativa usa ratios del período", () => {
    const shiftRows = aggregateByShift(agents, DEFAULT_SHIFTS, DEFAULT_CATEGORIES);
    const benchmark = buildBenchmark(ana, agents, shiftRows);
    const teamOccupancy = computeOccupancy(
      agents.reduce((a, x) => a + x.productiveSeconds, 0),
      agents.reduce((a, x) => a + x.sessionSeconds, 0),
    );
    expect(benchmark.teamOccupancy).toBeCloseTo(teamOccupancy!, 10);
    expect(benchmark.deviation).toBeCloseTo(ana.occupancy! - benchmark.referenceOccupancy!, 10);
  });

  it("la desviación frente al objetivo es ocupación del período − objetivo", () => {
    const kpis = computeKpis(agents);
    const deviation = kpis.avgOccupancy! - 70;
    expect(deviation).toBeCloseTo(kpis.avgOccupancy! - 70, 10);
    expect(targetState(kpis.avgOccupancy, 70, 5)).toBe("below");
    expect(targetState(null, 70, 5)).toBe("unavailable");
  });

  it("detecta un día crítico dentro de un período equilibrado", () => {
    const days = dailyMetrics(records);
    const exceptions = deriveDailyExceptions(days, 70, 5);
    expect(days).toHaveLength(4);
    expect(exceptions.above.map((d) => d.date)).toEqual(["2026-08-01"]);
    expect(exceptions.worst?.date).toBe("2026-08-01");
    expect(exceptions.below.length + exceptions.above.length + exceptions.onTarget).toBe(4);
  });

  it("período vacío: sin NaN ni Infinity", () => {
    const empty = aggregateAgents([], DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
    const kpis = computeKpis(empty);
    expect(empty).toHaveLength(0);
    expect(kpis.avgOccupancy).toBeNull();
    expect(Number.isFinite(kpis.productiveSeconds)).toBe(true);
    expect(dailyMetrics([])).toEqual([]);
    expect(deriveDailyExceptions([], 70, 5).worst).toBeNull();
  });
});

describe("sesiones nocturnas", () => {
  const night = record({
    agent: "Nico",
    sessionId: "n1",
    date: "2026-08-02",
    startHour: 23,
    sessionSeconds: 8 * H,
    productiveSeconds: 4 * H,
  });

  it("pertenece a un solo día operativo y a un solo turno", () => {
    expect(filterByPeriod([night], { from: "2026-08-02", to: "2026-08-02" })).toHaveLength(1);
    expect(filterByPeriod([night], { from: "2026-08-03", to: "2026-08-03" })).toHaveLength(0);
    expect(detectShift([night], DEFAULT_SHIFTS)?.id).toBe("noche");
    const [agent] = aggregateAgents([night], DEFAULT_SHIFTS, DEFAULT_CATEGORIES, 0);
    expect(agent!.workedDays).toBe(1);
    expect(agent!.shiftBreakdown).toHaveLength(1);
    expect(agent!.shiftBreakdown[0]!.shiftId).toBe("noche");
  });
});

describe("calidad de datos por período", () => {
  const issues: ParseIssue[] = [
    {
      row: 2,
      sessionId: "x1",
      agent: "Ana",
      kind: "duplicate",
      severity: "warning",
      message: "dup",
      operationalDate: "2026-08-01",
    },
    {
      row: 3,
      sessionId: "x2",
      agent: "Beto",
      kind: "invalid-calls",
      severity: "error",
      message: "err",
      operationalDate: "2026-08-04",
    },
    {
      row: 4,
      sessionId: "x3",
      agent: "Ana",
      kind: "zero-calls",
      severity: "warning",
      message: "zero",
      operationalDate: "2026-08-02",
    },
    {
      row: 5,
      sessionId: "x4",
      agent: "Sin fecha",
      kind: "invalid-dates",
      severity: "warning",
      message: "no date",
      operationalDate: null,
    },
  ];

  it("los contadores cambian con el período y excluyen filas fuera de rango", () => {
    const period = { from: "2026-08-01", to: "2026-08-02" };
    const scopedIssues = filterIssuesByPeriod(issues, period);
    const quality = recomputeQuality(filterByPeriod(dataset, period), scopedIssues);
    expect(scopedIssues.map((i) => i.row)).toEqual([2, 4]);
    expect(quality.validRows).toBe(3);
    expect(quality.duplicateRows).toBe(1);
    expect(quality.invalidRows).toBe(0);
    expect(quality.zeroCallSessions).toBe(1);
    expect(quality.agents).toBe(2);
    expect(quality.totalRows).toBe(4);

    const wide = { from: "2026-08-01", to: "2026-08-04" };
    const wideQuality = recomputeQuality(
      filterByPeriod(dataset, wide),
      filterIssuesByPeriod(issues, wide),
    );
    expect(wideQuality.invalidRows).toBe(1);
    expect(wideQuality.validRows).toBe(6);
    expect(countUndatedIssues(issues)).toBe(1);
  });
});
