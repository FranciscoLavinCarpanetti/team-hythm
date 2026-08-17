import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  BarChart3,
  History,
  ImageDown,
  Search,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportNodeAsPng } from "@/lib/wfm/export-image";

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
import {
  aggregateByShift,
  buildBenchmark,
  deriveAlerts,
  loadDistribution,
} from "@/lib/wfm/analysis";
import { formatDateKey } from "@/lib/wfm/time";
import { UploadPanel } from "@/components/wfm/UploadPanel";
import { KpiSummary } from "@/components/wfm/KpiSummary";
import { LoadDistribution } from "@/components/wfm/LoadDistribution";
import { OperationalAlerts } from "@/components/wfm/OperationalAlerts";
import { ShiftAnalysis } from "@/components/wfm/ShiftAnalysis";
import { DataQualityPanel } from "@/components/wfm/DataQualityPanel";
import { HistoryPanel } from "@/components/wfm/HistoryPanel";
import { AgentTable, sortAgents, type SortState } from "@/components/wfm/AgentTable";
import { AgentDetail } from "@/components/wfm/AgentDetail";
import { ConfigPanel } from "@/components/wfm/ConfigPanel";
import { AccessGate, SignOutButton } from "@/components/wfm/AccessGate";
import type { AgentMetrics } from "@/lib/wfm/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ocupación de agentes | Análisis operativo" },
      {
        name: "description",
        content:
          "Importa el Excel de sesiones y revisa ocupación, carga por turno, calidad de datos e histórico de importaciones por agente.",
      },
      { property: "og:title", content: "Ocupación de agentes" },
      {
        property: "og:description",
        content:
          "Análisis operativo de ocupación de agentes: métricas agregadas por agente y turno a partir del Excel de sesiones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AccessGate>
      <WfmProvider>
        <Dashboard />
      </WfmProvider>
    </AccessGate>
  ),
});

