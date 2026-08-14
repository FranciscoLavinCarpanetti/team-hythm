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

const STORAGE_KEY = "wfm-config-v1";

export const DEFAULT_SHIFTS: Shift[] = [
  { id: "manana", name: "Mañana", start: "07:00", end: "15:00" },
  { id: "tarde", name: "Tarde", start: "15:00", end: "23:00" },
  { id: "noche", name: "Noche", start: "23:00", end: "07:00" },
];

export const DEFAULT_CATEGORIES: LoadCategory[] = [
  { id: "baja", name: "Baja", min: 0, max: 29.9, status: "low", order: 1 },
  { id: "equilibrada", name: "Equilibrada", min: 30, max: 60, status: "balanced", order: 2 },
  { id: "alta", name: "Alta", min: 60.1, max: 100, status: "high", order: 3 },
];

type Config = {
  shifts: Shift[];
  categories: LoadCategory[];
  assignments: Record<string, string | null>;
};

type WfmContextValue = Config & {
  records: SessionRecord[];
  dates: string[];
  importedAt: Date | null;
  issues: ParseIssue[];
  quality: DataQuality | null;
  activeMeta: ImportMeta | null;
  latestImportId: string | null;
  viewingHistorical: boolean;
  historyList: ImportMeta[];
  setShifts: (shifts: Shift[]) => void;
  setCategories: (categories: LoadCategory[]) => void;
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

function loadConfig(): Config {
  const fallback: Config = {
    shifts: DEFAULT_SHIFTS,
    categories: DEFAULT_CATEGORIES,
    assignments: {},
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      shifts: parsed.shifts?.length ? parsed.shifts : DEFAULT_SHIFTS,
      categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
      assignments: parsed.assignments ?? {},
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
  });
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [importedAt, setImportedAt] = useState<Date | null>(null);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [activeMeta, setActiveMeta] = useState<ImportMeta | null>(null);
  const [latestImportId, setLatestImportId] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<ImportMeta[]>([]);
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
      viewingHistorical: Boolean(activeMeta && latestImportId && activeMeta.id !== latestImportId),
      historyList,
      setShifts: (shifts) => setConfig((c) => ({ ...c, shifts })),
      setCategories: (categories) => setConfig((c) => ({ ...c, categories })),
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
