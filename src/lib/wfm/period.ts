import type { SessionRecord } from "./types";
import { formatDateKey } from "./time";

/** Período operativo normalizado, en claves `yyyy-MM-dd` de día operativo. */
export type Period = { from: string; to: string };

export type PeriodPresetId =
  | "last-day"
  | "last-3"
  | "last-7"
  | "this-month"
  | "all"
  | "custom";

export const PERIOD_PRESETS: { id: Exclude<PeriodPresetId, "custom">; label: string }[] = [
  { id: "all", label: "Todo el período" },
  { id: "last-day", label: "Último día" },
  { id: "last-3", label: "Últimos 3 días" },
  { id: "last-7", label: "Últimos 7 días" },
  { id: "this-month", label: "Este mes" },
];

export const PRESET_LABELS: Record<PeriodPresetId, string> = {
  all: "Todo el período",
  "last-day": "Último día",
  "last-3": "Últimos 3 días",
  "last-7": "Últimos 7 días",
  "this-month": "Este mes",
  custom: "Personalizado",
};

/** Ordena los extremos si llegan invertidos; nunca devuelve un rango inválido. */
export function normalizePeriod(period: Period): Period {
  return period.from <= period.to
    ? { from: period.from, to: period.to }
    : { from: period.to, to: period.from };
}

export function isSingleDay(period: Period | null): boolean {
  return Boolean(period && period.from === period.to);
}

/**
 * Filtro único del pipeline: compara SIEMPRE `operationalDate` (día operativo
 * derivado del inicio de la sesión), nunca `start`/`end` crudos, para que las
 * sesiones que cruzan medianoche no se partan entre días naturales.
 */
export function filterByPeriod(records: SessionRecord[], period: Period | null): SessionRecord[] {
  if (!period) return records;
  const { from, to } = normalizePeriod(period);
  return records.filter(
    (record) =>
      record.operationalDate !== null &&
      record.operationalDate >= from &&
      record.operationalDate <= to,
  );
}

/** Fechas del dataset (ya ordenadas) contenidas en el período. */
export function periodDates(dates: string[], period: Period | null): string[] {
  if (!period) return dates;
  const { from, to } = normalizePeriod(period);
  return dates.filter((date) => date >= from && date <= to);
}

/** Período por defecto tras una importación: todo el rango disponible. */
export function fullPeriod(dates: string[]): Period | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0]!, to: sorted[sorted.length - 1]! };
}

/** Presets calculados sobre las fechas realmente presentes en el dataset. */
export function presetPeriod(preset: PeriodPresetId, dates: string[]): Period | null {
  const sorted = [...dates].sort();
  if (!sorted.length) return null;
  const last = sorted[sorted.length - 1]!;
  const takeLast = (n: number): Period => {
    const slice = sorted.slice(Math.max(0, sorted.length - n));
    return { from: slice[0]!, to: last };
  };
  switch (preset) {
    case "all":
      return { from: sorted[0]!, to: last };
    case "last-day":
      return { from: last, to: last };
    case "last-3":
      return takeLast(3);
    case "last-7":
      return takeLast(7);
    case "this-month": {
      const month = last.slice(0, 7);
      const inMonth = sorted.filter((d) => d.startsWith(month));
      return { from: inMonth[0]!, to: inMonth[inMonth.length - 1]! };
    }
    default:
      return null;
  }
}

/** Preset equivalente al período actual, o "custom" si no coincide con ninguno. */
export function detectPreset(period: Period | null, dates: string[]): PeriodPresetId {
  if (!period) return "custom";
  const normalized = normalizePeriod(period);
  for (const preset of PERIOD_PRESETS) {
    const candidate = presetPeriod(preset.id, dates);
    if (candidate && candidate.from === normalized.from && candidate.to === normalized.to) {
      return preset.id;
    }
  }
  return "custom";
}

export function periodLabel(period: Period | null): string {
  if (!period) return "Sin fechas";
  const { from, to } = normalizePeriod(period);
  return from === to ? formatDateKey(from) : `${formatDateKey(from)} – ${formatDateKey(to)}`;
}

/** Sufijo para nombres de archivo exportados: `2026-08-01_2026-08-07`. */
export function periodFileSuffix(period: Period | null): string {
  if (!period) return "global";
  const { from, to } = normalizePeriod(period);
  return from === to ? from : `${from}_${to}`;
}