function Dashboard() {
  const {
    records,
    dates,
    categories,
    shifts,
    clearData,
    importedAt,
    issues,
    quality,
    activeMeta,
    viewingHistorical,
    backToLatest,
  } = useWfm();
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: "calls", dir: "desc" });
  const [selected, setSelected] = useState<AgentMetrics | null>(null);

  const effectiveDate = dates.length === 1 ? dates[0]! : dateFilter;

  const filteredRecords = useMemo(
    () =>
      effectiveDate === "all" ? records : records.filter((r) => r.operationalDate === effectiveDate),
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
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none"
          ? agent.category === null
          : agent.category?.id === categoryFilter);
      return matchesSearch && matchesShift && matchesCategory;
    });
    return sortAgents(filtered, sort);
  }, [allAgents, search, shiftFilter, categoryFilter, sort]);

  const kpis = useMemo(() => computeKpis(visibleAgents), [visibleAgents]);
  const distribution = useMemo(
    () => loadDistribution(visibleAgents, categories),
    [visibleAgents, categories],
  );
  const shiftMetrics = useMemo(
    () => aggregateByShift(visibleAgents, shifts, categories),
    [visibleAgents, shifts, categories],
  );
  // El benchmark usa la misma población que su referencia de equipo (todos los agentes),
  // para que «Referencia» y «Equipo» sean comparables entre sí.
  const shiftMetricsAll = useMemo(
    () => aggregateByShift(allAgents, shifts, categories),
    [allAgents, shifts, categories],
  );
  const alerts = useMemo(
    () => deriveAlerts(visibleAgents, distribution, kpis, quality),
    [visibleAgents, distribution, kpis, quality],
  );
  const benchmark = useMemo(
    () => (selected ? buildBenchmark(selected, allAgents, shiftMetricsAll) : null),
    [selected, allAgents, shiftMetricsAll],
  );

  const hasData = records.length > 0;

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const dateRangeLabel = useMemo(() => {
    if (effectiveDate !== "all") return formatDateKey(effectiveDate);
    if (dates.length === 0) return "Sin fechas";
    if (dates.length === 1) return formatDateKey(dates[0]!);
    return `${formatDateKey(dates[0]!)} – ${formatDateKey(dates[dates.length - 1]!)}`;
  }, [dates, effectiveDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const node = reportRef.current;
      if (node) {
        await exportNodeAsPng(node, `informe-ocupacion-${effectiveDate === "all" ? "global" : effectiveDate}.png`);
      }
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="bg-surface text-foreground min-h-screen">
      <header className="bg-primary text-primary-foreground shadow-card sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <span className="bg-primary-foreground/10 flex size-10 items-center justify-center rounded-sm">
              <BarChart3 className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-primary-foreground/55 text-[10px] leading-none font-semibold tracking-[0.18em] uppercase">
                Análisis operativo
              </p>
              <h1 className="text-[17px] leading-tight font-semibold tracking-tight">
                Ocupación de agentes
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-primary-foreground/70 hidden text-right text-xs leading-relaxed sm:block">
              <p className="font-medium">
                {hasData ? `${records.length} sesiones importadas` : "Sin datos importados"}
              </p>
              {importedAt && (
                <p className="text-primary-foreground/55">
                  Última carga: {importedAt.toLocaleTimeString("es-ES")}
                </p>
              )}
            </div>
            {hasData && (
              <Button variant="secondary" size="sm" onClick={clearData}>
                <Trash2 className="size-4" /> Vaciar datos
              </Button>
            )}
            <SignOutButton />
          </div>
        </div>
        <div className="bg-secondary-brand h-1 w-full" />
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        {viewingHistorical && activeMeta && (
          <div
            role="status"
            className="border-status-balanced/50 bg-status-balanced/10 text-status-balanced-foreground flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
          >
            <span>
              Estás analizando una importación histórica en solo lectura:{" "}
              <strong>{activeMeta.fileName}</strong> ·{" "}
              {new Date(activeMeta.importedAt).toLocaleString("es-ES")}
            </span>
            <Button size="sm" variant="secondary" onClick={backToLatest}>
              Volver a la última importación
            </Button>
          </div>
        )}

        <Tabs defaultValue="operacion">
          <TabsList className="flex-wrap">
            <TabsTrigger value="operacion">
              <BarChart3 className="size-4" /> Operación
            </TabsTrigger>
            <TabsTrigger value="agentes">
              <Users className="size-4" /> Agentes
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="size-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings2 className="size-4" /> Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operacion" className="space-y-5 pt-5">
            {!hasData ? (
              <UploadPanel />
            ) : (
              <>
                <UploadPanel compact />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">
                    El informe exportado incluye indicadores, distribución de carga y análisis por
                    turno.
                  </p>
                  <Button size="sm" onClick={handleExport} disabled={exporting}>
                    <ImageDown className="size-4" />
                    {exporting ? "Generando imagen…" : "Exportar informe (PNG)"}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <div
                    ref={reportRef}
                    className={cn(
                      "bg-surface space-y-5",
                      exporting ? "w-[1400px] p-6" : "w-full",
                    )}
                  >
                    <div className="border-border bg-card shadow-card flex flex-wrap items-end justify-between gap-3 rounded-md border p-4">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
                          Informe operativo
                        </p>
                        <h2 className="text-lg leading-tight font-semibold">
                          Ocupación de agentes
                        </h2>
                        <p className="text-muted-foreground text-xs">
                          {dateRangeLabel} · {kpis.agents} agentes · {kpis.sessions} sesiones
                        </p>
                      </div>
                      <div className="text-muted-foreground space-y-1 text-right text-xs">
                        {activeMeta && <p>Origen: {activeMeta.fileName}</p>}
                        <p>Generado: {new Date().toLocaleString("es-ES")}</p>
                      </div>
                    </div>

                    <KpiSummary kpis={kpis} />
                    <LoadDistribution slices={distribution} total={visibleAgents.length} />
                    <ShiftAnalysis shifts={shiftMetrics} />
                  </div>
                </div>

                <OperationalAlerts alerts={alerts} />
                {quality && (
                  <DataQualityPanel
                    quality={quality}
                    issues={issues}
                    agentsWithoutShift={kpis.withoutShift}
                  />
                )}
              </>
            )}
          </TabsContent>


          <TabsContent value="agentes" className="space-y-5 pt-5">
            {!hasData ? (
              <UploadPanel />
            ) : (
              <section className="border-border bg-card shadow-card space-y-4 rounded-md border p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-[13px] font-semibold tracking-wide uppercase">
                      Detalle por agente
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      {visibleAgents.length} agentes visibles
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar agente…"
                        aria-label="Buscar agente"
                        className="pl-8"
                      />
                    </div>
                    <Select value={shiftFilter} onValueChange={setShiftFilter}>
                      <SelectTrigger className="w-[170px]" aria-label="Filtrar por turno">
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
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[190px]" aria-label="Filtrar por categoría">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {[...categories]
                          .sort((a, b) => a.order - b.order)
                          .map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        <SelectItem value="none">Sin categoría</SelectItem>
                      </SelectContent>
                    </Select>
                    {dates.length > 1 && (
                      <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[180px]" aria-label="Filtrar por fecha">
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
              </section>
            )}
          </TabsContent>

          <TabsContent value="historico" className="pt-5">
            <HistoryPanel />
          </TabsContent>

          <TabsContent value="config" className="pt-4">
            <ConfigPanel />
          </TabsContent>
        </Tabs>
      </main>

      <AgentDetail agent={selected} benchmark={benchmark} onClose={() => setSelected(null)} />
    </div>
  );
}
