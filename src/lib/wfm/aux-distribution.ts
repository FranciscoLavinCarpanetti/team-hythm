import type { SessionRecord } from "./types";
import type {
  AuxDiagnostics,
  AuxMapping,
  AuxRecord,
  DistributionSlice,
  MacroCategory,
  TimeDistribution,
} from "./aux-types";

/** Macro-categorías por defecto (configurables desde Configuración → Estados AUX). */
export const DEFAULT_MACRO_CATEGORIES: MacroCategory[] = [
  { id: "pausas", name: "Pausas", order: 1, tone: "accent" },
  { id: "desarrollo", name: "Desarrollo", order: 2, tone: "secondary" },
  { id: "soporte-operativo", name: "Soporte operativo", order: 3, tone: "low" },
  { id: "reunion", name: "Reunión", order: 4, tone: "balanced" },
  { id: "causa", name: "Causa", order: 5, tone: "neutral" },
];

/** Mapeo por defecto estado AUX (clave normalizada) → macro-categoría. */
export const DEFAULT_AUX_MAPPING: AuxMapping = {
  descanso: "pausas",
  pausa: "pausas",
  formacion: "desarrollo",
  nesting: "desarrollo",
  "gestion personal": "causa",
  "incidencia tecnica": "causa",
  coordinacion: "soporte-operativo",
  soporte: "soporte-operativo",
  tickets: "soporte-operativo",
  reunion: "reunion",
};

export const SYSTEM_SLICES = {
  work: { key: "__work__", name: "Trabajo directo", tone: "primary" as const },
  acw: { key: "__acw__", name: "ACW", tone: "high" as const },
  unclassified: { key: "__unclassified__", name: "Sin clasificar", tone: "neutral" as const },
};

export const SLICE_INFO = {
  work: "Tiempo en conversación obtenido del campo TT del fichero de sesiones.",
  acw: "Tiempo de gestión posterior a una llamada obtenido del campo ACW del fichero de sesiones.",
  unclassified:
    "Tiempo de sesión que no puede asignarse de forma fiable a conversación, ACW o un estado AUX válido.",
};

export type AuxIndex = Map<string, AuxRecord[]>;

export function auxKey(sessionId: string, agent: string): string {
  return `${sessionId}|${agent}`;
}

/** Índice de registros AUX por Sesión + Agente (nunca solo por agente). */
export function buildAuxIndex(records: AuxRecord[]): AuxIndex {
  const index: AuxIndex = new Map();
  for (const record of records) {
    const key = auxKey(record.sessionId, record.agent);
    const list = index.get(key);
    if (list) list.push(record);
    else index.set(key, [record]);
  }
  index.forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime() || a.row - b.row));
  return index;
}

type SessionReconciliation = {
  secondsByState: Map<string, number>;
  matchedRows: number;
  overlappingIntervals: number;
  clippedRecords: number;
  clippedSeconds: number;
  outsideSessionRecords: number;
  sessionsWithoutInterval: number;
  deskMismatches: number;
  auxSeconds: number;
};

const EMPTY: SessionReconciliation = {
  secondsByState: new Map(),
  matchedRows: 0,
  overlappingIntervals: 0,
  clippedRecords: 0,
  clippedSeconds: 0,
  outsideSessionRecords: 0,
  sessionsWithoutInterval: 0,
  deskMismatches: 0,
  auxSeconds: 0,
};

/**
 * Unión de intervalos AUX dentro de una sesión: cada segundo se asigna una sola
 * vez y, ante solape, gana el intervalo AUX más temprano. El resultado se guarda
 * por estado bruto para que cambiar el mapeo no obligue a reconciliar de nuevo.
 */
