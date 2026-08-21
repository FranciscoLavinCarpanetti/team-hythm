import * as XLSX from "xlsx";
import type { DataQuality, ParseIssue, ParseResult, SessionRecord } from "./types";
import { parseDateValue, parseDurationToSeconds, parseNumber, toDateKey } from "./time";

export class ExcelValidationError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "ExcelValidationError";
    this.details = details;
  }
}

/** Canonical column keys mapped to accepted header names (normalized). */
const COLUMN_MAP: Record<string, string[]> = {
  sessionId: ["sesion", "sesión", "session"],
  agent: ["agente", "agent"],
  desk: ["pupitre", "desk"],
  start: ["inicio sesion", "inicio sesión", "inicio de sesion"],
  end: ["fin sesion", "fin sesión", "fin de sesion"],
  sessionTime: ["(ws) tiempo de sesion", "(ws) tiempo de sesión", "tiempo de sesion", "ws"],
  calls: [
    "(tc-s) total llamadas sesion",
    "(tc-s) total llamadas sesión",
    "total llamadas sesion",
    "tc-s",
  ],
  conversation: [
    "(tt) tiempo en conversacion",
    "(tt) tiempo en conversación",
    "tiempo en conversacion",
    "tt",
  ],
  acw: ["(acw) tiempo gestion llamada", "(acw) tiempo gestión llamada", "acw"],
  productive: ["(tpt) total tiempo productivo", "total tiempo productivo", "tpt"],
};

const REQUIRED = [
  "sessionId",
  "agent",
  "start",
  "end",
  "sessionTime",
  "calls",
  "conversation",
  "acw",
  "productive",
] as const;

const LABELS: Record<string, string> = {
  sessionId: "Sesión",
  agent: "Agente",
  start: "Inicio sesión",
  end: "Fin sesión",
  sessionTime: "(WS) Tiempo de sesión",
  calls: "(TC-S) Total llamadas sesión",
  conversation: "(TT) Tiempo en conversación",
  acw: "(ACW) Tiempo gestión llamada",
  productive: "(TPT) Total tiempo productivo",
};

