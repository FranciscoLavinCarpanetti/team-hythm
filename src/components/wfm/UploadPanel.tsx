import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExcelValidationError, parseSessionsWorkbook } from "@/lib/wfm/excel";
import { useWfm } from "@/lib/wfm/store";
import { cn } from "@/lib/utils";

export function UploadPanel({ compact = false }: { compact?: boolean }) {
  const { applyImport } = useWfm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const result = await parseSessionsWorkbook(file);
      applyImport(result);
      const extra: string[] = [];
      if (result.duplicatesRemoved) extra.push(`${result.duplicatesRemoved} duplicadas omitidas`);
      if (result.warnings.length) extra.push(`${result.warnings.length} avisos`);
      toast.success(`${result.records.length} sesiones importadas`, {
        description: extra.length ? extra.join(" · ") : "Configuración de turnos conservada",
      });
    } catch (e) {
      const message =
        e instanceof ExcelValidationError ? e.message : "Error inesperado al procesar el archivo.";
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
          compact ? "gap-2 p-4" : "gap-3 p-10",
          dragging && "border-primary bg-primary/5",
        )}
      >
        {loading ? (
          <Loader2 className="text-primary size-6 animate-spin" />
        ) : (
          <FileSpreadsheet className="text-muted-foreground size-6" />
        )}
        <div>
          <p className="text-sm font-medium">
            {loading ? "Procesando fichero…" : "Cargar Excel de sesiones (.xlsx)"}
          </p>
          {!compact && (
            <p className="text-muted-foreground mt-1 text-xs">
              Arrastra el fichero o selecciónalo. Al importar se reemplazan los datos y se conserva
              la configuración.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> Seleccionar archivo
        </Button>
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