function reconcileSession(session: SessionRecord, auxList: AuxRecord[]): SessionReconciliation {
  const result: SessionReconciliation = {
    secondsByState: new Map(),
    matchedRows: auxList.length,
    overlappingIntervals: 0,
    clippedRecords: 0,
    clippedSeconds: 0,
    outsideSessionRecords: 0,
    sessionsWithoutInterval: 0,
    deskMismatches: 0,
    auxSeconds: 0,
  };
  if (!auxList.length) return result;
  if (!session.start || !session.end || session.end.getTime() <= session.start.getTime()) {
    result.sessionsWithoutInterval = 1;
    return result;
  }

  const sessionStart = session.start.getTime();
  const sessionEnd = session.end.getTime();
  /** Intervalos ya asignados (ordenados y disjuntos). */
  const claimed: { start: number; end: number }[] = [];

  for (const aux of auxList) {
    if (session.desk && aux.desk && session.desk !== aux.desk) result.deskMismatches += 1;
    const rawStart = aux.start.getTime();
    const rawEnd = aux.end.getTime();
    const start = Math.max(rawStart, sessionStart);
    const end = Math.min(rawEnd, sessionEnd);
    if (end <= start) {
      result.outsideSessionRecords += 1;
      continue;
    }
    if (start > rawStart || end < rawEnd) {
      result.clippedRecords += 1;
      result.clippedSeconds += (start - rawStart + (rawEnd - end)) / 1000;
    }

    // Resta las porciones ya asignadas por intervalos AUX anteriores.
    let assignedMs = 0;
    let overlapped = false;
    let cursor = start;
    for (const block of claimed) {
      if (block.end <= cursor) continue;
      if (block.start >= end) break;
      if (block.start > cursor) assignedMs += block.start - cursor;
      else overlapped = true;
      cursor = Math.max(cursor, block.end);
      if (cursor >= end) break;
    }
    if (cursor < end) assignedMs += end - cursor;
    if (assignedMs < end - start) overlapped = true;
    if (overlapped) result.overlappingIntervals += 1;
    if (assignedMs <= 0) continue;

    claimed.push({ start, end });
    claimed.sort((a, b) => a.start - b.start);
    // Fusiona para mantener la lista disjunta.
    for (let i = 1; i < claimed.length; ) {
      const prev = claimed[i - 1]!;
      const current = claimed[i]!;
      if (current.start <= prev.end) {
        prev.end = Math.max(prev.end, current.end);
        claimed.splice(i, 1);
      } else i += 1;
    }

    const seconds = assignedMs / 1000;
    result.secondsByState.set(aux.stateKey, (result.secondsByState.get(aux.stateKey) ?? 0) + seconds);
    result.auxSeconds += seconds;
  }

  return result;
}

/** Caché por sesión: la unión de intervalos no se recalcula en cada render. */
const sessionCache = new WeakMap<SessionRecord, { aux: AuxRecord[]; value: SessionReconciliation }>();

function cachedReconcile(session: SessionRecord, auxList: AuxRecord[]): SessionReconciliation {
  if (!auxList.length) return EMPTY;
  const cached = sessionCache.get(session);
  if (cached && cached.aux === auxList) return cached.value;
  const value = reconcileSession(session, auxList);
  sessionCache.set(session, { aux: auxList, value });
  return value;
}

export type AuxReconciliation = SessionReconciliation & {
  sessionKeys: Set<string>;
  agentsWithAux: Set<string>;
  agentsWithoutAux: Set<string>;
};

/** Reconciliación agregada de un conjunto de sesiones frente al índice AUX. */
export function reconcileAux(records: SessionRecord[], index: AuxIndex): AuxReconciliation {
  const total: AuxReconciliation = {
    secondsByState: new Map(),
    matchedRows: 0,
    overlappingIntervals: 0,
    clippedRecords: 0,
    clippedSeconds: 0,
    outsideSessionRecords: 0,
    sessionsWithoutInterval: 0,
    deskMismatches: 0,
    auxSeconds: 0,
    sessionKeys: new Set(),
    agentsWithAux: new Set(),
    agentsWithoutAux: new Set(),
  };

  for (const record of records) {
    const key = auxKey(record.sessionId, record.agent);
    total.sessionKeys.add(key);
    const auxList = index.get(key) ?? [];
    if (!auxList.length) continue;
    const part = cachedReconcile(record, auxList);
    total.matchedRows += part.matchedRows;
    total.overlappingIntervals += part.overlappingIntervals;
    total.clippedRecords += part.clippedRecords;
    total.clippedSeconds += part.clippedSeconds;
    total.outsideSessionRecords += part.outsideSessionRecords;
    total.sessionsWithoutInterval += part.sessionsWithoutInterval;
    total.deskMismatches += part.deskMismatches;
    total.auxSeconds += part.auxSeconds;
    if (part.auxSeconds > 0) total.agentsWithAux.add(record.agent);
    part.secondsByState.forEach((seconds, state) => {
      total.secondsByState.set(state, (total.secondsByState.get(state) ?? 0) + seconds);
    });
  }

  for (const record of records) {
    if (!total.agentsWithAux.has(record.agent)) total.agentsWithoutAux.add(record.agent);
  }

  return total;
}

/**
 * Distribución del tiempo con WS como 100 %.
 * Precedencia: conversación → ACW → estado AUX. El tiempo AUX nunca amplía WS:
 * si supera el remanente (WS − TT − ACW) se recorta proporcionalmente y se
 * informa en diagnósticos. La ocupación NO se toca en ningún punto.
 */
