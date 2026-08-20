import type { LoadCategory } from "@/lib/wfm/types";
import { cn } from "@/lib/utils";

const STATUS_BAR: Record<LoadCategory["status"], string> = {
  low: "bg-status-low",
  "moderate-low": "bg-status-moderate",
  balanced: "bg-status-balanced",
  high: "bg-status-warning",
  "very-high": "bg-status-high",
  critical: "bg-status-critical",
};

const STATUS_TEXT: Record<LoadCategory["status"], string> = {
  low: "text-status-low-foreground",
  "moderate-low": "text-status-moderate-foreground",
  balanced: "text-status-balanced-foreground",
  high: "text-status-warning-foreground",
  "very-high": "text-status-high-foreground",
  critical: "text-status-critical-foreground",
};

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

export function CategoryBadge({ category }: { category: LoadCategory | null }) {
  if (!category) return <span className="text-muted-foreground text-xs">Sin categoría</span>;
  const map: Record<LoadCategory["status"], string> = {
    low: "border-status-low/40 bg-status-low/15 text-status-low-foreground",
    "moderate-low":
      "border-status-moderate/40 bg-status-moderate/15 text-status-moderate-foreground",
    balanced: "border-status-balanced/40 bg-status-balanced/15 text-status-balanced-foreground",
    high: "border-status-warning/40 bg-status-warning/15 text-status-warning-foreground",
    "very-high": "border-status-high/40 bg-status-high/15 text-status-high-foreground",
    critical: "border-status-critical/40 bg-status-critical/15 text-status-critical-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        map[category.status],
      )}
    >
      {category.name}
    </span>
  );
}
