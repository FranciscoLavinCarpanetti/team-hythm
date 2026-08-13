import type { Kpis } from "@/lib/wfm/types";
import { formatSeconds } from "@/lib/wfm/time";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-border bg-card rounded-md border p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>}
    </div>
  );
}

export function KpiSummary({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <Kpi label="Agentes" value={String(kpis.agents)} />
      <Kpi label="Sesiones" value={String(kpis.sessions)} />
      <Kpi label="Llamadas" value={kpis.calls.toLocaleString("es-ES")} />
      <Kpi label="T. Productivo" value={formatSeconds(kpis.productiveSeconds)} />
      <Kpi
        label="Ocupación media"
        value={
          kpis.avgOccupancy === null
            ? "—"
            : `${kpis.avgOccupancy.toFixed(1).replace(".", ",")}%`
        }
        hint="Ponderada: T. productivo / T. sesión"
      />
      <Kpi label="Carga baja" value={String(kpis.low)} />
      <Kpi label="Carga equilibrada" value={String(kpis.balanced)} />
      <Kpi label="Carga alta" value={String(kpis.high)} />
    </div>
  );
}
