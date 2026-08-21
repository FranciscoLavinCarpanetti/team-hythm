import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateKey } from "@/lib/wfm/time";
import {
  PERIOD_PRESETS,
  PRESET_LABELS,
  detectPreset,
  normalizePeriod,
  periodDates,
  periodLabel,
  presetPeriod,
  type Period,
  type PeriodPresetId,
} from "@/lib/wfm/period";

/**
 * Selector de período a nivel de dashboard: afecta a Operación y Agentes.
 * Un solo día se selecciona como `from === to`, sin ruta de cálculo aparte.
 */
export function PeriodPicker({
  dates,
  period,
  onChange,
}: {
  dates: string[];
  period: Period | null;
  onChange: (period: Period) => void;
}) {
  if (!dates.length || !period) return null;

  const normalized = normalizePeriod(period);
  const preset = detectPreset(normalized, dates);
  const availableDays = periodDates(dates, normalized).length;
  const singleDate = dates.length === 1;

  const handlePreset = (value: string) => {
    const next = presetPeriod(value as PeriodPresetId, dates);
    if (next) onChange(next);
  };

  return (
    <section
      aria-label="Período de análisis"
      className="border-border bg-card shadow-card flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="bg-secondary text-primary flex size-8 shrink-0 items-center justify-center rounded-sm"
          aria-hidden="true"
        >
          <CalendarRange className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            Período de análisis
          </p>
          <p className="truncate text-sm font-semibold">{periodLabel(normalized)}</p>
          <p className="text-muted-foreground text-[11px]">
            {availableDays} día(s) operativo(s) con datos · {PRESET_LABELS[preset]}
          </p>
        </div>
      </div>

      {!singleDate && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={preset === "custom" ? "custom" : preset} onValueChange={handlePreset}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Preset de período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
              {preset === "custom" && (
                <SelectItem value="custom" disabled>
                  Personalizado
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              value={normalized.from}
              onValueChange={(value) => onChange(normalizePeriod({ ...normalized, from: value }))}
            >
              <SelectTrigger className="w-full sm:w-[140px]" aria-label="Fecha inicial">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatDateKey(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={normalized.to}
              onValueChange={(value) => onChange(normalizePeriod({ ...normalized, to: value }))}
            >
              <SelectTrigger className="w-full sm:w-[140px]" aria-label="Fecha final">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatDateKey(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </section>
  );
}
