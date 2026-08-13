import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  PhoneCall,
  Scale as ScaleIcon,
  Timer,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Kpis } from "@/lib/wfm/types";
import { formatSeconds } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "low" | "balanced" | "high";
}) {
  return (
    <div className="border-border bg-card shadow-card flex items-start justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="mt-1 font-mono text-xl leading-none font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground mt-1 text-[11px] leading-tight">{hint}</p>}
      </div>
      <span
        className={cn(
          "bg-secondary text-primary flex size-8 shrink-0 items-center justify-center rounded-sm",
          accent === "low" && "bg-status-low/20 text-status-low-foreground",
          accent === "balanced" && "bg-status-balanced/20 text-status-balanced-foreground",
          accent === "high" && "bg-status-high/15 text-status-high-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
    </div>
  );
}

export function KpiSummary({ kpis }: { kpis: Kpis }) {
  return (
    <section aria-label="Indicadores clave" className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Agentes" value={String(kpis.agents)} icon={Users} />
        <Kpi label="Sesiones" value={String(kpis.sessions)} icon={Activity} />
        <Kpi label="Llamadas" value={kpis.calls.toLocaleString("es-ES")} icon={PhoneCall} />
        <Kpi label="T. Productivo" value={formatSeconds(kpis.productiveSeconds)} icon={Timer} />
        <Kpi
          label="Ocupación media"
          value={
            kpis.avgOccupancy === null ? "—" : `${kpis.avgOccupancy.toFixed(1).replace(".", ",")}%`
          }
          hint="T. productivo / T. sesión"
          icon={Gauge}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Carga baja" value={String(kpis.low)} icon={ArrowDownRight} accent="low" />
        <Kpi
          label="Carga equilibrada"
          value={String(kpis.balanced)}
          icon={ScaleIcon}
          accent="balanced"
        />
        <Kpi label="Carga alta" value={String(kpis.high)} icon={ArrowUpRight} accent="high" />
      </div>
    </section>
  );
}
