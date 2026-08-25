import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  DataQuality,
  ImportMeta,
  ImportSnapshot,
  LoadCategory,
  ParseIssue,
  ParseResult,
  SessionRecord,
  Shift,
} from "./types";
import * as history from "./history";
import { fullPeriod, normalizePeriod, type Period } from "./period";
import type { AuxIssue, AuxMapping, AuxParseResult, AuxRecord, MacroCategory } from "./aux-types";
import { DEFAULT_AUX_MAPPING, DEFAULT_MACRO_CATEGORIES } from "./aux-distribution";

/** Metadatos de la importación AUX activa (independiente del fichero de sesiones). */
export type AuxMeta = {
  fileName: string;
  importedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  dateFrom: string | null;
  dateTo: string | null;
  states: { key: string; raw: string; count: number }[];
};


const STORAGE_KEY = "wfm-config-v1";

export const DEFAULT_SHIFTS: Shift[] = [
  { id: "manana", name: "Mañana", start: "07:00", end: "15:00" },
  { id: "tarde", name: "Tarde", start: "15:00", end: "23:00" },
  { id: "noche", name: "Noche", start: "23:00", end: "07:00" },
];

export const DEFAULT_CATEGORIES: LoadCategory[] = [
  { id: "baja", name: "Baja", min: 0, max: 55, status: "low", order: 1 },
  {
    id: "moderadamente-baja",
    name: "Moderadamente baja",
    min: 55.01,
    max: 59.99,
    status: "moderate-low",
    order: 2,
  },
  { id: "equilibrada", name: "Equilibrada", min: 60, max: 75, status: "balanced", order: 3 },
  { id: "alta", name: "Alta", min: 75.01, max: 85, status: "high", order: 4 },
  { id: "muy-alta", name: "Muy alta", min: 85.01, max: 90, status: "very-high", order: 5 },
  { id: "critica", name: "Crítica", min: 90.01, max: 100, status: "critical", order: 6 },
];

export const DEFAULT_EXPECTED_ADJUSTMENT = 0;

/** Objetivo de ocupación (referencia WFM configurable, no un SLA). */
export const DEFAULT_OCCUPANCY_TARGET = 70;
/** Tolerancia en puntos porcentuales alrededor del objetivo. */
export const DEFAULT_OCCUPANCY_TOLERANCE = 5;
export const MAX_OCCUPANCY_TOLERANCE = 50;

const CATEGORIES_VERSION = 2;

type Config = {
  /** Versión del set de categorías, para migrar umbrales antiguos guardados. */
  categoriesVersion?: number;
  shifts: Shift[];
  categories: LoadCategory[];
  assignments: Record<string, string | null>;
  /** Ajuste % (positivo o negativo) sobre las horas esperadas. */
  expectedAdjustmentPercent: number;
  /** Objetivo global de ocupación en %. */
  occupancyTargetPercent: number;
  /** Tolerancia ± en puntos porcentuales. */
  occupancyTolerancePoints: number;
  /** Macro-categorías configurables para los estados AUX. */
  macroCategories: MacroCategory[];
  /** Mapeo estado AUX (clave normalizada) → macro-categoría. */
  auxMapping: AuxMapping;
};


type WfmContextValue = Config & {
  records: SessionRecord[];

  dates: string[];
  importedAt: Date | null;
  issues: ParseIssue[];
  quality: DataQuality | null;
  activeMeta: ImportMeta | null;
  latestImportId: string | null;
  /** Período operativo seleccionado (from === to para un solo día). */
  period: Period | null;
  setPeriod: (period: Period | null) => void;
  viewingHistorical: boolean;
  historyList: ImportMeta[];
  setShifts: (shifts: Shift[]) => void;
  setCategories: (categories: LoadCategory[]) => void;
  setExpectedAdjustmentPercent: (percent: number) => void;
  setOccupancyTargetPercent: (percent: number) => void;
  setOccupancyTolerancePoints: (points: number) => void;
  assignShift: (agent: string, shiftId: string | null) => void;
  applyImport: (result: ParseResult) => void;
  clearData: () => void;
  viewImport: (id: string) => boolean;
  backToLatest: () => void;
  removeImport: (id: string) => void;
  clearHistory: () => void;
  loadSnapshot: (id: string) => ImportSnapshot | null;
};

const WfmContext = createContext<WfmContextValue | null>(null);

/** Objetivo válido: 0–100 %. Valores ausentes o corruptos vuelven al 70 % por defecto. */
function sanitizeTarget(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_OCCUPANCY_TARGET;
  return n;
}

/** Tolerancia válida: 0–50 pp. */
function sanitizeTolerance(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_OCCUPANCY_TOLERANCE) return DEFAULT_OCCUPANCY_TOLERANCE;
  return n;
}

