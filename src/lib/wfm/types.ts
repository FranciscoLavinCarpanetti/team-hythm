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

export type ParseWarning = { row: number; message: string };

export type ParseResult = {
  records: SessionRecord[];
  warnings: ParseWarning[];
  duplicatesRemoved: number;
  dates: string[];
};

export type Shift = {
  id: string;
  name: string;
  start: string; // HH:MM
  end: string; // HH:MM
};

export type CategoryStatus = "low" | "balanced" | "high";

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
};
