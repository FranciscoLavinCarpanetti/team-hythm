import { Moon, Sunrise, Sunset } from "lucide-react";
import type { ShiftMetrics } from "@/lib/wfm/analysis";
import { formatSeconds } from "@/lib/wfm/time";
import { statusBarClass } from "./LoadDistribution";
import { cn } from "@/lib/utils";

function shiftIcon(shift: ShiftMetrics) {
  if (shift.crossesMidnight) {
    return {
      Icon: Moon,
      label: "Turno nocturno",
      className: "text-primary",
    };
  }
  const startHour = shift.schedule ? Number(shift.schedule.split(":")[0]) : null;
  if (startHour !== null && startHour < 12) {
    return {
      Icon: Sunrise,
      label: "Turno de mañana",
      className: "text-secondary-brand",
    };
  }
  return {
    Icon: Sunset,
    label: "Turno de tarde",
    className: "text-secondary-brand",
  };
}



export function ShiftAnalysis({ shifts }: { shifts: ShiftMetrics[] }) {
  return (
    <section
      className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
      aria-label="Análisis por turno"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">Análisis por turno</h2>
        <p className="text-muted-foreground text-xs">Ocupación agregada por duraciones</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-border border-b text-[10px] tracking-[0.1em] uppercase">
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                Turno
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Agentes
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Sesiones
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Llamadas
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                T. Productivo
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Ocupación
              </th>
              <th scope="col" className="min-w-[180px] px-2 py-2 text-left font-semibold">
                Distribución de carga
              </th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr
                key={shift.shiftId ?? "none"}
                className="border-border/60 odd:bg-surface/60 border-b last:border-0"
              >
                <td className="px-2 py-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    {shift.shiftName}
                    {(() => {
                      if (shift.shiftId === null) return null;
                      const { Icon, label, className } = shiftIcon(shift);
                      return (
                        <Icon
                          className={cn("size-[18px] shrink-0", className)}
                          strokeWidth={2.25}

                          aria-label={label}
                        />
                      );
                    })()}
                  </span>
                  {shift.schedule && (
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {shift.schedule}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{shift.agents}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{shift.sessions}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">
                  {shift.calls.toLocaleString("es-ES")}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">
                  {formatSeconds(shift.productiveSeconds)}
                </td>
                <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums">
                  {shift.occupancy === null
                    ? "—"
                    : `${shift.occupancy.toFixed(1).replace(".", ",")}%`}
                </td>
                <td className="px-2 py-2">
                  {shift.agents === 0 ? (
                    <span className="text-muted-foreground text-xs">Sin agentes</span>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex h-2 overflow-hidden rounded-sm">
                        {shift.distribution.map((slice) => (
                          <div
                            key={slice.key}
                            className={statusBarClass(slice.status)}
                            style={{ width: `${slice.percentage}%` }}
                            title={`${slice.name}: ${slice.count}`}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground flex flex-wrap gap-x-2 text-[11px]">
                        {shift.distribution
                          .filter((slice) => slice.count > 0)
                          .map((slice) => (
                            <span key={slice.key} className="inline-flex items-center gap-1">
                              <span
                                className={cn("size-2 rounded-[2px]", statusBarClass(slice.status))}
                                aria-hidden="true"
                              />
                              {slice.name} {slice.count}
                            </span>
                          ))}
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
