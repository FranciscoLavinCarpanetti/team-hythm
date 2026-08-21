import type { AgentMetrics, Kpis, LoadCategory, SessionRecord, Shift } from "./types";

/** Jornada diaria activa esperada: 8 h menos 30 min de descanso. */
export const ACTIVE_SECONDS_PER_DAY = 7.5 * 3600;

export function categorize(
  occupancy: number | null,
  categories: LoadCategory[],
): LoadCategory | null {
  if (occupancy === null) return null;
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  return sorted.find((c) => occupancy >= c.min && occupancy <= c.max) ?? null;
}

/** Occupancy from aggregated durations — never an average of session percentages. */
export function computeOccupancy(productiveSeconds: number, sessionSeconds: number): number | null {
  if (!sessionSeconds || sessionSeconds <= 0) return null;
  return (productiveSeconds / sessionSeconds) * 100;
}


const toMinutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

/** True when the given clock minute falls inside the shift window (midnight-safe). */
export function isWithinShift(minutes: number, shift: Shift): boolean {
  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end);
  if (start === end) return true;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * Caché de solape sesión×turno. El solape real en segundos se calcula una sola
 * vez por sesión y configuración de turnos, y se reutiliza en `detectShift` y
 * `shiftBreakdown` (antes se recalculaba en cada pasada).
 */
const overlapCache = new WeakMap<SessionRecord, { key: string; values: Map<string, number> }>();

function shiftsKey(shifts: Shift[]): string {
  return shifts.map((s) => `${s.id}:${s.start}-${s.end}`).join("|");
}

function cachedOverlapSeconds(record: SessionRecord, shift: Shift, shifts: Shift[]): number {
  const key = shiftsKey(shifts);
  let entry = overlapCache.get(record);
  if (!entry || entry.key !== key) {
    entry = { key, values: new Map() };
    overlapCache.set(record, entry);
  }
  const cached = entry.values.get(shift.id);
  if (cached !== undefined) return cached;
  const value = shiftOverlapSeconds(record, shift);
  entry.values.set(shift.id, value);
  return value;
}

function shiftOverlapSeconds(record: SessionRecord, shift: Shift): number {

  if (!record.start || !record.end || record.end <= record.start) return 0;

  const shiftStartMinutes = toMinutes(shift.start);
  const shiftEndMinutes = toMinutes(shift.end);
  const crossesMidnight = shiftEndMinutes <= shiftStartMinutes;
  const firstDay = new Date(
    record.start.getFullYear(),
    record.start.getMonth(),
    record.start.getDate() - 1,
  );
  const lastDay = new Date(
    record.end.getFullYear(),
    record.end.getMonth(),
    record.end.getDate(),
  );

  let overlapMs = 0;
  for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
    const windowStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Math.floor(shiftStartMinutes / 60),
      shiftStartMinutes % 60,
    );
    const windowEnd = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate() + (crossesMidnight ? 1 : 0),
      Math.floor(shiftEndMinutes / 60),
      shiftEndMinutes % 60,
    );
    overlapMs += Math.max(
      0,
      Math.min(record.end.getTime(), windowEnd.getTime()) -
        Math.max(record.start.getTime(), windowStart.getTime()),
    );
  }

  return overlapMs / 1000;
}

/** Shift matching the greatest part of the complete session interval. */
export function shiftForSession(record: SessionRecord, shifts: Shift[]): Shift | null {
  let best: { shift: Shift; overlap: number } | null = null;
  for (const shift of shifts) {
    const overlap = shiftOverlapSeconds(record, shift);
    if (!best || overlap > best.overlap) best = { shift, overlap };
  }
  if (best && best.overlap > 0) return best.shift;

  const reference = record.start ?? record.end;
  if (!reference) return null;
  const minutes = reference.getHours() * 60 + reference.getMinutes();
  return shifts.find((shift) => isWithinShift(minutes, shift)) ?? null;
}

/** Dominant configured shift for an agent, based on actual session overlap. */
export function detectShift(records: SessionRecord[], shifts: Shift[]): Shift | null {
  const weight = new Map<string, number>();
  for (const record of records) {
    let matchedOverlap = 0;
    for (const shift of shifts) {
      const overlap = shiftOverlapSeconds(record, shift);
      if (overlap > 0) {
        weight.set(shift.id, (weight.get(shift.id) ?? 0) + overlap);
        matchedOverlap += overlap;
      }
    }
    if (matchedOverlap === 0) {
      const shift = shiftForSession(record, shifts);
      if (shift) weight.set(shift.id, (weight.get(shift.id) ?? 0) + (record.sessionSeconds || 1));
    }
  }
  let best: { id: string; value: number } | null = null;
  weight.forEach((value, id) => {
    if (!best || value > best.value) best = { id, value };
  });
  const bestId = (best as { id: string; value: number } | null)?.id;
  return bestId ? (shifts.find((s) => s.id === bestId) ?? null) : null;
}

