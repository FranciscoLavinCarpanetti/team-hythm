import type { CategorySlice } from "@/lib/wfm/analysis";
import { cn } from "@/lib/utils";

const BAR: Record<string, string> = {
  low: "bg-status-low",
  "moderate-low": "bg-status-moderate",
  balanced: "bg-status-balanced",
  high: "bg-status-warning",
  "very-high": "bg-status-high",
  critical: "bg-status-critical",
  none: "bg-muted-foreground/40",
};

export function statusBarClass(status: string | null): string {
  return BAR[status ?? "none"] ?? BAR["none"]!;
}

export function LoadDistribution({
  slices,
  total,
  title = "Distribución de carga del equipo",
  compact = false,
}: {
  slices: CategorySlice[];
  total: number;
  title?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card shadow-card rounded-md border",
        compact ? "p-3" : "space-y-3 p-4",
      )}
      aria-label={title}
    >
      {!compact && (
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold tracking-wide uppercase">{title}</h2>
          <p className="text-muted-foreground text-xs">{total} agentes</p>
        </div>
      )}

      <div className="flex h-2.5 w-full overflow-hidden rounded-sm" role="presentation">
        {slices.map((slice) => (
          <div
            key={slice.key}
            className={statusBarClass(slice.status)}
            style={{ width: `${slice.percentage}%` }}
            title={`${slice.name}: ${slice.count}`}
          />
        ))}
      </div>

      <ul className={cn("grid gap-2 sm:grid-cols-2", compact ? "mt-3" : "")}>
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="border-border/70 flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn("size-2.5 shrink-0 rounded-[2px]", statusBarClass(slice.status))}
                aria-hidden="true"
              />
              <span className="truncate text-xs font-medium">{slice.name}</span>
            </span>
            <span className="font-mono text-xs tabular-nums">
              {slice.count}
              <span className="text-muted-foreground">
                {" "}
                · {slice.percentage.toFixed(1).replace(".", ",")}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
