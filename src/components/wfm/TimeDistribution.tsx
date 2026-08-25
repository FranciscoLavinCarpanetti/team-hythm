import { useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MacroTone, TimeDistribution as Distribution } from "@/lib/wfm/aux-types";
import { formatSeconds } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

/** Tratamiento visual plano por tono (sin indicadores circulares ni gráficos de tarta). */
const TONE_BAR: Record<MacroTone, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary-brand",
  accent: "bg-accent",
  low: "bg-status-low",
  balanced: "bg-status-balanced",
  high: "bg-status-high",
  neutral: "bg-muted-foreground/35",
};

export const TONE_OPTIONS: { value: MacroTone; label: string }[] = [
  { value: "accent", label: "Énfasis" },
  { value: "secondary", label: "Secundario" },
  { value: "low", label: "Azul" },
  { value: "balanced", label: "Verde" },
  { value: "high", label: "Naranja" },
  { value: "primary", label: "Primario" },
  { value: "neutral", label: "Neutro" },
];

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

function SliceInfo({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Información sobre ${label}`}
          className="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center rounded-sm"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}
        >
          <Info className="pointer-events-none size-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[260px]">
        <p className="leading-snug">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function StackedTimeBar({ distribution }: { distribution: Distribution }) {
  const slices = distribution.slices.filter((s) => s.percentage > 0);
  return (
    <div
      className="border-border bg-surface flex h-6 w-full overflow-hidden rounded-sm border"
      role="img"
      aria-label={`Distribución del tiempo de sesión: ${slices
        .map((s) => `${s.name} ${pct(s.percentage)}`)
        .join(", ")}`}
    >
      {slices.map((slice) => (
        <div
          key={slice.key}
          className={cn("h-full", TONE_BAR[slice.tone])}
          style={{ width: `${slice.percentage}%` }}
          title={`${slice.name}: ${pct(slice.percentage)} · ${formatSeconds(slice.seconds)}`}
        />
      ))}
    </div>
  );
}

/**
 * «Distribución del tiempo»: clasificación del tiempo de sesión (WS = 100 %).
 * No sustituye ni reinterpreta la ocupación, que mantiene su propio cálculo.
 */
export function TimeDistributionView({
  distribution,
  auxLoaded,
  compact = false,
  emptyHint,
}: {
  distribution: Distribution;
  auxLoaded: boolean;
  compact?: boolean;
  emptyHint?: string;
}) {
  const noAux = !auxLoaded || !distribution.hasAux;
  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
              Tiempo de sesión (WS)
            </p>
            <p className="font-mono text-xl leading-none font-semibold tabular-nums">
              {formatSeconds(distribution.sessionSeconds)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">100 % · base del reparto</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
              Cobertura de estados
            </p>
            <p className="font-mono text-xl leading-none font-semibold tabular-nums">
              {noAux || distribution.coverage === null ? "Sin datos" : pct(distribution.coverage)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Sin clasificar: {formatSeconds(distribution.unclassifiedSeconds)}
              {distribution.sessionSeconds > 0 &&
                ` — ${pct((distribution.unclassifiedSeconds / distribution.sessionSeconds) * 100)}`}
            </p>
          </div>
        </div>

        <StackedTimeBar distribution={distribution} />

        <ul className={cn("grid gap-1", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
          {distribution.slices.map((slice) => (
            <li
              key={slice.key}
              className="border-border/70 flex items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-xs"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("h-3 w-1 shrink-0 rounded-[1px]", TONE_BAR[slice.tone])}
                />
                <span className="truncate">{slice.name}</span>
                <SliceInfo text={slice.info} label={slice.name} />
              </span>
              <span className="font-mono tabular-nums whitespace-nowrap">
                {pct(slice.percentage)} · {formatSeconds(slice.seconds)}
              </span>
            </li>
          ))}
        </ul>

        {noAux && (
          <p className="border-border bg-surface text-muted-foreground rounded-sm border border-dashed px-3 py-2 text-xs">
            {emptyHint ??
              "No se han emparejado registros AUX con estas sesiones. El tiempo sin clasificar no indica inactividad: indica cobertura AUX incompleta."}
          </p>
        )}
        {distribution.auxTrimmedSeconds > 1 && (
          <p className="text-muted-foreground text-xs">
            Se han recortado {formatSeconds(distribution.auxTrimmedSeconds)} de tiempo AUX por
            precedencia de conversación y ACW, para que la suma nunca supere el tiempo de sesión.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
