import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AgentMetrics } from "@/lib/wfm/types";
import type { Benchmark } from "@/lib/wfm/analysis";
import { formatDateTime, formatSeconds } from "@/lib/wfm/time";
import { computeOccupancy } from "@/lib/wfm/aggregate";
import { CategoryBadge, OccupancyCell } from "./OccupancyCell";
import { cn } from "@/lib/utils";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-md border p-2">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

function BenchmarkBlock({ benchmark }: { benchmark: Benchmark }) {
  return (
    <section className="border-border bg-surface space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
          Comparación relativa
        </h3>
        <p className="text-muted-foreground text-[11px]">{benchmark.referenceLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Agente" value={pct(benchmark.agentOccupancy)} />
        <Metric label="Referencia" value={pct(benchmark.referenceOccupancy)} />
        <Metric label="Equipo" value={pct(benchmark.teamOccupancy)} />
        <div className="border-border rounded-md border p-2">
          <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Desviación</p>
          <p
            className={cn(
              "mt-0.5 font-mono text-sm font-semibold tabular-nums",
              benchmark.status === "above" && "text-status-high-foreground",
              benchmark.status === "below" && "text-status-low-foreground",
            )}
          >
            {benchmark.deviation === null
              ? "—"
              : `${benchmark.deviation > 0 ? "+" : benchmark.deviation < 0 ? "−" : ""}${Math.abs(
                  benchmark.deviation,
                )
                  .toFixed(1)
                  .replace(".", ",")} p.p.`}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {benchmark.label}. Comparación informativa, sin rankings ni clasificaciones de rendimiento.
      </p>
    </section>
  );
}

export function AgentDetail({
  agent,
  benchmark,
  onClose,
}: {
  agent: AgentMetrics | null;
  benchmark?: Benchmark | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {agent && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {agent.agent}
                <CategoryBadge category={agent.category} />
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Turno" value={agent.shiftName} />
              <Metric label="Sesiones" value={String(agent.sessions)} />
              <Metric label="Llamadas" value={agent.calls.toLocaleString("es-ES")} />
              <Metric label="T. Sesión" value={formatSeconds(agent.sessionSeconds)} />
              <Metric label="T. Conversación" value={formatSeconds(agent.conversationSeconds)} />
              <Metric label="T. ACW" value={formatSeconds(agent.acwSeconds)} />
              <Metric label="T. Productivo" value={formatSeconds(agent.productiveSeconds)} />
              <Metric label="Días trabajados" value={String(agent.workedDays)} />
              <Metric
                label="Jornada activa esperada"
                value={formatSeconds(agent.expectedActiveSeconds)}
              />
              <Metric label="T. Inactivo" value={formatSeconds(agent.idleSeconds)} />
              <Metric
                label="% Ocupación"
                value={
                  agent.occupancy === null
                    ? "—"
                    : `${agent.occupancy.toFixed(1).replace(".", ",")}%`
                }
              />
            </div>

            {benchmark && <BenchmarkBlock benchmark={benchmark} />}

            {agent.shiftBreakdown.length > 1 && (
              <section className="border-border rounded-md border p-3">
                <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
                  Reparto por turno (días operativos)
                </h3>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {agent.shiftBreakdown.map((item) => (
                    <li
                      key={item.shiftId ?? "none"}
                      className="border-border/70 flex items-center justify-between gap-2 rounded-sm border px-2 py-1 text-xs"
                    >
                      <span>{item.shiftName}</span>
                      <span className="font-mono tabular-nums">
                        {item.days} día(s) · {item.percentage.toFixed(2).replace(".", ",")}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}



            <div className="border-border overflow-x-auto rounded-md border">
              <table className="w-full min-w-[880px] text-xs">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr>
                    {[
                      "Sesión",
                      "Inicio",
                      "Fin",
                      "Duración",
                      "Llamadas",
                      "T. Conversación",
                      "T. ACW",
                      "T. Productivo",
                      "% Ocupación",
                    ].map((label) => (
                      <th
                        key={label}
                        className="border-border/60 border-b px-2 py-1.5 text-left font-semibold"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agent.records.map((record) => {
                    const occ = computeOccupancy(record.productiveSeconds, record.sessionSeconds);
                    return (
                      <tr key={record.sessionId} className="border-border/60 border-b last:border-0">
                        <td className="px-2 py-1.5 font-mono">{record.sessionId}</td>
                        <td className="px-2 py-1.5 font-mono">{formatDateTime(record.start)}</td>
                        <td className="px-2 py-1.5 font-mono">{formatDateTime(record.end)}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {formatSeconds(record.sessionSeconds)}
                        </td>
                        <td className="px-2 py-1.5 font-mono">{record.calls}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {formatSeconds(record.conversationSeconds)}
                        </td>
                        <td className="px-2 py-1.5 font-mono">{formatSeconds(record.acwSeconds)}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {formatSeconds(record.productiveSeconds)}
                        </td>
                        <td className="px-2 py-1.5">
                          <OccupancyCell occupancy={occ} category={agent.category} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
