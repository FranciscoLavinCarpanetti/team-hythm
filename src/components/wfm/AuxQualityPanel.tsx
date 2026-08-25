import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuxDiagnostics, AuxIssue } from "@/lib/wfm/aux-types";
import { formatSeconds } from "@/lib/wfm/time";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 rounded-sm border px-2.5 py-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Diagnósticos AUX: calidad de datos, nunca valoración del rendimiento del agente. */
export function AuxQualityPanel({
  diagnostics,
  issues,
}: {
  diagnostics: AuxDiagnostics;
  issues: AuxIssue[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
      aria-label="Calidad de datos de estados AUX"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">Calidad de datos AUX</h2>
        <p className="text-muted-foreground text-xs">
          Indicadores descriptivos de cobertura y consistencia del fichero AUX.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Row label="Filas AUX" value={String(diagnostics.rowsLoaded)} />
        <Row label="Emparejadas" value={String(diagnostics.matchedRows)} />
        <Row label="Sin emparejar" value={String(diagnostics.unmatchedRows)} />
        <Row label="Duplicadas" value={String(diagnostics.duplicateRows)} />
        <Row label="No válidas" value={String(diagnostics.invalidRows)} />
        <Row label="Intervalos solapados" value={String(diagnostics.overlappingIntervals)} />
        <Row label="Recortadas a la sesión" value={String(diagnostics.clippedRecords)} />
        <Row label="Fuera de sesión" value={String(diagnostics.outsideSessionRecords)} />
        <Row label="Estados desconocidos" value={String(diagnostics.unknownStates.length)} />
        <Row label="Estados sin asignar" value={String(diagnostics.unmappedStates.length)} />
        <Row label="Agentes sin AUX" value={String(diagnostics.agentsWithoutAux.length)} />
        <Row label="Tiempo sin clasificar" value={formatSeconds(diagnostics.unclassifiedSeconds)} />
      </div>

      {diagnostics.unmappedStates.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Estados sin macro-categoría asignada: {diagnostics.unmappedStates.join(", ")}. Su tiempo
          se muestra como «Sin clasificar» hasta que se asignen en Configuración → Estados AUX.
        </p>
      )}
      {diagnostics.agentsWithoutAux.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {diagnostics.agentsWithoutAux.length} agente(s) con sesiones y sin registros AUX
          emparejados: cobertura AUX incompleta, no ausencia de trabajo.
        </p>
      )}
      {diagnostics.deskMismatches > 0 && (
        <p className="text-muted-foreground text-xs">
          {diagnostics.deskMismatches} registro(s) AUX con pupitre distinto al de la sesión
          (comprobación secundaria; el emparejamiento se hace por sesión y agente).
        </p>
      )}

      {issues.length > 0 && (
        <>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Ocultar incidencias AUX" : `Ver incidencias AUX (${issues.length})`}
          </Button>
          {open && (
            <div className="border-border max-h-72 overflow-auto rounded-md border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-secondary text-secondary-foreground sticky top-0">
                  <tr>
                    {["Fila", "Sesión", "Agente", "Estado", "Motivo"].map((label) => (
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
                      <td className="px-2 py-1.5">{issue.state ?? "—"}</td>
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
