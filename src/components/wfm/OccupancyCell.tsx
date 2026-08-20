import {
  AlertTriangle,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Equal,
  type LucideIcon,
} from "lucide-react";
import type { LoadCategory } from "@/lib/wfm/types";
import { cn } from "@/lib/utils";

type Status = LoadCategory["status"];

const STATUS_BAR: Record<Status, string> = {
  low: "bg-status-low",
  "moderate-low": "bg-status-moderate",
  balanced: "bg-status-balanced",
  high: "bg-status-warning",
  "very-high": "bg-status-high",
  critical: "bg-status-critical",
};

const STATUS_TEXT: Record<Status, string> = {
  low: "text-status-low-foreground",
  "moderate-low": "text-status-moderate-foreground",
  balanced: "text-status-balanced-foreground",
  high: "text-status-warning-foreground",
  "very-high": "text-status-high-foreground",
  critical: "text-status-critical-foreground",
};

/** Icono semántico por estado: la distinción no depende solo del color. */
export const STATUS_ICON: Record<Status, LucideIcon> = {
  low: ArrowDown,
  "moderate-low": ArrowDownRight,
  balanced: Equal,
  high: ArrowUpRight,
  "very-high": ArrowUp,
  critical: AlertTriangle,
};

/** Acento lateral del chip de estado (superficie neutra + borde de color). */
export const STATUS_ACCENT: Record<Status, string> = {
  low: "border-l-status-low",
  "moderate-low": "border-l-status-moderate",
  balanced: "border-l-status-balanced",
  high: "border-l-status-warning",
  "very-high": "border-l-status-high",
  critical: "border-l-status-critical",
};

export const STATUS_TEXT_CLASS = STATUS_TEXT;

/** Etiqueta corta de carga, legible también en escala de grises. */
export const STATUS_LABEL: Record<Status, string> = {
  low: "Carga baja",
  "moderate-low": "Carga moderadamente baja",
  balanced: "Carga equilibrada",
  high: "Carga alta",
  "very-high": "Carga muy alta",
  critical: "Carga crítica",
};

/** Rango compacto y directo: «≤ 55%», «60–75%», «≥ 90,01%». */
export function formatRange(min: number, max: number): string {
  const n = (value: number) =>
    `${Number(value.toFixed(2)).toString().replace(".", ",")}%`;
  if (min <= 0 && max >= 100) return "0–100%";
  if (min <= 0) return `≤ ${n(max)}`;
  if (max >= 100) return `≥ ${n(min)}`;
  return `${n(min).replace("%", "")}–${n(max)}`;
}

export function OccupancyCell({
  occupancy,
  category,
}: {
  occupancy: number | null;
  category: LoadCategory | null;
}) {
  if (occupancy === null) {
    return <span className="text-muted-foreground text-xs">Sin datos</span>;
  }
  const status = category?.status ?? "balanced";
  const width = Math.max(2, Math.min(100, occupancy));

  return (
    <div className="min-w-[110px]">
      <div className="bg-muted relative h-5 overflow-hidden rounded-sm">
        <div
          className={cn("absolute inset-y-0 left-0 opacity-80", STATUS_BAR[status])}
          style={{ width: `${width}%` }}
        />
        <span
          className={cn(
            "relative flex h-full items-center justify-end px-1.5 font-mono text-xs font-semibold tabular-nums",
            STATUS_TEXT[status],
          )}
        >
          {occupancy.toFixed(1).replace(".", ",")}%
        </span>
      </div>
    </div>
  );
}

/**
 * Chip rectangular de estado: superficie neutra, acento lateral de color,
 * icono semántico y texto de alto contraste. Mismo lenguaje visual en
 * configuración y en el panel de agentes.
 */
export function CategoryBadge({
  category,
  showRange = false,
}: {
  category: LoadCategory | null;
  showRange?: boolean;
}) {
  if (!category) return <span className="text-muted-foreground text-xs">Sin categoría</span>;
  const Icon = STATUS_ICON[category.status];

  return (
    <span
      className={cn(
        "border-border bg-card text-foreground inline-flex items-center gap-1.5 rounded-sm border border-l-[3px] px-2 py-1 text-xs leading-none font-medium",
        STATUS_ACCENT[category.status],
      )}
      title={STATUS_LABEL[category.status]}
    >
      <Icon
        className={cn("size-3.5 shrink-0", STATUS_TEXT[category.status])}
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <span className="truncate">{category.name}</span>
      {showRange && (
        <span className="text-muted-foreground border-border/70 ml-0.5 border-l pl-1.5 font-mono tabular-nums">
          {formatRange(category.min, category.max)}
        </span>
      )}
      <span className="sr-only">({STATUS_LABEL[category.status]})</span>
    </span>
  );
}