/** Reparto de días trabajados por turno (turno dominante de cada día operativo). */
export function shiftBreakdown(
  records: SessionRecord[],
  shifts: Shift[],
): { shiftId: string | null; shiftName: string; days: number; percentage: number }[] {
  const byDay = new Map<string, SessionRecord[]>();
  for (const record of records) {
    if (!record.operationalDate) continue;
    const list = byDay.get(record.operationalDate);
    if (list) list.push(record);
    else byDay.set(record.operationalDate, [record]);
  }

  const days = new Map<string, { name: string; count: number }>();
  byDay.forEach((dayRecords) => {
    const shift = detectShift(dayRecords, shifts);
    const key = shift ? shift.id : "__none__";
    const name = shift ? shift.name : "Sin turno asignado";
    const current = days.get(key);
    if (current) current.count += 1;
    else days.set(key, { name, count: 1 });
  });

  const total = Array.from(days.values()).reduce((a, x) => a + x.count, 0);
  return Array.from(days.entries())
    .map(([key, value]) => ({
      shiftId: key === "__none__" ? null : key,
      shiftName: value.name,
      days: value.count,
      percentage: total ? (value.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage || a.shiftName.localeCompare(b.shiftName, "es"));
}

export function aggregateAgents(
  records: SessionRecord[],
  shifts: Shift[],
  categories: LoadCategory[],
  /** Ajuste % sobre la jornada activa esperada (p. ej. -30 = 70% del esperado). */
  expectedAdjustmentPercent = 0,
): AgentMetrics[] {
  const adjustmentFactor = Math.max(0, 1 + expectedAdjustmentPercent / 100);
  const byAgent = new Map<string, SessionRecord[]>();
  for (const record of records) {
    const list = byAgent.get(record.agent);
    if (list) list.push(record);
    else byAgent.set(record.agent, [record]);
  }

  return Array.from(byAgent.entries()).map(([agent, agentRecords]) => {
    const sum = (pick: (r: SessionRecord) => number) =>
      agentRecords.reduce((acc, r) => acc + pick(r), 0);

    const productiveSeconds = sum((r) => r.productiveSeconds);
    const sessionSeconds = sum((r) => r.sessionSeconds);
    const occupancy = computeOccupancy(productiveSeconds, sessionSeconds);
    const shift = detectShift(agentRecords, shifts);
    const workedDays = new Set(
      agentRecords.map((r) => r.operationalDate).filter((d): d is string => Boolean(d)),
    ).size;
    const expectedActiveSeconds = workedDays * ACTIVE_SECONDS_PER_DAY * adjustmentFactor;
    const idleSeconds = Math.max(0, expectedActiveSeconds - productiveSeconds);

    return {
      agent,
      shiftId: shift ? shift.id : null,
      shiftName: shift ? shift.name : "Sin turno asignado",
      shiftBreakdown: shiftBreakdown(agentRecords, shifts),
      sessions: agentRecords.length,
      calls: sum((r) => r.calls),
      conversationSeconds: sum((r) => r.conversationSeconds),
      acwSeconds: sum((r) => r.acwSeconds),
      productiveSeconds,
      sessionSeconds,
      workedDays,
      expectedActiveSeconds,
      idleSeconds,
      occupancy,
      category: categorize(occupancy, categories),
      records: [...agentRecords].sort(
        (a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0),
      ),
    };
  });
}

/**
 * Average occupancy is weighted operationally: total productive time over total
 * session time across all filtered agents (not a mean of agent percentages).
 */
export function computeKpis(agents: AgentMetrics[]): Kpis {
  const productiveSeconds = agents.reduce((a, x) => a + x.productiveSeconds, 0);
  const sessionSeconds = agents.reduce((a, x) => a + x.sessionSeconds, 0);
  const count = (...statuses: LoadCategory["status"][]) =>
    agents.filter((a) => a.category && statuses.includes(a.category.status)).length;

  const expectedActiveSeconds = agents.reduce((a, x) => a + x.expectedActiveSeconds, 0);

  return {
    agents: agents.length,
    sessions: agents.reduce((a, x) => a + x.sessions, 0),
    calls: agents.reduce((a, x) => a + x.calls, 0),
    productiveSeconds,
    sessionSeconds,
    expectedActiveSeconds,
    idleSeconds: agents.reduce((a, x) => a + x.idleSeconds, 0),
    avgOccupancy: computeOccupancy(productiveSeconds, sessionSeconds),
    low: count("low", "moderate-low"),
    balanced: count("balanced"),
    high: count("high", "very-high", "critical"),
    withoutShift: agents.filter((a) => a.shiftId === null).length,
  };
}

export function validateCategories(categories: LoadCategory[]): string[] {
  const errors: string[] = [];
  const sorted = [...categories].sort((a, b) => a.min - b.min);
  sorted.forEach((c) => {
    if (!c.name.trim()) errors.push("Todas las categorías necesitan un nombre.");
    if (isNaN(c.min) || isNaN(c.max)) errors.push(`Rango no numérico en "${c.name}".`);
    else if (c.min > c.max) errors.push(`El mínimo supera al máximo en "${c.name}".`);
    if (c.min < 0 || c.max > 100) errors.push(`El rango de "${c.name}" debe estar entre 0 y 100.`);
  });
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.min <= prev.max) {
      errors.push(`Los rangos de "${prev.name}" y "${current.name}" se solapan.`);
    }
  }
  return Array.from(new Set(errors));
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function shiftDurationLabel(shift: Shift): string {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) * 60 + Number(m);
  };
  let diff = toMinutes(shift.end) - toMinutes(shift.start);
  if (diff <= 0) diff += 24 * 60;
  const hours = diff / 60;
  const crosses = toMinutes(shift.end) <= toMinutes(shift.start);
  return `${hours}h${crosses ? " · cruza medianoche" : ""}`;
}
