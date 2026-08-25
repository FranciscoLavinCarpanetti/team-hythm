import type { AuxDiagnostics, TimeDistribution } from "@/lib/wfm/aux-types";
import { TimeDistributionView } from "./TimeDistribution";
import { AuxUploadPanel } from "./AuxUploadPanel";

/** Sección compacta de Operación: complementa los KPI de ocupación, no los sustituye. */
export function AuxDistributionPanel({
  distribution,
  diagnostics,
  auxLoaded,
  agents,
  periodLabel,
}: {
  distribution: TimeDistribution;
  diagnostics: AuxDiagnostics | null;
  auxLoaded: boolean;
  agents: number;
  periodLabel: string;
}) {
  return (
    <section
      className="border-border bg-card shadow-card space-y-4 rounded-md border p-4"
      aria-label="Distribución del tiempo de sesión"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">
          Distribución del tiempo
        </h2>
        <p className="text-muted-foreground text-xs">
          {periodLabel} · {agents} agentes · reparto del tiempo de sesión (WS = 100 %). No es
          ocupación: la ocupación mantiene su cálculo propio.
        </p>
      </div>

      {!auxLoaded ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Carga el fichero de estados AUX para repartir el tiempo de sesión entre trabajo directo,
            ACW y macro-categorías AUX. Mientras no esté cargado, el análisis queda incompleto.
          </p>
          <AuxUploadPanel compact />
        </div>
      ) : (
        <>
          <TimeDistributionView distribution={distribution} auxLoaded={auxLoaded} />
          {diagnostics && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="border-border/70 rounded-sm border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Agentes con AUX
                </p>
                <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">
                  {diagnostics.agentsWithAux}
                </p>
              </div>
              <div className="border-border/70 rounded-sm border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Agentes sin AUX
                </p>
                <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">
                  {diagnostics.agentsWithoutAux.length}
                </p>
              </div>
              <div className="border-border/70 rounded-sm border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Filas AUX emparejadas
                </p>
                <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">
                  {diagnostics.matchedRows} / {diagnostics.rowsLoaded}
                </p>
              </div>
              <div className="border-border/70 rounded-sm border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
                  AUX clasificado
                </p>
                <p className="mt-1 font-mono text-base leading-none font-semibold tabular-nums">
                  {distribution.sessionSeconds
                    ? `${((distribution.auxSeconds / distribution.sessionSeconds) * 100)
                        .toFixed(1)
                        .replace(".", ",")}%`
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
