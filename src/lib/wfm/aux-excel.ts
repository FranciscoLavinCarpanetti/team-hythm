import * as XLSX from "xlsx";
import type { AuxIssue, AuxParseResult, AuxRecord } from "./aux-types";
import { parseDateValue, parseDurationToSeconds, toDateKey } from "./time";
import { ExcelValidationError } from "./excel";

/** Columnas canónicas → cabeceras aceptadas (detección por nombre, no por posición). */
const COLUMN_MAP: Record<string, string[]> = {
  sessionId: ["sesion", "sesión", "session"],
  agent: ["agente", "agent"],
  desk: ["pupitre", "desk"],
  state: ["estado aux", "estado", "aux state"],
  start: ["inicio estado", "inicio", "start"],
  end: ["fin estado", "fin", "end"],
  taux: ["taux", "(taux)", "duracion estado", "duración estado"],
};

const REQUIRED = ["sessionId", "agent", "state", "start", "end", "taux"] as const;

const LABELS: Record<string, string> = {
  sessionId: "Sesión",
  agent: "Agente",
  state: "Estado AUX",
  start: "Inicio estado",
  end: "Fin estado",
  taux: "TAUX",
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

/**
 * Clave normalizada del estado AUX: sin acentos, en minúsculas y sin sufijos
 * paramétricos como «(30')», de modo que «Descanso (30')» y «Descanso» comparten
 * la misma configuración de macro-categoría.
 */
export function normalizeStateKey(raw: string): string {
  return normalize(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[·:.\-–]+$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export async function parseAuxWorkbook(file: File): Promise<AuxParseResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new ExcelValidationError("El archivo AUX debe tener formato .xlsx");
  }

  let rows: Record<string, unknown>[];
  let headers: string[];
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("empty");
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0 });
    headers = ((matrix[0] as unknown[]) ?? []).map((h) => String(h ?? ""));
  } catch {
    throw new ExcelValidationError(
      "No se ha podido leer la estructura del Excel de estados AUX. Comprueba que el archivo no está dañado.",
    );
  }

  const columns = resolveColumns(headers);
  const col = (key: string): string => columns[key] ?? "";
  const missing = REQUIRED.filter((key) => !columns[key]).map((key) => LABELS[key] ?? key);
  if (missing.length) {
    throw new ExcelValidationError("Faltan columnas obligatorias en el Excel de estados AUX", missing);
  }
  if (!rows.length) {
    throw new ExcelValidationError("El Excel de estados AUX no contiene filas.");
  }

  const issues: AuxIssue[] = [];
  const records: AuxRecord[] = [];
  const seen = new Set<string>();
  const states = new Map<string, { raw: string; count: number }>();
  let duplicatesRemoved = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sessionId = String(row[col("sessionId")] ?? "").trim();
    const agent = String(row[col("agent")] ?? "").trim();
    const rawState = String(row[col("state")] ?? "").trim();
    const start = parseDateValue(row[col("start")]);
    const end = parseDateValue(row[col("end")]);
    const operationalDate = start ?? end ? toDateKey((start ?? end)!) : null;

    if (!sessionId || !agent) {
      issues.push({
        row: rowNumber,
        sessionId: sessionId || null,
        agent: agent || null,
        state: rawState || null,
        kind: "missing-key",
        severity: "error",
        operationalDate,
        message: "Fila AUX descartada: falta el agente o el identificador de sesión.",
      });
      return;
    }
    if (!rawState) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        state: null,
        kind: "invalid-state",
        severity: "error",
        operationalDate,
        message: "Fila AUX descartada: el estado AUX está vacío.",
      });
      return;
    }
    if (!start || !end || end.getTime() < start.getTime()) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        state: rawState,
        kind: "invalid-dates",
        severity: "error",
        operationalDate,
        message: "Fila AUX descartada: inicio o fin de estado no válidos.",
      });
      return;
    }
    const tauxSeconds = parseDurationToSeconds(row[col("taux")]);
    if (tauxSeconds === null || tauxSeconds < 0) {
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        state: rawState,
        kind: "invalid-duration",
        severity: "error",
        operationalDate,
        message: "Fila AUX descartada: duración TAUX no válida.",
      });
      return;
    }

    const stateKey = normalizeStateKey(rawState);
    const identity = `${sessionId}|${agent}|${stateKey}|${start.getTime()}|${end.getTime()}`;
    if (seen.has(identity)) {
      duplicatesRemoved += 1;
      issues.push({
        row: rowNumber,
        sessionId,
        agent,
        state: rawState,
        kind: "duplicate",
        severity: "warning",
        operationalDate,
        message: "Registro AUX duplicado (misma sesión, agente, estado e intervalo): no se cuenta dos veces.",
      });
      return;
    }
    seen.add(identity);

    const known = states.get(stateKey);
    if (known) known.count += 1;
    else states.set(stateKey, { raw: rawState, count: 1 });

    records.push({
      row: rowNumber,
      sessionId,
      agent,
      desk: columns["desk"] ? String(row[col("desk")] ?? "").trim() : "",
      rawState,
      stateKey,
      start,
      end,
      tauxSeconds,
    });
  });

  if (!records.length) {
    throw new ExcelValidationError(
      "No se ha podido importar ningún estado AUX válido del archivo.",
      issues.slice(0, 5).map((i) => `Fila ${i.row}: ${i.message}`),
    );
  }

  const dates = Array.from(new Set(records.map((r) => toDateKey(r.start)))).sort();

  return {
    records,
    issues,
    duplicatesRemoved,
    states: Array.from(states.entries())
      .map(([key, value]) => ({ key, raw: value.raw, count: value.count }))
      .sort((a, b) => b.count - a.count),
    dates,
    fileName: file.name,
    totalRows: rows.length,
  };
}
