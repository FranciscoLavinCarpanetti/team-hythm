import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentMetrics } from "@/lib/wfm/types";
import type { Benchmark } from "@/lib/wfm/analysis";
import { formatDateTime, formatSeconds } from "@/lib/wfm/time";
import { computeOccupancy } from "@/lib/wfm/aggregate";
import { CategoryBadge, OccupancyCell } from "./OccupancyCell";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1 -mt-1 inline-flex size-5 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-1"
          aria-label={`Información sobre ${label}`}
          title="Más información"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}
          onTouchStart={() => setOpen(true)}
          onPointerDown={() => setOpen(true)}
        >
          <Info className="size-3.5 pointer-events-none" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[240px]">
        <p className="leading-snug">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function Metric({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div className="border-border rounded-md border p-2">
      <div className="flex items-start justify-between gap-1">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
        {info && <InfoTooltip text={info} label={label} />}
      </div>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

function BenchmarkBlock({ benchmark }: { benchmark: Benchmark }) {
  return (
    <TooltipProvider delayDuration={0}>
      <section className="border-border bg-surface space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
            Comparación relativa
          </h3>
          <p className="text-muted-foreground text-[11px]">{benchmark.referenceLabel}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Agente"
            value={pct(benchmark.agentOccupancy)}
            info="Ocupación agregada del agente seleccionado para el período evaluado. Se calcula como tiempo productivo total ÷ tiempo de sesión total, no como media de los porcentajes de cada sesión."
          />
          <Metric
            label="Referencia"
            value={pct(benchmark.referenceOccupancy)}
            info="Ocupación de referencia usada para la comparación. Si el turno del agente tiene suficientes agentes, se usa la ocupación agregada de ese turno; en caso contrario, la del equipo completo."
          />
          <Metric
            label="Equipo"
            value={pct(benchmark.teamOccupancy)}
            info="Ocupación agregada de todo el equipo evaluado, calculada como tiempo productivo total ÷ tiempo de sesión total de todos los agentes incluidos en el período."
          />
          <div className="border-border rounded-md border p-2">
            <div className="flex items-start justify-between gap-1">
              <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Desviación</p>
              <InfoTooltip
                label="Desviación"
                text="Diferencia en puntos porcentuales entre la ocupación del agente y la ocupación de referencia. El color refleja la interpretación relativa: dentro del rango operativo, por encima o por debajo. No es un ranking ni una valoración de rendimiento individual."
              />
            </div>
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
    </TooltipProvider>
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
