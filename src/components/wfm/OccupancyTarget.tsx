import { useState } from "react";
import { AlertTriangle, ArrowDown, Check, Gauge, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TargetState = "below" | "on" | "above" | "unavailable";

const STATE_META: Record<
  Exclude<TargetState, "unavailable">,
  { label: string; reading: string; icon: typeof ArrowDown; text: string; accent: string }
> = {
  below: {
    label: "Por debajo del objetivo",
    reading: "Capacidad por encima del nivel objetivo",
    icon: ArrowDown,
    text: "text-status-low-foreground",
    accent: "border-l-status-low",
  },
  on: {
    label: "En objetivo",
    reading: "Dentro del rango objetivo",
    icon: Check,
    text: "text-status-balanced-foreground",
    accent: "border-l-status-balanced",
  },
  above: {
    label: "Por encima del objetivo",
    reading: "Posible sobrecarga",
    icon: AlertTriangle,
    text: "text-status-warning-foreground",
    accent: "border-l-status-warning",
  },
};

/** Estado respecto al objetivo con tolerancia en puntos porcentuales. */
export function targetState(
  actual: number | null,
  target: number,
  tolerance: number,
): TargetState {
  if (actual === null || !Number.isFinite(actual)) return "unavailable";
  if (actual < target - tolerance) return "below";
  if (actual > target + tolerance) return "above";
  return "on";
}

const fmt = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");

function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 items-center justify-center rounded-sm focus-visible:ring-1 focus-visible:outline-none"
          aria-label={`Información sobre ${label}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}
        >
          <Info className="pointer-events-none size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[300px]">
        <p className="leading-snug whitespace-pre-line">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const HELP = `Real = tiempo productivo agregado / tiempo de sesión agregado.
Objetivo = referencia WFM configurable en Configuración → Parámetros operativos.
Desviación = Real − Objetivo, en puntos porcentuales (pp).
Una desviación por debajo del objetivo indica que la capacidad se usa por debajo de la referencia configurada; por sí sola no demuestra sobredimensionamiento.
Una desviación por encima indica mayor utilización y puede señalar posible sobrecarga, pero debe interpretarse junto con volumen, nivel de servicio y contexto operativo.`;

/**
 * Comparativa Ocupación real vs objetivo con indicador horizontal de referencia.
 * La ocupación real llega ya calculada por la agregación de Operación.
 */
export function OccupancyTarget({
  actual,
  target,
  tolerance,
}: {
  actual: number | null;
  target: number;
  tolerance: number;
}) {
  const state = targetState(actual, target, tolerance);
  const meta = state === "unavailable" ? null : STATE_META[state];
  const Icon = meta?.icon ?? Gauge;
  const deviation = actual === null ? null : actual - target;

  // Escala común: 0–100 %, ampliada si la ocupación real supera el 100 %.
  const scaleMax = Math.max(100, actual ?? 0, target + tolerance);
  const pos = (value: number) => `${Math.max(0, Math.min(100, (value / scaleMax) * 100))}%`;

  return (
    <TooltipProvider>
      <section
        aria-label="Ocupación frente al objetivo"
        className={cn(
          "border-border bg-card shadow-card rounded-md border border-l-[3px] p-4",
          meta?.accent ?? "border-l-border",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-1.5">
            <div>
              <h3 className="text-[13px] font-semibold tracking-wide uppercase">
                Ocupación vs objetivo
              </h3>
              <p className="text-muted-foreground text-xs">
                Referencia WFM configurable, no un SLA contractual.
              </p>
            </div>
            <InfoTooltip text={HELP} label="ocupación frente al objetivo" />
          </div>

          <span
            className={cn(
              "border-border bg-card text-foreground inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium",
            )}
          >
            <Icon
              className={cn("size-3.5 shrink-0", meta?.text ?? "text-muted-foreground")}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            {meta ? meta.label : "Sin datos"}
          </span>
        </div>

        {state === "unavailable" ? (
          <p className="text-muted-foreground mt-4 text-xs">
            No hay datos operativos válidos para comparar con el objetivo. Importa un Excel de
            sesiones con tiempos de sesión mayores que cero.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
                  Ocupación real
                </p>
                <p className="mt-1 font-mono text-[22px] leading-none font-semibold tabular-nums">
                  {fmt(actual!)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
                  Objetivo
                </p>
                <p className="mt-1 font-mono text-[22px] leading-none font-semibold tabular-nums">
                  {fmt(target)}%
                </p>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Tolerancia ±{fmt(tolerance)} pp
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
                  Desviación
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-[22px] leading-none font-semibold tabular-nums",
                    meta?.text,
                  )}
                >
                  {deviation! >= 0 ? "+" : "−"}
                  {fmt(Math.abs(deviation!))} pp
                </p>
                <p className="text-muted-foreground mt-1 text-[10px]">{meta?.reading}</p>
              </div>
            </div>

            <div className="mt-4">
              <div
                className="bg-muted relative h-6 rounded-sm"
                role="img"
                aria-label={`Ocupación real ${fmt(actual!)} % frente a objetivo ${fmt(target)} % con tolerancia de ${fmt(tolerance)} puntos porcentuales. ${meta?.label}: ${meta?.reading}.`}
              >
                {/* Banda de tolerancia */}
                <div
                  className="bg-status-balanced/25 absolute inset-y-0"
                  style={{
                    left: pos(Math.max(0, target - tolerance)),
                    width: `calc(${pos(Math.min(scaleMax, target + tolerance))} - ${pos(Math.max(0, target - tolerance))})`,
                  }}
                />
                {/* Barra real */}
                <div
                  className={cn(
                    "absolute inset-y-1 left-0 rounded-sm opacity-80",
                    state === "below" && "bg-status-low",
                    state === "on" && "bg-status-balanced",
                    state === "above" && "bg-status-warning",
                  )}
                  style={{ width: pos(actual!) }}
                />
                {/* Marca del objetivo */}
                <div
                  className="bg-foreground absolute inset-y-0 w-[2px]"
                  style={{ left: pos(target) }}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[10px] tabular-nums">
                <span>0%</span>
                <span>Objetivo {fmt(target, 0)}%</span>
                <span>{fmt(scaleMax, 0)}%</span>
              </div>
            </div>
          </>
        )}
      </section>
    </TooltipProvider>
  );
}
