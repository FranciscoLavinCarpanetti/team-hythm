import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  PhoneCall,
  Scale as ScaleIcon,
  Timer,
  TimerOff,
  UserX,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Kpis } from "@/lib/wfm/types";
import { formatSeconds } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

function Cell({
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
    <div className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
      <span
        className={cn(
          "bg-secondary text-primary flex size-7 shrink-0 items-center justify-center rounded-sm",
          accent === "low" && "bg-status-low/20 text-status-low-foreground",
          accent === "balanced" && "bg-status-balanced/20 text-status-balanced-foreground",
          accent === "high" && "bg-status-high/15 text-status-high-foreground",
        )}
        aria-hidden="true"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] leading-tight font-semibold tracking-[0.08em] uppercase">
          {label}
        </p>
        <p className="mt-1 font-mono text-[17px] leading-none font-semibold tabular-nums">{value}</p>
        {hint && (
          <p className="text-muted-foreground mt-1 text-[10px] leading-tight">{hint}</p>
        )}

      </div>
    </div>
  );
}

export function KpiSummary({ kpis }: { kpis: Kpis }) {
  const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

  return (
    <section
      aria-label="Indicadores clave de operación"
      className="border-border bg-card shadow-card grid grid-cols-2 divide-x divide-y divide-[color:var(--border)] overflow-hidden rounded-md border sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
    >
      <Cell label="Agentes" value={String(kpis.agents)} icon={Users} />
      <Cell label="Sesiones" value={String(kpis.sessions)} icon={Activity} />
      <Cell label="Llamadas" value={kpis.calls.toLocaleString("es-ES")} icon={PhoneCall} />
      <Cell label="T. Productivo" value={formatSeconds(kpis.productiveSeconds)} icon={Timer} />
      <Cell
        label="Ocupación operativa"
        value={pct(kpis.avgOccupancy)}
        hint="Productivo / sesión"
        icon={Gauge}
      />
      <Cell
        label="T. Inactivo"
        value={formatSeconds(kpis.idleSeconds)}
        hint={`Esp. ${formatSeconds(kpis.expectedActiveSeconds)}`}
        icon={TimerOff}
      />
      <Cell label="Carga baja" value={String(kpis.low)} icon={ArrowDownRight} accent="low" />
      <Cell
        label="Carga equilibrada"
        value={String(kpis.balanced)}
        icon={ScaleIcon}
        accent="balanced"
      />
      <Cell label="Carga alta" value={String(kpis.high)} icon={ArrowUpRight} accent="high" />
      {kpis.withoutShift > 0 && (
        <Cell label="Sin turno" value={String(kpis.withoutShift)} icon={UserX} />
      )}
    </section>
  );
}
