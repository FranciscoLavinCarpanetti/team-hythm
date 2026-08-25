import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWfm } from "@/lib/wfm/store";
import {
  DEFAULT_AUX_MAPPING,
  DEFAULT_MACRO_CATEGORIES,
  KNOWN_AUX_STATES,
} from "@/lib/wfm/aux-distribution";
import { normalizeStateKey } from "@/lib/wfm/aux-excel";
import type { AuxMapping, MacroCategory, MacroTone } from "@/lib/wfm/aux-types";
import { TONE_OPTIONS } from "./TimeDistribution";

const UNASSIGNED = "__none__";

/**
 * Configuración → Estados AUX. El mapeo estado → macro-categoría vive en
 * configuración, nunca en la lógica de cálculo.
 */
export function AuxStateConfig() {
  const { macroCategories, auxMapping, setMacroCategories, setAuxMapping, auxMeta, auxRecords } =
    useWfm();
  const [draftMacros, setDraftMacros] = useState<MacroCategory[]>(macroCategories);
  const [draftMapping, setDraftMapping] = useState<AuxMapping>(auxMapping);

  useEffect(() => setDraftMacros(macroCategories), [macroCategories]);
  useEffect(() => setDraftMapping(auxMapping), [auxMapping]);

  const dirty =
    JSON.stringify(draftMacros) !== JSON.stringify(macroCategories) ||
    JSON.stringify(draftMapping) !== JSON.stringify(auxMapping);

  /** Solo los estados AUX oficiales del servicio. */
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const state of auxMeta?.states ?? []) counts.set(state.key, state.count);
    if (!auxMeta) {
      for (const record of auxRecords) {
        counts.set(record.stateKey, (counts.get(record.stateKey) ?? 0) + 1);
      }
    }
    return KNOWN_AUX_STATES.map((state) => ({
      key: state.key,
      raw: state.raw,
      count: counts.get(state.key) ?? 0,
    }));
  }, [auxMeta, auxRecords]);


  const ordered = [...draftMacros].sort((a, b) => a.order - b.order);

  const move = (index: number, delta: number) => {
    const list = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item!);
    setDraftMacros(list.map((macro, i) => ({ ...macro, order: i + 1 })));
  };

  return (
    <section className="border-border bg-card shadow-card space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-3xl">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Estados AUX
            {dirty && (
              <span className="border-status-balanced/50 bg-status-balanced/15 text-status-balanced-foreground rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Cambios sin guardar
              </span>
            )}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Asigna cada estado AUX del fichero a una macro-categoría para el reparto del tiempo de
            sesión. Los estados sin asignar se muestran como «Sin clasificar». Estas categorías son
            descriptivas: ninguna se interpreta como buena o mala.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraftMacros(DEFAULT_MACRO_CATEGORIES);
              setDraftMapping(DEFAULT_AUX_MAPPING);
            }}
          >
            <RotateCcw className="size-3.5" /> Valores por defecto
          </Button>
          <Button
            size="sm"
            disabled={!dirty || draftMacros.some((m) => !m.name.trim())}
            onClick={() => {
              setMacroCategories(draftMacros);
              setAuxMapping(draftMapping);
              toast.success("Configuración de estados AUX actualizada");
            }}
          >
            Guardar estados AUX
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">Macro-categorías</h3>
        {ordered.map((macro, index) => (
          <div
            key={macro.id}
            className="border-border grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_170px_auto_auto]"
          >
            <div className="space-y-1">
              <Label htmlFor={`macro-name-${macro.id}`} className="text-xs">
                Nombre
              </Label>
              <Input
                id={`macro-name-${macro.id}`}
                value={macro.name}
                onChange={(e) =>
                  setDraftMacros((list) =>
                    list.map((m) => (m.id === macro.id ? { ...m, name: e.target.value } : m)),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tratamiento visual</Label>
              <Select
                value={macro.tone}
                onValueChange={(value) =>
                  setDraftMacros((list) =>
                    list.map((m) => (m.id === macro.id ? { ...m, tone: value as MacroTone } : m)),
                  )
                }
              >
                <SelectTrigger aria-label={`Color de ${macro.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Subir ${macro.name}`}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Bajar ${macro.name}`}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Eliminar ${macro.name}`}
                onClick={() => {
                  setDraftMacros((list) => list.filter((m) => m.id !== macro.id));
                  setDraftMapping((mapping) => {
                    const next = { ...mapping };
                    for (const [state, id] of Object.entries(next)) {
                      if (id === macro.id) next[state] = null;
                    }
                    return next;
                  });
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDraftMacros((list) => [
              ...list,
              {
                id: `macro-${Date.now().toString(36)}`,
                name: "Nueva categoría",
                order: list.length + 1,
                tone: "neutral",
              },
            ])
          }
        >
          <Plus className="size-3.5" /> Añadir macro-categoría
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase">
          Asignación de estados
        </h3>
        {states.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Carga el fichero de estados AUX para ver los estados detectados y asignarlos.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-md border">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  {["Estado AUX (fichero)", "Clave normalizada", "Registros", "Macro-categoría"].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="border-border/60 border-b px-2 py-1.5 text-left font-semibold"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {states.map((state) => (
                  <tr key={state.key} className="border-border/60 border-b last:border-0">
                    <td className="px-2 py-1.5">{state.raw}</td>
                    <td className="text-muted-foreground px-2 py-1.5 font-mono">
                      {normalizeStateKey(state.key)}
                    </td>
                    <td className="px-2 py-1.5 font-mono tabular-nums">{state.count}</td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={draftMapping[state.key] ?? UNASSIGNED}
                        onValueChange={(value) =>
                          setDraftMapping((mapping) => ({
                            ...mapping,
                            [state.key]: value === UNASSIGNED ? null : value,
                          }))
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[220px]"
                          aria-label={`Macro-categoría de ${state.raw}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Sin clasificar</SelectItem>
                          {ordered.map((macro) => (
                            <SelectItem key={macro.id} value={macro.id}>
                              {macro.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
