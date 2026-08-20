import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Target, Trash2 } from "lucide-react";
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
import {
  DEFAULT_CATEGORIES,
  DEFAULT_OCCUPANCY_TARGET,
  DEFAULT_OCCUPANCY_TOLERANCE,
  DEFAULT_SHIFTS,
  MAX_OCCUPANCY_TOLERANCE,
  useWfm,
} from "@/lib/wfm/store";
import {
  aggregateAgents,
  isValidTime,
  shiftDurationLabel,
  validateCategories,
} from "@/lib/wfm/aggregate";
import { formatSeconds } from "@/lib/wfm/time";
import {
  CategoryBadge,
  STATUS_ICON,
  STATUS_LABEL,
  STATUS_TEXT_CLASS,
  formatRange,
} from "./OccupancyCell";
import { cn } from "@/lib/utils";
import type { CategoryStatus, LoadCategory, Shift } from "@/lib/wfm/types";

const STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: "low", label: STATUS_LABEL["low"] },
  { value: "moderate-low", label: STATUS_LABEL["moderate-low"] },
  { value: "balanced", label: STATUS_LABEL["balanced"] },
  { value: "high", label: STATUS_LABEL["high"] },
  { value: "very-high", label: STATUS_LABEL["very-high"] },
  { value: "critical", label: STATUS_LABEL["critical"] },
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
    occupancyTargetPercent,
    occupancyTolerancePoints,
    setOccupancyTargetPercent,
    setOccupancyTolerancePoints,
    records,
  } = useWfm();
  const [draftTarget, setDraftTarget] = useState<string>(String(occupancyTargetPercent));
  const [draftTolerance, setDraftTolerance] = useState<string>(String(occupancyTolerancePoints));
  const [draftCategories, setDraftCategories] = useState<LoadCategory[]>(categories);
  const [draftShifts, setDraftShifts] = useState<Shift[]>(shifts);
  const [draftAdjustment, setDraftAdjustment] = useState<string>(String(expectedAdjustmentPercent));

  useEffect(() => setDraftCategories(categories), [categories]);
  useEffect(() => setDraftShifts(shifts), [shifts]);
  useEffect(() => setDraftAdjustment(String(expectedAdjustmentPercent)), [expectedAdjustmentPercent]);
  useEffect(() => setDraftTarget(String(occupancyTargetPercent)), [occupancyTargetPercent]);
  useEffect(() => setDraftTolerance(String(occupancyTolerancePoints)), [occupancyTolerancePoints]);

  const targetValue = Number(draftTarget.replace(",", "."));
  const toleranceValue = Number(draftTolerance.replace(",", "."));
  const targetInvalid = !Number.isFinite(targetValue) || targetValue < 0 || targetValue > 100;
  const toleranceInvalid =
    !Number.isFinite(toleranceValue) ||
    toleranceValue < 0 ||
    toleranceValue > MAX_OCCUPANCY_TOLERANCE;
  const paramsDirty =
    (!targetInvalid && targetValue !== occupancyTargetPercent) ||
    (!toleranceInvalid && toleranceValue !== occupancyTolerancePoints);

  const adjustmentValue = Number(draftAdjustment.replace(",", "."));
  const adjustmentInvalid = !Number.isFinite(adjustmentValue) || adjustmentValue < -100;
  const adjustmentDirty = !adjustmentInvalid && adjustmentValue !== expectedAdjustmentPercent;
  const adjustmentFactor = adjustmentInvalid ? 1 : Math.max(0, 1 + adjustmentValue / 100);

  // Base esperada real del dataset importado (sin ajuste), para que la vista previa
  // coincida con «Esp.» de Operación.
  const baseExpectedSeconds = useMemo(
    () =>
      aggregateAgents(records, shifts, categories, 0).reduce(
        (total, agent) => total + agent.expectedActiveSeconds,
        0,
      ),
    [records, shifts, categories],
  );
  const agentCount = useMemo(() => new Set(records.map((r) => r.agent)).size, [records]);
  const previewBase = formatSeconds(baseExpectedSeconds);
  const previewExample = formatSeconds(baseExpectedSeconds * adjustmentFactor);

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
        title="Ajuste de horas esperadas"
        description="Porcentaje positivo o negativo aplicado a la jornada activa esperada (7:30 h por día trabajado). Afecta a «T. Inactivo Esp.» y al tiempo inactivo de cada agente."
        dirty={adjustmentDirty}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setDraftAdjustment("0")}>
              <RotateCcw className="size-3.5" /> Sin ajuste
            </Button>
            {adjustmentDirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraftAdjustment(String(expectedAdjustmentPercent))}
              >
                Descartar
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-[200px_1fr] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="expected-adjustment" className="text-xs">
              Ajuste %
            </Label>
            <Input
              id="expected-adjustment"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={draftAdjustment}
              onChange={(e) => setDraftAdjustment(e.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-xs md:pb-2">
            {records.length === 0 ? (
              "Importa un Excel para ver la jornada esperada resultante."
            ) : (
              <>
                Datos importados: {agentCount} agente(s) · esperado sin ajuste{" "}
                <span className="font-mono">{previewBase}</span> · con este ajuste ={" "}
                <span className="text-foreground font-mono font-semibold">{previewExample}</span>
              </>
            )}
          </p>
        </div>

        {adjustmentInvalid && (
          <Alert variant="destructive">
            <AlertTitle>Ajuste no válido</AlertTitle>
            <AlertDescription className="text-xs">
              Introduce un número mayor o igual a -100 (por ejemplo -30 o 10).
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="sm"
          disabled={adjustmentInvalid || !adjustmentDirty}
          onClick={() => {
            setExpectedAdjustmentPercent(adjustmentValue);
            toast.success("Ajuste de horas esperadas actualizado");
          }}
        >
          Guardar ajuste
        </Button>
      </Section>

      <Section
        title="Parámetros operativos"
        description="Objetivo de ocupación de referencia (WFM) y tolerancia aceptada. Es una referencia de negocio para interpretar la capacidad, no un SLA contractual ni un límite obligatorio."
        dirty={paramsDirty}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraftTarget(String(DEFAULT_OCCUPANCY_TARGET));
                setDraftTolerance(String(DEFAULT_OCCUPANCY_TOLERANCE));
              }}
            >
              <RotateCcw className="size-3.5" /> Valores por defecto
            </Button>
            {paramsDirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraftTarget(String(occupancyTargetPercent));
                  setDraftTolerance(String(occupancyTolerancePoints));
                }}
              >
                Descartar
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[200px_200px_1fr] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="occupancy-target" className="text-xs">
              Objetivo de ocupación (%)
            </Label>
            <Input
              id="occupancy-target"
              type="number"
              step="0.1"
              min={0}
              max={100}
              inputMode="decimal"
              aria-invalid={targetInvalid}
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="occupancy-tolerance" className="text-xs">
              Tolerancia ± (pp)
            </Label>
            <Input
              id="occupancy-tolerance"
              type="number"
              step="0.1"
              min={0}
              max={MAX_OCCUPANCY_TOLERANCE}
              inputMode="decimal"
              aria-invalid={toleranceInvalid}
              value={draftTolerance}
              onChange={(e) => setDraftTolerance(e.target.value)}
            />
          </div>
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs sm:pb-2">
            <Target className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Rango en objetivo:{" "}
              <span className="text-foreground font-mono font-semibold">
                {targetInvalid || toleranceInvalid
                  ? "—"
                  : `${(targetValue - toleranceValue).toFixed(1).replace(".", ",")}% – ${(targetValue + toleranceValue).toFixed(1).replace(".", ",")}%`}
              </span>
              . Por debajo se interpreta como capacidad por encima del nivel objetivo; por encima,
              como posible sobrecarga.
            </span>
          </p>
        </div>

        {(targetInvalid || toleranceInvalid) && (
          <Alert variant="destructive">
            <AlertTitle>Parámetros no válidos</AlertTitle>
            <AlertDescription className="text-xs">
              El objetivo debe estar entre 0 y 100 %. La tolerancia debe ser un valor en puntos
              porcentuales entre 0 y {MAX_OCCUPANCY_TOLERANCE}.
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="sm"
          disabled={targetInvalid || toleranceInvalid || !paramsDirty}
          onClick={() => {
            setOccupancyTargetPercent(targetValue);
            setOccupancyTolerancePoints(toleranceValue);
            toast.success("Parámetros operativos actualizados");
          }}
        >
          Guardar parámetros
        </Button>
      </Section>

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
                    max: 0.1,
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
        <div className="space-y-2.5">
          {draftCategories.map((category, index) => {
            const Icon = STATUS_ICON[category.status];
            return (
              <div
                key={category.id}
                className="border-border bg-surface/60 rounded-sm border p-3"
              >
                <div className="border-border/70 mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "border-border bg-card flex size-8 shrink-0 items-center justify-center rounded-sm border",
                      )}
                    >
                      <Icon
                        className={cn("size-4", STATUS_TEXT_CLASS[category.status])}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {category.name || "Sin nombre"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {STATUS_LABEL[category.status]} ·{" "}
                        <span className="font-mono tabular-nums">
                          {formatRange(category.min, category.max)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={category} />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Eliminar categoría ${category.name}`}
                      disabled={draftCategories.length <= 1}
                      onClick={() =>
                        setDraftCategories((list) => list.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_0.8fr_0.8fr_1.4fr_0.7fr] lg:items-end">
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
                      className="font-mono tabular-nums"
                      value={category.min}
                      onChange={(e) =>
                        setDraftCategories((list) =>
                          list.map((c, i) =>
                            i === index ? { ...c, min: Number(e.target.value) } : c,
                          ),
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
                      className="font-mono tabular-nums"
                      value={category.max}
                      onChange={(e) =>
                        setDraftCategories((list) =>
                          list.map((c, i) =>
                            i === index ? { ...c, max: Number(e.target.value) } : c,
                          ),
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
                        {STATUS_OPTIONS.map((option) => {
                          const OptionIcon = STATUS_ICON[option.value];
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                                <OptionIcon
                                  className={cn("size-3.5", STATUS_TEXT_CLASS[option.value])}
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                />
                                {option.label}
                              </span>
                            </SelectItem>
                          );
                        })}
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
                      className="font-mono tabular-nums"
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
              </div>
            );
          })}
        </div>

        <div className="border-border/60 bg-surface rounded-sm border p-3">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Umbrales resultantes
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Así se mostrará cada categoría en el panel de agentes.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {orderedPreview.map((c) => (
              <li key={c.id}>
                <CategoryBadge category={c} showRange />
              </li>
            ))}
          </ul>
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
