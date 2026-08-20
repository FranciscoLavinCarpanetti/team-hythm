import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { DEFAULT_CATEGORIES, DEFAULT_SHIFTS, useWfm } from "@/lib/wfm/store";
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
  dirty,
  actions,
  children,
}: {
  title: string;
  description: string;
  dirty: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-3xl">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {title}
            {dirty && (
              <span className="border-status-balanced/50 bg-status-balanced/15 text-status-balanced-foreground rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Cambios sin guardar
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `id-${Date.now()}`;

export function ConfigPanel() {
  const {
    categories,
    setCategories,
    shifts,
    setShifts,
    expectedAdjustmentPercent,
    setExpectedAdjustmentPercent,
  } = useWfm();
  const [draftCategories, setDraftCategories] = useState<LoadCategory[]>(categories);
  const [draftShifts, setDraftShifts] = useState<Shift[]>(shifts);
  const [draftAdjustment, setDraftAdjustment] = useState<string>(String(expectedAdjustmentPercent));

  useEffect(() => setDraftCategories(categories), [categories]);
  useEffect(() => setDraftShifts(shifts), [shifts]);
  useEffect(() => setDraftAdjustment(String(expectedAdjustmentPercent)), [expectedAdjustmentPercent]);

  const adjustmentValue = Number(draftAdjustment.replace(",", "."));
  const adjustmentInvalid = !Number.isFinite(adjustmentValue) || adjustmentValue < -100;
  const adjustmentDirty = !adjustmentInvalid && adjustmentValue !== expectedAdjustmentPercent;
  const adjustmentFactor = adjustmentInvalid ? 1 : Math.max(0, 1 + adjustmentValue / 100);
  const previewExample = formatSeconds(18 * 7.5 * 3600 * adjustmentFactor);

  const categoryErrors = useMemo(() => validateCategories(draftCategories), [draftCategories]);
  const shiftErrors = useMemo(
    () =>
      draftShifts.flatMap((shift) => {
        const errors: string[] = [];
        if (!shift.name.trim()) errors.push("Todos los turnos necesitan un nombre.");
        if (!isValidTime(shift.start) || !isValidTime(shift.end))
          errors.push(`Horario no válido en "${shift.name || "turno"}" (formato HH:MM).`);
        if (shift.start === shift.end)
          errors.push(`El turno "${shift.name || "turno"}" no puede empezar y acabar a la misma hora.`);
        return errors;
      }),
    [draftShifts],
  );

  const categoriesDirty = JSON.stringify(draftCategories) !== JSON.stringify(categories);
  const shiftsDirty = JSON.stringify(draftShifts) !== JSON.stringify(shifts);

  const orderedPreview = useMemo(
    () => [...draftCategories].sort((a, b) => a.min - b.min),
    [draftCategories],
  );

  return (
    <div className="space-y-4">
      <Section
        title="Categorías de carga (reglas de negocio configurables)"
        description="Los umbrales de ocupación no están fijados en el código: al guardarlos, todas las categorías de agente se recalculan automáticamente."
        dirty={categoriesDirty}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraftCategories((list) => [
                  ...list,
                  {
                    id: `cat-${Date.now()}`,
                    name: "Nueva categoría",
                    min: 0,
                    max: 0,
                    status: "balanced",
                    order: list.length + 1,
                  },
                ])
              }
            >
              <Plus className="size-3.5" /> Añadir categoría
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraftCategories(DEFAULT_CATEGORIES)}
            >
              <RotateCcw className="size-3.5" /> Valores por defecto
            </Button>
            {categoriesDirty && (
              <Button size="sm" variant="ghost" onClick={() => setDraftCategories(categories)}>
                Descartar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {draftCategories.map((category, index) => (
            <div
              key={category.id}
              className="border-border/60 grid gap-2 rounded-sm border p-2 md:grid-cols-[1.4fr_repeat(3,0.8fr)_0.6fr_auto] md:items-end md:border-0 md:p-0"
            >
              <div className="space-y-1">
                <Label htmlFor={`cat-name-${category.id}`} className="text-xs">
                  Nombre
                </Label>
                <Input
                  id={`cat-name-${category.id}`}
                  value={category.name}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cat-min-${category.id}`} className="text-xs">
                  Mínimo %
                </Label>
                <Input
                  id={`cat-min-${category.id}`}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={category.min}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, min: Number(e.target.value) } : c)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cat-max-${category.id}`} className="text-xs">
                  Máximo %
                </Label>
                <Input
                  id={`cat-max-${category.id}`}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
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
                  <SelectTrigger aria-label={`Estado visual de ${category.name}`}>
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
                <Label htmlFor={`cat-order-${category.id}`} className="text-xs">
                  Orden
                </Label>
                <Input
                  id={`cat-order-${category.id}`}
                  type="number"
                  value={category.order}
                  onChange={(e) =>
                    setDraftCategories((list) =>
                      list.map((c, i) => (i === index ? { ...c, order: Number(e.target.value) } : c)),
                    )
                  }
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Eliminar categoría ${category.name}`}
                disabled={draftCategories.length <= 1}
                onClick={() => setDraftCategories((list) => list.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-border/60 bg-surface rounded-sm border p-2">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Umbrales resultantes
          </p>
          <p className="mt-1 font-mono text-xs">
            {orderedPreview
              .map(
                (c) =>
                  `${c.name}: ${c.min.toString().replace(".", ",")}% – ${c.max
                    .toString()
                    .replace(".", ",")}%`,
              )
              .join("  ·  ")}
          </p>
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
          disabled={categoryErrors.length > 0 || !categoriesDirty}
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
        description="Cada agente se asigna automáticamente al horario configurado que más se solapa con el inicio y fin de sus sesiones. Los turnos que cruzan medianoche están soportados."
        dirty={shiftsDirty}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraftShifts((list) => [
                  ...list,
                  { id: `shift-${Date.now()}`, name: "Nuevo turno", start: "09:00", end: "17:00" },
                ])
              }
            >
              <Plus className="size-3.5" /> Añadir turno
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraftShifts(DEFAULT_SHIFTS)}>
              <RotateCcw className="size-3.5" /> Valores por defecto
            </Button>
            {shiftsDirty && (
              <Button size="sm" variant="ghost" onClick={() => setDraftShifts(shifts)}>
                Descartar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {draftShifts.map((shift, index) => (
            <div
              key={shift.id}
              className="border-border/60 grid gap-2 rounded-sm border p-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_1fr_auto] md:items-end md:border-0 md:p-0"
            >
              <div className="space-y-1">
                <Label htmlFor={`shift-name-${shift.id}`} className="text-xs">
                  Nombre
                </Label>
                <Input
                  id={`shift-name-${shift.id}`}
                  value={shift.name}
                  onChange={(e) =>
                    setDraftShifts((list) =>
                      list.map((s, i) =>
                        i === index
                          ? { ...s, name: e.target.value, id: s.id || slug(e.target.value) }
                          : s,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`shift-start-${shift.id}`} className="text-xs">
                  Inicio
                </Label>
                <Input
                  id={`shift-start-${shift.id}`}
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
                <Label htmlFor={`shift-end-${shift.id}`} className="text-xs">
                  Fin
                </Label>
                <Input
                  id={`shift-end-${shift.id}`}
                  type="time"
                  value={shift.end}
                  onChange={(e) =>
                    setDraftShifts((list) =>
                      list.map((s, i) => (i === index ? { ...s, end: e.target.value } : s)),
                    )
                  }
                />
              </div>
              <p className="text-muted-foreground text-xs md:pb-2">{shiftDurationLabel(shift)}</p>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Eliminar turno ${shift.name}`}
                onClick={() => setDraftShifts((list) => list.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={shiftErrors.length > 0 || !shiftsDirty}
            onClick={() => {
              setShifts(draftShifts);
              toast.success("Turnos actualizados");
            }}
          >
            Guardar turnos
          </Button>
          {draftShifts.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Sin turnos configurados todos los agentes aparecerán como «Sin turno asignado».
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
