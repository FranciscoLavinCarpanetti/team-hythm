import { CalendarClock } from "lucide-react";
import type { DailyExceptions as DailyExceptionsData, DailyMetrics } from "@/lib/wfm/analysis";
import { formatDateKey, formatSeconds } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

function dayTone(day: DailyMetrics, target: number, tolerance: number): string {
  if (day.occupancy === null) return "text-muted-foreground";
  if (day.occupancy > target + tolerance) return "text-status-warning-foreground";
  if (day.occupancy < target - tolerance) return "text-status-low-foreground";
  return "text-status-balanced-foreground";
}

/**
 * Excepciones diarias del período: complementan el KPI agregado para que un
 * período equilibrado no oculte un día concreto fuera del objetivo.
 */
export function DailyExceptions({
  data,
  target,
  tolerance,
}: {
  data: DailyExceptionsData;
  target: number;
  tolerance: number;
}) {
  if (data.days.length < 2) return null;
  const fmtTarget = target.toFixed(1).replace(".", ",");
  const fmtTolerance = tolerance.toFixed(1).replace(".", ",");

  return (
    <section
      aria-label="Excepciones diarias del período"
      className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide uppercase">
          <CalendarClock className="size-4" aria-hidden="true" />
          Excepciones diarias
        </h2>
        <p className="text-muted-foreground text-xs">
          Objetivo {fmtTarget}% · tolerancia ±{fmtTolerance} pp · ocupación de cada día calculada
          con duraciones sumadas de ese día
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border-border/70 rounded-sm border px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
            Días analizados
          </p>
          <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">
            {data.days.length}
          </p>
        </div>
        <div className="border-border/70 rounded-sm border px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
            Por encima del objetivo
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-base leading-none font-semibold tabular-nums",
              data.above.length > 0 && "text-status-warning-foreground",
            )}
          >
            {data.above.length}
          </p>
        </div>
        <div className="border-border/70 rounded-sm border px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
            Por debajo del objetivo
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-base leading-none font-semibold tabular-nums",
              data.below.length > 0 && "text-status-low-foreground",
            )}
          >
            {data.below.length}
          </p>
        </div>
        <div className="border-border/70 rounded-sm border px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
            Mayor desviación
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-base leading-none font-semibold tabular-nums",
              data.worst ? dayTone(data.worst, target, tolerance) : undefined,
            )}
          >
            {data.worst ? pct(data.worst.occupancy) : "—"}
          </p>
          {data.worst && (
            <p className="text-muted-foreground mt-1 text-[10px]">
              {formatDateKey(data.worst.date)}
            </p>
          )}
        </div>
      </div>

      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              {[
                "Día operativo",
                "Agentes",
                "Sesiones",
                "Llamadas",
                "T. Productivo",
                "T. Sesión",
                "% Ocupación",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border-border/60 border-b px-2 py-1.5 text-left font-semibold"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.days.map((day) => (
              <tr key={day.date} className="border-border/60 border-b last:border-0">
                <td className="px-2 py-1.5 font-mono tabular-nums">{formatDateKey(day.date)}</td>
                <td className="px-2 py-1.5 font-mono tabular-nums">{day.agents}</td>
                <td className="px-2 py-1.5 font-mono tabular-nums">{day.sessions}</td>
                <td className="px-2 py-1.5 font-mono tabular-nums">
                  {day.calls.toLocaleString("es-ES")}
                </td>
                <td className="px-2 py-1.5 font-mono tabular-nums">
                  {formatSeconds(day.productiveSeconds)}
                </td>
                <td className="px-2 py-1.5 font-mono tabular-nums">
                  {formatSeconds(day.sessionSeconds)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 font-mono font-semibold tabular-nums",
                    dayTone(day, target, tolerance),
                  )}
                >
                  {pct(day.occupancy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        La ocupación del período no es la media de estas ocupaciones diarias: se calcula con el
        tiempo productivo y el tiempo de sesión agregados de todo el período.
      </p>
    </section>
  );
}
