import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWfm } from "@/lib/wfm/store";
import { isValidTime, shiftDurationLabel, validateCategories } from "@/lib/wfm/aggregate";
import type { CategoryStatus, LoadCategory, Shift } from "@/lib/wfm/types";

const STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: "low", label: "Verde (carga baja)" },
  { value: "balanced", label: "Ámbar (equilibrada)" },
  { value: "high", label: "Rojo (carga alta)" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card space-y-4 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ConfigPanel({ agentNames }: { agentNames: string[] }) {
  const { categories, setCategories, shifts, setShifts, assignments, assignShift } = useWfm();
  const [draftCategories, setDraftCategories] = useState<LoadCategory[]>(categories);
  const [draftShifts, setDraftShifts] = useState<Shift[]>(shifts);

  const categoryErrors = useMemo(() => validateCategories(draftCategories), [draftCategories]);
  const shiftErrors = useMemo(
    () =>
      draftShifts.flatMap((shift) => {
        const errors: string[] = [];
        if (!shift.name.trim()) errors.push("Todos los turnos necesitan un nombre.");
        if (!isValidTime(shift.start) || !isValidTime(shift.end))
          errors.push(`Horario no válido en "${shift.name || "turno"}" (formato HH:MM).`);
        return errors;
      }),
    [draftShifts],
  );

  return (
    <div className="space-y-4">
      <Section
        title="Categorías de carga (reglas de negocio configurables)"
        description="Los umbrales de ocupación no están fijados en el código: al guardarlos, todas las categorías de agente se recalculan automáticamente."
      >
        <div className="space-y-3">
          {draftCategories.map((category, index) => (
            <div key={category.id} className="grid gap-2 md:grid-cols-5 md:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={category.name}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mínimo %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={category.min}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, min: Number(e.target.value) } : c)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máximo %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={category.max}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, max: Number(e.target.value) } : c)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado visual</Label>
                <Select
                  value={category.status}
                  onValueChange={(value) =>
                    setDraftCategories((list) =>
                      list.map((c, i) =>
                        i === index ? { ...c, status: value as CategoryStatus } : c,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Orden</Label>
                <Input
                  type="number"
                  value={category.order}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) =>
                        i === index ? { ...c, order: Number(e.target.value) } : c,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {categoryErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Configuración no válida</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-xs">
                {categoryErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="sm"
          disabled={categoryErrors.length > 0}
          onClick={() => {
            setCategories(draftCategories);
            toast.success("Categorías actualizadas y métricas recalculadas");
          }}
        >
          Guardar categorías
        </Button>
      </Section>

      <Section
        title="Turnos"
        description="Los turnos que cruzan medianoche (p. ej. Noche 23:00–07:00) están soportados."
      >
        <div className="space-y-3">
          {draftShifts.map((shift, index) => (
            <div key={shift.id} className="grid gap-2 md:grid-cols-4 md:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={shift.name}
                  onChange={(e) =>
                    setDraftShifts((list) =>
                      list.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inicio</Label>
                <Input
                  type="time"
                  value={shift.start}
                  onChange={(e) =>
                    setDraftShifts((list) =>
                      list.map((s, i) => (i === index ? { ...s, start: e.target.value } : s)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fin</Label>
                <Input
                  type="time"
                  value={shift.end}
                  onChange={(e) =>
                    setDraftShifts((list) =>
                      list.map((s, i) => (i === index ? { ...s, end: e.target.value } : s)),
                    )
                  }
                />
              </div>
              <p className="text-muted-foreground pb-2 text-xs">{shiftDurationLabel(shift)}</p>
            </div>
          ))}
        </div>

        {shiftErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Horarios no válidos</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-xs">
                {Array.from(new Set(shiftErrors)).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="sm"
          disabled={shiftErrors.length > 0}
          onClick={() => {
            setShifts(draftShifts);
            toast.success("Turnos actualizados");
          }}
        >
          Guardar turnos
        </Button>
      </Section>

      <Section
        title="Asignación de agentes a turnos"
        description="La asignación es independiente del Excel y se conserva al importar un nuevo fichero."
      >
        {agentNames.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Importa un Excel para detectar agentes y asignarles turno.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {agentNames.map((name) => (
              <div
                key={name}
                className="border-border flex items-center justify-between gap-3 rounded-md border p-2"
              >
                <span className="truncate text-sm">{name}</span>
                <Select
                  value={assignments[name] ?? "none"}
                  onValueChange={(value) => assignShift(name, value === "none" ? null : value)}
                >
                  <SelectTrigger className="w-[170px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin turno asignado</SelectItem>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start}–{shift.end})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
