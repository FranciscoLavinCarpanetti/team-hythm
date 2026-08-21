import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DataQuality, ParseIssue } from "@/lib/wfm/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ParseIssue["kind"], string> = {
  "missing-key": "Clave incompleta",
  "invalid-duration": "Duración no válida",
  "invalid-calls": "Llamadas no válidas",
  "invalid-dates": "Fechas no válidas",
  duplicate: "Duplicado detectado",
  "zero-calls": "Sesión sin llamadas",
  "productive-exceeds-session": "Sesión anómala",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "critical";
}) {
  return (
    <div className="border-border/70 rounded-sm border px-2.5 py-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-base leading-none font-semibold tabular-nums",
          tone === "warning" && value > 0 && "text-status-balanced-foreground",
          tone === "critical" && value > 0 && "text-status-high-foreground",
        )}
      >
        {value.toLocaleString("es-ES")}
      </p>
    </div>
  );
}

export function DataQualityPanel({
  quality,
  issues,
  agentsWithoutShift,
  periodLabel,
  undatedIssues = 0,
}: {
  quality: DataQuality;
  issues: ParseIssue[];
  agentsWithoutShift: number;
  periodLabel?: string;
  undatedIssues?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
      aria-label="Calidad de datos de la importación"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">Calidad de datos</h2>
        <p className="text-muted-foreground text-xs">
          {periodLabel ? `Período: ${periodLabel}. ` : ""}Ninguna fila cuestionable se altera: las
          descartadas se listan con su motivo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Filas totales" value={quality.totalRows} />
        <Stat label="Válidas" value={quality.validRows} />
        <Stat label="No válidas" value={quality.invalidRows} tone="critical" />
        <Stat label="Duplicadas" value={quality.duplicateRows} tone="warning" />
        <Stat label="Agentes" value={quality.agents} />
        <Stat label="Sin turno" value={agentsWithoutShift} tone="warning" />
        <Stat label="Sesiones sin llamadas" value={quality.zeroCallSessions} tone="warning" />
        <Stat label="Sesiones anómalas" value={quality.anomalousSessions} tone="warning" />
      </div>

      {undatedIssues > 0 && (
        <p className="text-muted-foreground text-xs">
          {undatedIssues} incidencia(s) sin día operativo determinable quedan fuera de cualquier
          período y no se incluyen en estos contadores.
        </p>
      )}

      {issues.length > 0 && (
        <>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Ocultar incidencias" : `Ver incidencias (${issues.length})`}
          </Button>
          {open && (
            <div className="border-border max-h-72 overflow-auto rounded-md border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-secondary text-secondary-foreground sticky top-0">
                  <tr>
                    {["Fila", "Sesión", "Agente", "Tipo", "Motivo"].map((label) => (
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
                  {issues.map((issue, index) => (
                    <tr
                      key={`${issue.row}-${issue.kind}-${index}`}
                      className="border-border/60 border-b last:border-0"
                    >
                      <td className="px-2 py-1.5 font-mono tabular-nums">{issue.row}</td>
                      <td className="px-2 py-1.5 font-mono">{issue.sessionId ?? "—"}</td>
                      <td className="px-2 py-1.5">{issue.agent ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded border px-1.5 py-0.5",
                            issue.severity === "error"
                              ? "border-status-high/40 bg-status-high/10 text-status-high-foreground"
                              : "border-status-balanced/40 bg-status-balanced/10 text-status-balanced-foreground",
                          )}
                        >
                          {KIND_LABEL[issue.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