export function computeTimeDistribution(
  records: SessionRecord[],
  recon: Pick<AuxReconciliation, "secondsByState" | "auxSeconds">,
  macros: MacroCategory[],
  mapping: AuxMapping,
): TimeDistribution {
  const sum = (pick: (r: SessionRecord) => number) => records.reduce((a, r) => a + pick(r), 0);
  const sessionSeconds = sum((r) => r.sessionSeconds);
  const conversationSeconds = Math.min(sum((r) => r.conversationSeconds), sessionSeconds);
  const acwSeconds = Math.min(sum((r) => r.acwSeconds), Math.max(0, sessionSeconds - conversationSeconds));

  const budget = Math.max(0, sessionSeconds - conversationSeconds - acwSeconds);
  const rawAux = recon.auxSeconds;
  const factor = rawAux > budget && rawAux > 0 ? budget / rawAux : 1;
  const auxSeconds = rawAux * factor;
  const auxTrimmedSeconds = rawAux - auxSeconds;

  const ordered = [...macros].sort((a, b) => a.order - b.order);
  const byMacro = new Map<string, number>();
  let unmappedSeconds = 0;
  recon.secondsByState.forEach((seconds, state) => {
    const macroId = mapping[state] ?? null;
    const macro = macroId ? ordered.find((m) => m.id === macroId) : null;
    if (!macro) unmappedSeconds += seconds * factor;
    else byMacro.set(macro.id, (byMacro.get(macro.id) ?? 0) + seconds * factor);
  });

  const classifiedSeconds = Math.min(
    sessionSeconds,
    conversationSeconds + acwSeconds + auxSeconds - unmappedSeconds,
  );
  const unclassifiedSeconds = Math.max(0, sessionSeconds - classifiedSeconds);
  const share = (seconds: number) => (sessionSeconds > 0 ? (seconds / sessionSeconds) * 100 : 0);

  const slices: DistributionSlice[] = [
    {
      key: SYSTEM_SLICES.work.key,
      name: SYSTEM_SLICES.work.name,
      kind: "work",
      tone: SYSTEM_SLICES.work.tone,
      seconds: conversationSeconds,
      percentage: share(conversationSeconds),
      info: SLICE_INFO.work,
    },
    {
      key: SYSTEM_SLICES.acw.key,
      name: SYSTEM_SLICES.acw.name,
      kind: "acw",
      tone: SYSTEM_SLICES.acw.tone,
      seconds: acwSeconds,
      percentage: share(acwSeconds),
      info: SLICE_INFO.acw,
    },
    ...ordered.map((macro) => {
      const seconds = byMacro.get(macro.id) ?? 0;
      return {
        key: macro.id,
        name: macro.name,
        kind: "aux" as const,
        tone: macro.tone,
        seconds,
        percentage: share(seconds),
        info: `Tiempo AUX asignado a estados configurados dentro de la categoría ${macro.name}.`,
      };
    }),
    {
      key: SYSTEM_SLICES.unclassified.key,
      name: SYSTEM_SLICES.unclassified.name,
      kind: "unclassified",
      tone: SYSTEM_SLICES.unclassified.tone,
      seconds: unclassifiedSeconds,
      percentage: share(unclassifiedSeconds),
      info: SLICE_INFO.unclassified,
    },
  ];

  return {
    sessionSeconds,
    conversationSeconds,
    acwSeconds,
    auxSeconds: auxSeconds - unmappedSeconds,
    classifiedSeconds,
    unclassifiedSeconds,
    coverage: sessionSeconds > 0 ? (classifiedSeconds / sessionSeconds) * 100 : null,
    slices,
    hasAux: rawAux > 0,
    auxTrimmedSeconds,
  };
}

/** Diagnósticos AUX (lenguaje neutro: calidad de datos, no rendimiento). */
export function buildAuxDiagnostics(args: {
  auxRecords: AuxRecord[];
  recon: AuxReconciliation;
  distribution: TimeDistribution;
  mapping: AuxMapping;
  macros: MacroCategory[];
  invalidRows: number;
  duplicateRows: number;
  knownStates: string[];
}): AuxDiagnostics {
  const { auxRecords, recon, distribution, mapping, macros, invalidRows, duplicateRows } = args;
  const inScope = auxRecords.filter((r) => recon.sessionKeys.has(auxKey(r.sessionId, r.agent)));
  const macroIds = new Set(macros.map((m) => m.id));
  const statesPresent = Array.from(new Set(auxRecords.map((r) => r.stateKey)));
  const unknownStates = statesPresent.filter((s) => !(s in mapping));
  const unmappedStates = statesPresent.filter((s) => {
    const macroId = mapping[s];
    return macroId === null || macroId === undefined || !macroIds.has(macroId);
  });

  return {
    rowsLoaded: auxRecords.length,
    matchedRows: inScope.length,
    unmatchedRows: auxRecords.length - inScope.length,
    duplicateRows,
    invalidRows,
    overlappingIntervals: recon.overlappingIntervals,
    clippedRecords: recon.clippedRecords,
    clippedSeconds: recon.clippedSeconds,
    outsideSessionRecords: recon.outsideSessionRecords,
    sessionsWithoutInterval: recon.sessionsWithoutInterval,
    exceedingSessions: distribution.auxTrimmedSeconds > 1 ? 1 : 0,
    deskMismatches: recon.deskMismatches,
    unknownStates,
    unmappedStates,
    agentsWithAux: recon.agentsWithAux.size,
    agentsWithoutAux: Array.from(recon.agentsWithoutAux).sort((a, b) => a.localeCompare(b, "es")),
    unclassifiedSeconds: distribution.unclassifiedSeconds,
  };
}
