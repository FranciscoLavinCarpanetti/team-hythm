import type { DataQuality, ParseIssue, SessionRecord } from "./types";
import { normalizePeriod, type Period } from "./period";

/** Incidencias cuyo día operativo cae dentro del período seleccionado. */
export function filterIssuesByPeriod(issues: ParseIssue[], period: Period | null): ParseIssue[] {
  if (!period) return issues;
  const { from, to } = normalizePeriod(period);
  return issues.filter(
    (issue) =>
      issue.operationalDate !== null &&
      issue.operationalDate >= from &&
      issue.operationalDate <= to,
  );
}

/** Incidencias sin día operativo: quedan fuera de cualquier período (se informan aparte). */
export function countUndatedIssues(issues: ParseIssue[]): number {
  return issues.filter((issue) => issue.operationalDate === null).length;
}

/**
 * Recalcula los contadores de calidad sobre las filas del período, sin sumar
 * contadores globales de la importación como si fueran diarios.
 */
export function recomputeQuality(
  records: SessionRecord[],
  issues: ParseIssue[],
): DataQuality {
  const invalidRows = issues.filter((i) => i.severity === "error").length;
  const duplicateRows = issues.filter((i) => i.kind === "duplicate").length;
  return {
    totalRows: records.length + invalidRows + duplicateRows,
    validRows: records.length,
    invalidRows,
    duplicateRows,
    agents: new Set(records.map((r) => r.agent)).size,
    zeroCallSessions: issues.filter((i) => i.kind === "zero-calls").length,
    anomalousSessions: issues.filter((i) => i.kind === "productive-exceeds-session").length,
  };
}
