import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentMetrics, Shift } from "@/lib/wfm/types";
import { agentDailyBreakdown, type Benchmark } from "@/lib/wfm/analysis";
import { formatDateKey, formatDateTime, formatSeconds } from "@/lib/wfm/time";
import { computeOccupancy } from "@/lib/wfm/aggregate";
import { CategoryBadge, OccupancyCell } from "./OccupancyCell";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  computeTimeDistribution,
  reconcileAux,
  type AuxIndex,
} from "@/lib/wfm/aux-distribution";

import type { AuxMapping, MacroCategory } from "@/lib/wfm/aux-types";
import { TimeDistributionView } from "./TimeDistribution";


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

function Metric({
  label,
  value,
  info,
  valueClassName,
}: {
  label: string;
  value: string;
  info?: string;
  valueClassName?: string;
}) {
  return (
    <div className="border-border rounded-md border p-2">
      <div className="flex items-start justify-between gap-1">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
        {info && <InfoTooltip text={info} label={label} />}
      </div>
      <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", valueClassName)}>{value}</p>
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

function BenchmarkBlock({
  benchmark,
  agent,
}: {
  benchmark: Benchmark;
  agent: AgentMetrics;
}) {
  const refShare =
    benchmark.referenceKind === "shift"
      ? agent.shiftBreakdown.find((s) => s.shiftId === benchmark.referenceShiftId)
      : undefined;
  return (
    <TooltipProvider delayDuration={0}>
      <section className="border-border bg-surface space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
            Comparación relativa
          </h3>
          <p className="text-muted-foreground text-[11px]">
            {benchmark.referenceLabel}
            {refShare && agent.shiftBreakdown.length > 1
              ? ` · ${refShare.percentage.toFixed(2).replace(".", ",")}% de los días`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Agente"
            value={pct(benchmark.agentOccupancy)}
            info="Ocupación agregada del agente seleccionado para el período evaluado. Se calcula como tiempo productivo total ÷ tiempo de sesión total, no como media de los porcentajes de cada sesión."
          />
          <Metric
            label={
              benchmark.referenceKind === "shift"
                ? `Referencia · ${benchmark.referenceShiftName}`
                : "Referencia · equipo"
            }
            value={pct(benchmark.referenceOccupancy)}
            info={
              benchmark.referenceKind === "shift"
                ? `Ocupación agregada del turno ${benchmark.referenceShiftName} (turno dominante del agente): tiempo productivo total ÷ tiempo de sesión total de todos los agentes de ese turno. Es el mismo valor que aparece en Operación · Análisis por turno.`
                : `Se usa la ocupación del equipo como referencia. ${benchmark.fallbackReason ?? ""}`
            }
          />
          <Metric
            label="Equipo"
            value={pct(benchmark.teamOccupancy)}
            info="Ocupación agregada de todo el equipo evaluado, calculada como tiempo productivo total ÷ tiempo de sesión total de todos los agentes incluidos en el período."
          />
          <Metric
            label="Desviación"
            value={
              benchmark.deviation === null
                ? "—"
                : `${benchmark.deviation > 0 ? "+" : benchmark.deviation < 0 ? "−" : ""}${Math.abs(
                    benchmark.deviation,
                  )
                    .toFixed(1)
                    .replace(".", ",")} p.p.`
            }
            valueClassName={cn(
              benchmark.status === "above" && "text-status-high-foreground",
              benchmark.status === "below" && "text-status-low-foreground",
            )}
            info="Diferencia en puntos porcentuales entre la ocupación del agente y la ocupación de referencia. El color refleja la interpretación relativa: dentro del rango operativo, por encima o por debajo. No es un ranking ni una valoración de rendimiento individual."
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {benchmark.label}. Comparación informativa, sin rankings ni clasificaciones de rendimiento.
        </p>
        {benchmark.fallbackReason && (
          <p className="text-muted-foreground text-xs">{benchmark.fallbackReason}</p>
        )}
        {refShare && agent.shiftBreakdown.length > 1 && (
          <p className="text-muted-foreground text-xs">
            El agente reparte su jornada entre varios turnos; la referencia corresponde a{" "}
            {benchmark.referenceShiftName} ({refShare.days} día(s),{" "}
            {refShare.percentage.toFixed(2).replace(".", ",")}%).
          </p>
        )}
      </section>
    </TooltipProvider>
  );
}

/**
 * Desglose diario del período: la ocupación de cada día es su propio ratio
 * (productivo del día / sesión del día). La ocupación de la cabecera es el ratio
 * del período y NO es la media aritmética de estas filas.
 */
function DailyBreakdown({
  agent,
  shifts,
  referenceOccupancy,
  tolerance,
}: {
  agent: AgentMetrics;
  shifts: Shift[];
  referenceOccupancy: number | null;
  tolerance: number;
}) {
  const [open, setOpen] = useState(false);
  const rows = agentDailyBreakdown(agent.records, shifts);
  if (rows.length < 2) return null;

  const outside =
    referenceOccupancy === null
      ? null
      : rows.filter(
          (row) => row.occupancy !== null && Math.abs(row.occupancy - referenceOccupancy) > tolerance,
        ).length;

  return (
    <section className="border-border rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">
          Desglose diario ({rows.length} días)
        </span>
        <span className="text-muted-foreground text-xs">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="border-border overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  {[
                    "Día operativo",
                    "Turno",
                    "Sesiones",
                    "Llamadas",
                    "T. Productivo",
                    "T. Sesión",
                    "% Ocupación del día",
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
                {rows.map((row) => (
                  <tr key={row.date} className="border-border/60 border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono tabular-nums">
                      {formatDateKey(row.date)}
                    </td>
                    <td className="px-2 py-1.5">{row.shiftName}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">{row.sessions}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">{row.calls}</td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">
                      {formatSeconds(row.productiveSeconds)}
                    </td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">
                      {formatSeconds(row.sessionSeconds)}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-semibold tabular-nums">
                      {pct(row.occupancy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            La ocupación de la cabecera es el ratio del período (productivo total / sesión total) y
            no la media de estas ocupaciones diarias.
            {outside !== null
              ? ` ${outside} de ${rows.length} día(s) quedan fuera de la tolerancia de ±${tolerance
                  .toFixed(1)
                  .replace(".", ",")} pp respecto a la referencia.`
              : ""}
          </p>
        </div>
      )}
    </section>
  );
}

export function AgentDetail({
  agent,
  benchmark,
  shifts,
  tolerance,
  periodDayCount,
  auxIndex,
  auxLoaded,
  macroCategories,
  auxMapping,
  onClose,
}: {
  agent: AgentMetrics | null;
  benchmark?: Benchmark | null;
  shifts: Shift[];
  tolerance: number;
  periodDayCount: number;
  auxIndex: AuxIndex;
  auxLoaded: boolean;
  macroCategories: MacroCategory[];
  auxMapping: AuxMapping;
  onClose: () => void;
}) {
  const agentDistribution = useMemo(() => {
    if (!agent) return null;
    const recon = reconcileAux(agent.records, auxIndex);
    return computeTimeDistribution(agent.records, recon, macroCategories, auxMapping);
  }, [agent, auxIndex, macroCategories, auxMapping]);

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

            {agentDistribution && (
              <section className="border-border rounded-md border p-3">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
                    Distribución del tiempo
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Reparto descriptivo del tiempo de sesión (WS = 100 %); no altera la ocupación.
                  </p>
                </div>
                <TimeDistributionView
                  distribution={agentDistribution}
                  auxLoaded={auxLoaded}
                  compact
                  emptyHint="Carga el fichero de estados AUX para desglosar el tiempo no productivo de este agente."
                />
              </section>
            )}

            {benchmark && <BenchmarkBlock benchmark={benchmark} agent={agent} />}


            {periodDayCount > 1 && (
              <DailyBreakdown
                agent={agent}
                shifts={shifts}
                referenceOccupancy={benchmark?.referenceOccupancy ?? null}
                tolerance={tolerance}
              />
            )}

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
