import { ArrowDown, ArrowUp } from "lucide-react";
import type { AgentMetrics } from "@/lib/wfm/types";
import { formatSeconds } from "@/lib/wfm/time";
import { CategoryBadge, OccupancyCell } from "./OccupancyCell";
import { cn } from "@/lib/utils";

export type SortKey =
  | "agent"
  | "shiftName"
  | "sessions"
  | "calls"
  | "conversationSeconds"
  | "acwSeconds"
  | "productiveSeconds"
  | "occupancy"
  | "category";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "agent", label: "Agente" },
  { key: "shiftName", label: "Turno" },
  { key: "sessions", label: "Sesiones", numeric: true },
  { key: "calls", label: "Llamadas", numeric: true },
  { key: "conversationSeconds", label: "T. Conversación", numeric: true },
  { key: "acwSeconds", label: "T. ACW", numeric: true },
  { key: "productiveSeconds", label: "T. Productivo", numeric: true },
  { key: "occupancy", label: "% Ocupación", numeric: true },
  { key: "category", label: "Categoría de Carga" },
];

export function sortAgents(agents: AgentMetrics[], sort: SortState): AgentMetrics[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...agents].sort((a, b) => {
    let result = 0;
    if (sort.key === "agent") result = a.agent.localeCompare(b.agent, "es");
    else if (sort.key === "shiftName") result = a.shiftName.localeCompare(b.shiftName, "es");
    else if (sort.key === "category")
      result = (a.category?.order ?? 99) - (b.category?.order ?? 99);
    else if (sort.key === "occupancy") result = (a.occupancy ?? -1) - (b.occupancy ?? -1);
    else result = (a[sort.key] as number) - (b[sort.key] as number);
    if (result === 0) result = a.agent.localeCompare(b.agent, "es");
    return result * factor;
  });
}

export function AgentTable({
  agents,
  sort,
  onSortChange,
  onSelect,
}: {
  agents: AgentMetrics[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onSelect: (agent: AgentMetrics) => void;
}) {
  function toggle(key: SortKey) {
    if (sort.key === key) onSortChange({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else onSortChange({ key, dir: key === "agent" || key === "shiftName" ? "asc" : "desc" });
  }

  return (
    <div className="border-border bg-card overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-secondary-foreground">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "border-border/60 border-b px-3 py-2 text-[11px] font-semibold tracking-wide uppercase",
                  column.numeric ? "text-right" : "text-left",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  className={cn(
                    "inline-flex items-center gap-1 hover:underline",
                    column.numeric && "flex-row-reverse",
                  )}
                >
                  {column.label}
                  {sort.key === column.key &&
                    (sort.dir === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr
              key={agent.agent}
              tabIndex={0}
              onClick={() => onSelect(agent)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(agent);
              }}
              className="border-border/60 hover:bg-accent focus-visible:bg-accent cursor-pointer border-b last:border-0"
            >
              <td className="px-3 py-1.5 font-medium">{agent.agent}</td>
              <td className="px-3 py-1.5">
                {agent.shiftId ? (
                  agent.shiftName
                ) : (
                  <span className="text-muted-foreground italic">Sin turno asignado</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{agent.sessions}</td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                {agent.calls.toLocaleString("es-ES")}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                {formatSeconds(agent.conversationSeconds)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                {formatSeconds(agent.acwSeconds)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                {formatSeconds(agent.productiveSeconds)}
              </td>
              <td className="px-3 py-1.5">
                <OccupancyCell occupancy={agent.occupancy} category={agent.category} />
              </td>
              <td className="px-3 py-1.5">
                <CategoryBadge category={agent.category} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {agents.length === 0 && (
        <p className="text-muted-foreground p-6 text-center text-sm">
          Ningún agente coincide con los filtros aplicados.
        </p>
      )}
    </div>
  );
}