function loadConfig(): Config {
  const fallback: Config = {
    shifts: DEFAULT_SHIFTS,
    categories: DEFAULT_CATEGORIES,
    assignments: {},
    expectedAdjustmentPercent: DEFAULT_EXPECTED_ADJUSTMENT,
    occupancyTargetPercent: DEFAULT_OCCUPANCY_TARGET,
    occupancyTolerancePoints: DEFAULT_OCCUPANCY_TOLERANCE,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      shifts: parsed.shifts?.length ? parsed.shifts : DEFAULT_SHIFTS,
      categoriesVersion: CATEGORIES_VERSION,
      categories:
        parsed.categoriesVersion === CATEGORIES_VERSION && parsed.categories?.length
          ? parsed.categories
          : DEFAULT_CATEGORIES,
      assignments: parsed.assignments ?? {},
      expectedAdjustmentPercent: Number.isFinite(parsed.expectedAdjustmentPercent)
        ? Number(parsed.expectedAdjustmentPercent)
        : DEFAULT_EXPECTED_ADJUSTMENT,
      occupancyTargetPercent: sanitizeTarget(parsed.occupancyTargetPercent),
      occupancyTolerancePoints: sanitizeTolerance(parsed.occupancyTolerancePoints),
    };
  } catch {
    return fallback;
  }
}

export function WfmProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>({
    shifts: DEFAULT_SHIFTS,
    categories: DEFAULT_CATEGORIES,
    assignments: {},
    expectedAdjustmentPercent: DEFAULT_EXPECTED_ADJUSTMENT,
    occupancyTargetPercent: DEFAULT_OCCUPANCY_TARGET,
    occupancyTolerancePoints: DEFAULT_OCCUPANCY_TOLERANCE,
  });
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [importedAt, setImportedAt] = useState<Date | null>(null);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [activeMeta, setActiveMeta] = useState<ImportMeta | null>(null);
  const [latestImportId, setLatestImportId] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ImportMeta[]>([]);
  const [period, setPeriodState] = useState<Period | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setHistoryList(history.listHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, hydrated]);

  const applySnapshot = useCallback((snapshot: ImportSnapshot) => {
    setRecords(snapshot.records);
    setDates(snapshot.dates);
    setIssues(snapshot.issues);
    setQuality(snapshot.quality);
    setActiveMeta(snapshot.meta);
    setImportedAt(new Date(snapshot.meta.importedAt));
    // Al cambiar de dataset el período vuelve al rango completo disponible.
    setPeriodState(fullPeriod(snapshot.dates));
  }, []);

  const applyImport = useCallback(
    (result: ParseResult) => {
      // Replace active dataset only; shifts and load categories are preserved.
      const importedDate = new Date();
      const id = `${importedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
      const snapshot: ImportSnapshot = {
        meta: history.buildMeta(result, id, importedDate),
        records: result.records,
        issues: result.issues,
        quality: result.quality,
        dates: result.dates,
      };
      applySnapshot(snapshot);
      setLatestImportId(id);
      setHistoryList(history.saveSnapshot(snapshot));
    },
    [applySnapshot],
  );

  const value = useMemo<WfmContextValue>(
    () => ({
      ...config,
      records,
      dates,
      importedAt,
      issues,
      quality,
      activeMeta,
      latestImportId,
      period,
      setPeriod: (next) => setPeriodState(next ? normalizePeriod(next) : null),
      viewingHistorical: Boolean(activeMeta && latestImportId && activeMeta.id !== latestImportId),
      historyList,
      setShifts: (shifts) => setConfig((c) => ({ ...c, shifts })),
      setCategories: (categories) => setConfig((c) => ({ ...c, categories })),
      setExpectedAdjustmentPercent: (percent) =>
        setConfig((c) => ({ ...c, expectedAdjustmentPercent: percent })),
      setOccupancyTargetPercent: (percent) =>
        setConfig((c) => ({ ...c, occupancyTargetPercent: sanitizeTarget(percent) })),
      setOccupancyTolerancePoints: (points) =>
        setConfig((c) => ({ ...c, occupancyTolerancePoints: sanitizeTolerance(points) })),
      assignShift: (agent, shiftId) =>
        setConfig((c) => ({ ...c, assignments: { ...c.assignments, [agent]: shiftId } })),
      applyImport,
      clearData: () => {
        setRecords([]);
        setDates([]);
        setImportedAt(null);
        setIssues([]);
        setQuality(null);
        setActiveMeta(null);
        setLatestImportId(null);
        setPeriodState(null);
      },
      viewImport: (id) => {
        const snapshot = history.getSnapshot(id);
        if (!snapshot || !snapshot.records.length) return false;
        if (!latestImportId) setLatestImportId(activeMeta?.id ?? id);
        applySnapshot(snapshot);
        return true;
      },
      backToLatest: () => {
        if (!latestImportId) return;
        const snapshot = history.getSnapshot(latestImportId);
        if (snapshot) applySnapshot(snapshot);
      },
      removeImport: (id) => setHistoryList(history.deleteSnapshot(id)),
      clearHistory: () => setHistoryList(history.clearHistory()),
      loadSnapshot: (id) => history.getSnapshot(id),
    }),
    [
      config,
      records,
      dates,
      importedAt,
      issues,
      quality,
      activeMeta,
      latestImportId,
      historyList,
      period,
      applyImport,
      applySnapshot,
    ],
  );

  return <WfmContext.Provider value={value}>{children}</WfmContext.Provider>;
}

export function useWfm(): WfmContextValue {
  const ctx = useContext(WfmContext);
  if (!ctx) throw new Error("useWfm must be used inside WfmProvider");
  return ctx;
}
