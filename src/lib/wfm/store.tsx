import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LoadCategory, ParseResult, SessionRecord, Shift } from "./types";

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
  setShifts: (shifts: Shift[]) => void;
  setCategories: (categories: LoadCategory[]) => void;
  assignShift: (agent: string, shiftId: string | null) => void;
  applyImport: (result: ParseResult) => void;
  clearData: () => void;
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, hydrated]);

  const applyImport = useCallback((result: ParseResult) => {
    // Replace dataset only; agent shift assignments and config are preserved.
    setRecords(result.records);
    setDates(result.dates);
    setImportedAt(new Date());
  }, []);

  const value = useMemo<WfmContextValue>(
    () => ({
      ...config,
      records,
      dates,
      importedAt,
      setShifts: (shifts) => setConfig((c) => ({ ...c, shifts })),
      setCategories: (categories) => setConfig((c) => ({ ...c, categories })),
      assignShift: (agent, shiftId) =>
        setConfig((c) => ({ ...c, assignments: { ...c.assignments, [agent]: shiftId } })),
      applyImport,
      clearData: () => {
        setRecords([]);
        setDates([]);
        setImportedAt(null);
      },
    }),
    [config, records, dates, importedAt, applyImport],
  );

  return <WfmContext.Provider value={value}>{children}</WfmContext.Provider>;
}

export function useWfm(): WfmContextValue {
  const ctx = useContext(WfmContext);
  if (!ctx) throw new Error("useWfm must be used inside WfmProvider");
  return ctx;
}
