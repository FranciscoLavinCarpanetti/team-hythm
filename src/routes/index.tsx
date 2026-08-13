import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Search, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WfmProvider, useWfm } from "@/lib/wfm/store";
import { aggregateAgents, computeKpis } from "@/lib/wfm/aggregate";
import { formatDateKey } from "@/lib/wfm/time";
import { UploadPanel } from "@/components/wfm/UploadPanel";
import { KpiSummary } from "@/components/wfm/KpiSummary";
import { AgentTable, sortAgents, type SortState } from "@/components/wfm/AgentTable";
import { AgentDetail } from "@/components/wfm/AgentDetail";
import { ConfigPanel } from "@/components/wfm/ConfigPanel";
import type { AgentMetrics } from "@/lib/wfm/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WFM Ocupación de Agentes | Panel Operativo" },
      {
        name: "description",
        content:
          "Importa el Excel de sesiones y analiza ocupación, llamadas y carga por agente con turnos y umbrales configurables.",
      },
      { property: "og:title", content: "WFM Ocupación de Agentes" },
      {
        property: "og:description",
        content:
          "Panel operativo de Workforce Management: métricas agregadas por agente a partir del Excel de sesiones.",
      },
    ],
  }),
  component: () => (
    <WfmProvider>
      <Dashboard />
    </WfmProvider>
  ),
});

function Dashboard() {
  const { records, dates, categories, shifts, clearData, importedAt } = useWfm();
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: "calls", dir: "desc" });
  const [selected, setSelected] = useState<AgentMetrics | null>(null);

  const effectiveDate = dates.length === 1 ? dates[0]! : dateFilter;

  const filteredRecords = useMemo(
    () =>
      effectiveDate === "all"
        ? records
        : records.filter((r) => r.operationalDate === effectiveDate),
    [records, effectiveDate],
  );

  const allAgents = useMemo(
    () => aggregateAgents(filteredRecords, shifts, categories),
    [filteredRecords, shifts, categories],
  );

  const visibleAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allAgents.filter((agent) => {
      const matchesSearch = !term || agent.agent.toLowerCase().includes(term);
      const matchesShift =
        shiftFilter === "all" ||
        (shiftFilter === "none" ? agent.shiftId === null : agent.shiftId === shiftFilter);
      return matchesSearch && matchesShift;
    });
    return sortAgents(filtered, sort);
  }, [allAgents, search, shiftFilter, sort]);

  const kpis = useMemo(() => computeKpis(visibleAgents), [visibleAgents]);
  const hasData = records.length > 0;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-primary size-5" />
            <div>
              <h1 className="text-sm font-semibold">WFM · Ocupación de agentes</h1>
              <p className="text-muted-foreground text-xs">
                {hasData
                  ? `${records.length} sesiones importadas${importedAt ? ` · ${importedAt.toLocaleTimeString("es-ES")}` : ""}`
                  : "Sin datos importados"}
              </p>
            </div>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" onClick={clearData}>
              <Trash2 className="size-4" /> Vaciar datos
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">
              <BarChart3 className="size-4" /> Panel
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings2 className="size-4" /> Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 pt-4">
            {!hasData ? (
              <UploadPanel />
            ) : (
              <>
                <UploadPanel compact />
                <KpiSummary kpis={kpis} />

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar agente…"
                      className="pl-8"
                    />
                  </div>
                  <Select value={shiftFilter} onValueChange={setShiftFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los turnos</SelectItem>
                      {shifts.map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="none">Sin turno</SelectItem>
                    </SelectContent>
                  </Select>
                  {dates.length > 1 && (
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las fechas</SelectItem>
                        {dates.map((date) => (
                          <SelectItem key={date} value={date}>
                            {formatDateKey(date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {dates.length === 1 && (
                    <span className="text-muted-foreground text-xs">
                      Fecha operativa: {formatDateKey(dates[0]!)}
                    </span>
                  )}
                </div>

                <AgentTable
                  agents={visibleAgents}
                  sort={sort}
                  onSortChange={setSort}
                  onSelect={setSelected}
                />
                <p className="text-muted-foreground text-xs">
                  La ocupación se calcula con duraciones agregadas (T. productivo / T. sesión), no
                  promediando porcentajes de sesión.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="config" className="pt-4">
            <ConfigPanel />
          </TabsContent>
        </Tabs>
      </main>

      <AgentDetail agent={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
