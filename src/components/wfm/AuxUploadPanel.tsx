import { useRef, useState } from "react";
import { FileClock, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExcelValidationError } from "@/lib/wfm/excel";
import { parseAuxWorkbook } from "@/lib/wfm/aux-excel";
import { useWfm } from "@/lib/wfm/store";
import { formatDateKey } from "@/lib/wfm/time";
import { cn } from "@/lib/utils";

/**
 * Carga independiente del fichero de estados AUX. Enriquece el análisis pero no
 * sustituye al fichero de sesiones, que sigue siendo la fuente principal.
 */
export function AuxUploadPanel({ compact = false }: { compact?: boolean }) {
  const { applyAuxImport, clearAux, auxMeta } = useWfm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const result = await parseAuxWorkbook(file);
      applyAuxImport(result);
      const extra: string[] = [];
      if (result.duplicatesRemoved) extra.push(`${result.duplicatesRemoved} duplicados omitidos`);
      const invalid = result.issues.filter((i) => i.severity === "error").length;
      if (invalid) extra.push(`${invalid} filas no válidas`);
      toast.success(`${result.records.length} estados AUX importados`, {
        description: extra.length ? extra.join(" · ") : "Sesiones y ocupación sin cambios",
      });
    } catch (e) {
      const message =
        e instanceof ExcelValidationError
          ? e.message
          : "Error inesperado al procesar el fichero AUX.";
      const details = e instanceof ExcelValidationError ? e.details : [];
      setError({ message, details });
      toast.error(message);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "border-border bg-card flex flex-col items-center justify-center rounded-md border border-dashed text-center",
          compact ? "gap-2 p-4" : "gap-3 p-8",
          dragging && "border-accent bg-accent/10",
        )}
      >
        {loading ? (
          <Loader2 className="text-primary size-6 animate-spin" />
        ) : (
          <FileClock className="text-muted-foreground size-6" />
        )}
        <div>
          <p className="text-sm font-medium">
            {loading ? "Procesando estados AUX…" : "Cargar Excel de estados AUX (.xlsx)"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Fichero complementario: enriquece el reparto del tiempo de sesión. No sustituye al
            fichero de sesiones ni modifica la ocupación.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" /> Seleccionar AUX
          </Button>
          {auxMeta && (
            <Button size="sm" variant="ghost" onClick={clearAux}>
              <Trash2 className="size-3.5" /> Quitar AUX
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {auxMeta && (
        <dl className="border-border bg-card grid grid-cols-2 gap-2 rounded-md border p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Fichero AUX</dt>
            <dd className="font-medium break-all">{auxMeta.fileName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Filas válidas</dt>
            <dd className="font-mono tabular-nums">
              {auxMeta.validRows} / {auxMeta.totalRows}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rango de fechas</dt>
            <dd className="font-mono tabular-nums">
              {auxMeta.dateFrom
                ? auxMeta.dateFrom === auxMeta.dateTo
                  ? formatDateKey(auxMeta.dateFrom)
                  : `${formatDateKey(auxMeta.dateFrom)} – ${formatDateKey(auxMeta.dateTo!)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Validación</dt>
            <dd
              className={cn(
                "font-medium",
                auxMeta.invalidRows || auxMeta.duplicateRows
                  ? "text-status-balanced-foreground"
                  : "text-status-low-foreground",
              )}
            >
              {auxMeta.invalidRows || auxMeta.duplicateRows
                ? `${auxMeta.invalidRows} no válidas · ${auxMeta.duplicateRows} duplicadas`
                : "Sin incidencias"}
            </dd>
          </div>
        </dl>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
          {error.details.length > 0 && (
            <AlertDescription>
              <ul className="list-inside list-disc text-xs">
                {error.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
