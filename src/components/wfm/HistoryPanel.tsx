import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWfm } from "@/lib/wfm/store";
import { aggregateAgents, computeKpis } from "@/lib/wfm/aggregate";
import { aggregateByShift, compareByShift, compareDatasets } from "@/lib/wfm/analysis";
import { formatDateKey, formatSeconds } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

function range(from: string | null, to: string | null): string {
  if (!from) return "—";
  return from === to || !to ? formatDateKey(from) : `${formatDateKey(from)} – ${formatDateKey(to)}`;
}

function formatValue(value: number | null, format: "number" | "duration" | "percent"): string {
  if (value === null) return "—";
  if (format === "duration") return formatSeconds(value);
  if (format === "percent") return `${value.toFixed(1).replace(".", ",")}%`;
  return value.toLocaleString("es-ES");
}

function Delta({ value, format }: { value: number | null; format: "number" | "duration" | "percent" }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const text =
    format === "duration"
      ? formatSeconds(abs)
      : format === "percent"
        ? `${abs.toFixed(1).replace(".", ",")} p.p.`
        : abs.toLocaleString("es-ES");
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        value > 0 && "text-status-low-foreground",
        value < 0 && "text-status-high-foreground",
      )}
    >
      {sign}
      {text}
    </span>
  );
}

export function HistoryPanel() {
  const {
    historyList,
    activeMeta,
    latestImportId,
    viewingHistorical,
    viewImport,
    backToLatest,
    removeImport,
    loadSnapshot,
    shifts,
    categories,
  } = useWfm();
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  const comparison = useMemo(() => {
    if (!aId || !bId || aId === bId) return null;
    const a = loadSnapshot(aId);
    const b = loadSnapshot(bId);
    if (!a?.records.length || !b?.records.length) return null;
    const aAgents = aggregateAgents(a.records, shifts, categories);
    const bAgents = aggregateAgents(b.records, shifts, categories);
    const aKpis = computeKpis(aAgents);
    const bKpis = computeKpis(bAgents);
    return {
      a,
      b,
      rows: compareDatasets(aAgents, bAgents, aKpis, bKpis),
      shiftRows: compareByShift(
        aggregateByShift(aAgents, shifts, categories),
        aggregateByShift(bAgents, shifts, categories),
      ),
    };
  }, [aId, bId, loadSnapshot, shifts, categories]);

  if (historyList.length === 0) {
    return (
      <section className="border-border bg-card shadow-card rounded-md border p-6 text-center">
        <p className="text-sm font-medium">Sin importaciones registradas</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Cada Excel importado queda registrado aquí con sus metadatos, sin modificar la
          configuración de turnos ni categorías.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section
        className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
        aria-label="Histórico de importaciones"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold tracking-wide uppercase">
            Histórico de importaciones
          </h2>
          {viewingHistorical && (
            <Button size="sm" variant="secondary" onClick={backToLatest}>
              Volver a la última importación
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-border border-b text-[10px] tracking-[0.1em] uppercase">
                {[
                  "Archivo",
                  "Importado",
                  "Periodo",
                  "Filas",
                  "Válidas",
                  "No válidas",
                  "Duplicadas",
                  "Agentes",
                  "",
                ].map((label, i) => (
                  <th
                    key={label || i}
                    scope="col"
                    className={cn("px-2 py-2 font-semibold", i >= 3 ? "text-right" : "text-left")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyList.map((meta) => (
                <tr
                  key={meta.id}
                  className={cn(
                    "border-border/60 odd:bg-surface/60 border-b last:border-0",
                    activeMeta?.id === meta.id && "bg-accent/30 odd:bg-accent/30",
                  )}
                >
                  <td className="max-w-[220px] truncate px-2 py-2 font-medium" title={meta.fileName}>
                    {meta.fileName}
                    {meta.id === latestImportId && (
                      <span className="text-muted-foreground ml-1 text-[11px]">(activa)</span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {new Date(meta.importedAt).toLocaleString("es-ES")}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {range(meta.dateFrom, meta.dateTo)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{meta.rowCount}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{meta.validRows}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{meta.invalidRows}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {meta.duplicateRows}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{meta.agents}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!meta.hasRecords}
                        title={
                          meta.hasRecords
                            ? "Analizar en solo lectura"
                            : "Sesiones no conservadas (solo metadatos)"
                        }
                        onClick={() => {
                          if (viewImport(meta.id)) toast.success("Conjunto histórico cargado");
                          else toast.error("Este histórico no conserva las sesiones");
                        }}
                      >
                        <Eye className="size-3.5" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Eliminar ${meta.fileName} del histórico`}
                        onClick={() => removeImport(meta.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="border-border bg-card shadow-card space-y-3 rounded-md border p-4"
        aria-label="Comparación de periodos"
      >
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide uppercase">
            Comparación de periodos
          </h2>
          <p className="text-muted-foreground text-xs">
            Tendencia a nivel de equipo y turno con la configuración actual de turnos y categorías.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={aId} onValueChange={setAId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Conjunto A" />
            </SelectTrigger>
            <SelectContent>
              {historyList
                .filter((m) => m.hasRecords)
                .map((meta) => (
                  <SelectItem key={meta.id} value={meta.id}>
                    {meta.fileName} · {range(meta.dateFrom, meta.dateTo)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={bId} onValueChange={setBId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Conjunto B" />
            </SelectTrigger>
            <SelectContent>
              {historyList
                .filter((m) => m.hasRecords)
                .map((meta) => (
                  <SelectItem key={meta.id} value={meta.id}>
                    {meta.fileName} · {range(meta.dateFrom, meta.dateTo)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {!comparison ? (
          <p className="text-muted-foreground text-xs">
            Selecciona dos importaciones distintas con sesiones conservadas.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-border border-b text-[10px] tracking-[0.1em] uppercase">
                    <th scope="col" className="px-2 py-2 text-left font-semibold">
                      Métrica
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      A
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      B
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Variación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.label} className="border-border/60 odd:bg-surface/60 border-b last:border-0">
                      <td className="px-2 py-2">{row.label}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatValue(row.a, row.format)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatValue(row.b, row.format)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Delta value={row.delta} format={row.format} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-border border-b text-[10px] tracking-[0.1em] uppercase">
                    <th scope="col" className="px-2 py-2 text-left font-semibold">
                      Turno
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Ocupación A
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Ocupación B
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Llamadas A / B
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Agentes A / B
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.shiftRows.map((row) => (
                    <tr
                      key={row.shiftName}
                      className="border-border/60 odd:bg-surface/60 border-b last:border-0"
                    >
                      <td className="px-2 py-2">{row.shiftName}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatValue(row.aOccupancy, "percent")}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatValue(row.bOccupancy, "percent")}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {row.aCalls.toLocaleString("es-ES")} / {row.bCalls.toLocaleString("es-ES")}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {row.aAgents} / {row.bAgents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
