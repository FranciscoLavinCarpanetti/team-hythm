import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AgentMetrics } from "@/lib/wfm/types";
import { formatDateTime, formatSeconds } from "@/lib/wfm/time";
import { computeOccupancy } from "@/lib/wfm/aggregate";
import { CategoryBadge, OccupancyCell } from "./OccupancyCell";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-md border p-2">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AgentDetail({
  agent,
  onClose,
}: {
  agent: AgentMetrics | null;
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
              <Metric
                label="% Ocupación"
                value={
                  agent.occupancy === null
                    ? "—"
                    : `${agent.occupancy.toFixed(1).replace(".", ",")}%`
                }
              />
            </div>

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
