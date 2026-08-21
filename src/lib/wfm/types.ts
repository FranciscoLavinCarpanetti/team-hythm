export type SessionRecord = {
  sessionId: string;
  agent: string;
  desk: string;
  start: Date | null;
  end: Date | null;
  /** operational date, yyyy-MM-dd, derived from start (fallback end) */
  operationalDate: string | null;
  sessionSeconds: number;
  calls: number;
  conversationSeconds: number;
  acwSeconds: number;
  productiveSeconds: number;
};

export type IssueKind =
  | "missing-key"
  | "invalid-duration"
  | "invalid-calls"
  | "invalid-dates"
  | "duplicate"
  | "zero-calls"
  | "productive-exceeds-session";

export type IssueSeverity = "error" | "warning";

export type ParseIssue = {
  row: number;
  sessionId: string | null;
  agent: string | null;
  kind: IssueKind;
  severity: IssueSeverity;
  message: string;
  /** Día operativo de la fila (yyyy-MM-dd) o null si no se pudo determinar. */
  operationalDate: string | null;
};


export type DataQuality = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  agents: number;
  zeroCallSessions: number;
  anomalousSessions: number;
};

export type ParseResult = {
  records: SessionRecord[];
  issues: ParseIssue[];
  duplicatesRemoved: number;
  dates: string[];
  quality: DataQuality;
  fileName: string;
};

export type Shift = {
  id: string;
  name: string;
  start: string; // HH:MM
  end: string; // HH:MM
};

export type CategoryStatus =
  | "low"
  | "moderate-low"
  | "balanced"
  | "high"
  | "very-high"
  | "critical";

export type LoadCategory = {
  id: string;
  name: string;
  min: number; // inclusive
  max: number; // inclusive
  status: CategoryStatus;
  order: number;
};

export type AgentMetrics = {
  agent: string;
  shiftId: string | null;
  shiftName: string;
  shiftBreakdown: { shiftId: string | null; shiftName: string; days: number; percentage: number }[];
  sessions: number;
  calls: number;
  conversationSeconds: number;
  acwSeconds: number;
  productiveSeconds: number;
  sessionSeconds: number;
  workedDays: number;
  expectedActiveSeconds: number;
  idleSeconds: number;
  occupancy: number | null;
  category: LoadCategory | null;
  records: SessionRecord[];
};

export type Kpis = {
  agents: number;
  sessions: number;
  calls: number;
  productiveSeconds: number;
  sessionSeconds: number;
  expectedActiveSeconds: number;
  idleSeconds: number;
  avgOccupancy: number | null;
  low: number;
  balanced: number;
  high: number;
  withoutShift: number;
};

/** Metadata persisted for every import (history). */
export type ImportMeta = {
  id: string;
  fileName: string;
  importedAt: string; // ISO
  rowCount: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  agents: number;
  dateFrom: string | null;
  dateTo: string | null;
  hasRecords: boolean;
};

export type ImportSnapshot = {
  meta: ImportMeta;
  records: SessionRecord[];
  issues: ParseIssue[];
  quality: DataQuality;
  dates: string[];
};