function normalize(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function resolveColumns(headers: string[]): Record<string, string> {
  const resolved: Record<string, string> = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  for (const [key, aliases] of Object.entries(COLUMN_MAP)) {
    const normAliases = aliases.map(normalize);
    const hit =
      normalized.find((h) => normAliases.includes(h.norm)) ??
      normalized.find((h) => normAliases.some((a) => h.norm.includes(a)));
    if (hit) resolved[key] = hit.raw;
  }
  return resolved;
}

export async function parseSessionsWorkbook(file: File): Promise<ParseResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new ExcelValidationError("El archivo debe tener formato .xlsx");
  }

  let rows: Record<string, unknown>[];
  let headers: string[];
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("empty");
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
    const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0 });
    headers = ((headerMatrix[0] as unknown[]) ?? []).map((h) => String(h ?? ""));
  } catch {
    throw new ExcelValidationError(
      "No se ha podido leer la estructura del Excel. Comprueba que el archivo no está dañado.",
    );
  }

  const columns = resolveColumns(headers);
  const col = (key: string): string => columns[key] ?? "";
  const missing = REQUIRED.filter((key) => !columns[key]).map((key) => LABELS[key] ?? key);
  if (missing.length) {
    throw new ExcelValidationError("Faltan columnas obligatorias en el Excel", missing);
  }
  if (!rows.length) {
    throw new ExcelValidationError("El Excel no contiene filas de sesiones.");
  }

  const issues: ParseIssue[] = [];
  const records: SessionRecord[] = [];
  /** Deterministic composite key over available session-level fields. */
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const agent = String(row[col("agent")] ?? "").trim();
    const sessionId = String(row[col("sessionId")] ?? "").trim();
    // Día operativo de la fila (inicio, con fallback a fin): se calcula antes de
    // cualquier descarte para que la calidad de datos pueda filtrarse por período.
    const rowStart = parseDateValue(row[col("start")]);
    const rowEnd = parseDateValue(row[col("end")]);
    const rowReference = rowStart ?? rowEnd;
    const rowDate = rowReference ? toDateKey(rowReference) : null;
    if (!agent || !sessionId) {
      issues.push({
        row: rowNumber,
        sessionId: sessionId || null,
        agent: agent || null,
        kind: "missing-key",
        severity: "error",
        operationalDate: rowDate,
        message: "Fila descartada: falta el agente o el identificador de sesión.",
      });
      return;
    }

    const key = `${sessionId}|${agent}`;
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "duplicate",
        severity: "warning",
        operationalDate: rowDate,
        message: "Duplicado detectado (misma sesión y agente): excluido del agregado.",
      });
      return;
    }

    const durations = {
      sessionSeconds: parseDurationToSeconds(row[col("sessionTime")]),
      conversationSeconds: parseDurationToSeconds(row[col("conversation")]),
      acwSeconds: parseDurationToSeconds(row[col("acw")]),
      productiveSeconds: parseDurationToSeconds(row[col("productive")]),
    };
    const invalidDuration = Object.entries(durations).find(([, v]) => v === null);
    if (invalidDuration) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "invalid-duration",
        severity: "error",
        operationalDate: rowDate,
        message: `Fila descartada: valor de duración no válido en ${invalidDuration[0]}.`,
      });
      return;
    }

    const calls = parseNumber(row[col("calls")]);
    if (calls === null || calls < 0) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "invalid-calls",
        severity: "error",
        operationalDate: rowDate,
        message: "Fila descartada: número de llamadas no válido.",
      });
      return;
    }

    const start = rowStart;
    const end = rowEnd;
    if (!start && !end) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "invalid-dates",
        severity: "warning",
        operationalDate: rowDate,
        message: "Sesión sin fechas válidas: no se puede asignar turno ni fecha operativa.",
      });
    }

    if (calls === 0) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "zero-calls",
        severity: "warning",
        operationalDate: rowDate,
        message: "Sesión sin llamadas registradas.",
      });
    }

    if (durations.productiveSeconds! > durations.sessionSeconds!) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        kind: "productive-exceeds-session",
        severity: "warning",
        operationalDate: rowDate,
        message: "Anomalía: el tiempo productivo supera el tiempo de sesión.",
      });
    }

    const reference = start ?? end;
    seen.add(key);
    records.push({
      sessionId,
      agent,
      desk: columns["desk"] ? String(row[col("desk")] ?? "").trim() : "",
      start,
      end,
      operationalDate: reference ? toDateKey(reference) : null,
      sessionSeconds: durations.sessionSeconds!,
      calls: Math.round(calls),
      conversationSeconds: durations.conversationSeconds!,
      acwSeconds: durations.acwSeconds!,
      productiveSeconds: durations.productiveSeconds!,
    });
  });

  if (!records.length) {
    throw new ExcelValidationError(
      "No se ha podido importar ninguna sesión válida del archivo.",
      issues.slice(0, 5).map((w) => `Fila ${w.row}: ${w.message}`),
    );
  }

  const dates = Array.from(
    new Set(records.map((r) => r.operationalDate).filter((d): d is string => Boolean(d))),
  ).sort();

  const quality: DataQuality = {
    totalRows: rows.length,
    validRows: records.length,
    invalidRows: issues.filter((i) => i.severity === "error").length,
    duplicateRows: duplicatesRemoved,
    agents: new Set(records.map((r) => r.agent)).size,
    zeroCallSessions: issues.filter((i) => i.kind === "zero-calls").length,
    anomalousSessions: issues.filter((i) => i.kind === "productive-exceeds-session").length,
  };

  return { records, issues, duplicatesRemoved, dates, quality, fileName: file.name };
}
