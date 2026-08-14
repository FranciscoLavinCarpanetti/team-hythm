import { useState } from "react";
import { AlertTriangle, Info, OctagonAlert, ShieldCheck, X } from "lucide-react";
import type { OperationalAlert } from "@/lib/wfm/analysis";
import { cn } from "@/lib/utils";

const STYLE: Record<OperationalAlert["severity"], string> = {
  critical: "border-status-high/50 bg-status-high/10 text-status-high-foreground",
  warning: "border-status-balanced/50 bg-status-balanced/10 text-status-balanced-foreground",
  info: "border-border bg-surface text-foreground",
};

const ICON = {
  critical: OctagonAlert,
  warning: AlertTriangle,
  info: Info,
} as const;

const LABEL = { critical: "Crítica", warning: "Atención", info: "Informativa" } as const;

export function OperationalAlerts({ alerts }: { alerts: OperationalAlert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = alerts.filter((a) => !dismissed.includes(a.id));

  return (
    <section
      className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
      aria-label="Alertas operativas"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">Alertas operativas</h2>
        <p className="text-muted-foreground text-xs">
          {visible.length} activa{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <ShieldCheck className="text-status-low-foreground size-4" aria-hidden="true" />
          Sin anomalías detectadas en el conjunto de datos activo.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((alert) => {
            const Icon = ICON[alert.severity];
            return (
              <li
                key={alert.id}
                className={cn("flex items-start gap-2.5 rounded-sm border p-2.5", STYLE[alert.severity])}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    <span className="sr-only">{LABEL[alert.severity]}: </span>
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug opacity-90">{alert.description}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Descartar alerta: ${alert.title}`}
                  onClick={() => setDismissed((list) => [...list, alert.id])}
                  className="hover:bg-foreground/10 focus-visible:ring-ring rounded-sm p-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
