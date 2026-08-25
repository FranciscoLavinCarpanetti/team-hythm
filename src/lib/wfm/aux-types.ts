/**
 * Capa de análisis AUX (estados de agente). Es una capa ADICIONAL: no altera
 * la ocupación ni las reglas de horas esperadas / tiempo inactivo.
 */

/** Registro AUX normalizado (una fila válida del Excel de estados). */
export type AuxRecord = {
  row: number;
  sessionId: string;
  agent: string;
  desk: string;
  /** Estado tal y como viene en el fichero, p. ej. «Descanso (30')». */
  rawState: string;
  /** Clave normalizada del estado, p. ej. «descanso». */
  stateKey: string;
  start: Date;
  end: Date;
  /** TAUX declarado en el fichero, en segundos. */
  tauxSeconds: number;
};

export type AuxIssueKind =
  | "missing-key"
  | "invalid-state"
  | "invalid-dates"
  | "invalid-duration"
  | "duplicate";

export type AuxIssue = {
  row: number;
  sessionId: string | null;
  agent: string | null;
  state: string | null;
  kind: AuxIssueKind;
  severity: "error" | "warning";
  message: string;
  operationalDate: string | null;
};

export type AuxParseResult = {
  records: AuxRecord[];
  issues: AuxIssue[];
  duplicatesRemoved: number;
  /** Estados brutos distintos presentes en el fichero. */
  states: { key: string; raw: string; count: number }[];
  dates: string[];
  fileName: string;
  totalRows: number;
};

/** Macro-categoría configurable a la que se asignan los estados AUX. */
export type MacroCategory = {
  id: string;
  name: string;
  order: number;
  /** Tratamiento visual dentro del sistema de diseño (no semántica de negocio). */
  tone: MacroTone;
};

export type MacroTone =
  | "primary"
  | "accent"
  | "secondary"
  | "neutral"
  | "low"
  | "balanced"
  | "high";

/** Asignación estado AUX (clave normalizada) → macro-categoría. */
export type AuxMapping = Record<string, string | null>;

export type DistributionKind = "work" | "acw" | "aux" | "unclassified";

export type DistributionSlice = {
  key: string;
  name: string;
  kind: DistributionKind;
  tone: MacroTone;
  seconds: number;
  /** seconds / WS × 100 */
  percentage: number;
  info: string;
};

/** Distribución del tiempo de sesión (WS = 100%). */
export type TimeDistribution = {
  sessionSeconds: number;
  conversationSeconds: number;
  acwSeconds: number;
  auxSeconds: number;
  classifiedSeconds: number;
  unclassifiedSeconds: number;
  /** classified / WS × 100 */
  coverage: number | null;
  slices: DistributionSlice[];
  /** true cuando al menos un registro AUX se ha emparejado con estas sesiones. */
  hasAux: boolean;
  /** Segundos AUX recortados por precedencia conversación/ACW (sin doble conteo). */
  auxTrimmedSeconds: number;
};

export type AuxDiagnostics = {
  rowsLoaded: number;
  matchedRows: number;
  unmatchedRows: number;
  duplicateRows: number;
  invalidRows: number;
  overlappingIntervals: number;
  clippedRecords: number;
  clippedSeconds: number;
  outsideSessionRecords: number;
  sessionsWithoutInterval: number;
  exceedingSessions: number;
  deskMismatches: number;
  unknownStates: string[];
  unmappedStates: string[];
  agentsWithAux: number;
  agentsWithoutAux: string[];
  unclassifiedSeconds: number;
};
