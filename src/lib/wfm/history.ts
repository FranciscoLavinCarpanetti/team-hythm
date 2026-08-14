import type { ImportMeta, ImportSnapshot, ParseResult, SessionRecord } from "./types";

const HISTORY_KEY = "wfm-history-v1";
const MAX_ENTRIES = 8;

type StoredRecord = Omit<SessionRecord, "start" | "end"> & {
  start: string | null;
  end: string | null;
};

type StoredSnapshot = Omit<ImportSnapshot, "records"> & { records: StoredRecord[] };

function serialize(records: SessionRecord[]): StoredRecord[] {
  return records.map((r) => ({
    ...r,
    start: r.start ? r.start.toISOString() : null,
    end: r.end ? r.end.toISOString() : null,
  }));
}

function deserialize(records: StoredRecord[]): SessionRecord[] {
  return records.map((r) => ({
    ...r,
    start: r.start ? new Date(r.start) : null,
    end: r.end ? new Date(r.end) : null,
  }));
}

function read(): StoredSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(snapshots: StoredSnapshot[]): StoredSnapshot[] {
  if (typeof window === "undefined") return snapshots;
  let list = snapshots.slice(0, MAX_ENTRIES);
  for (;;) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return list;
    } catch {
      // Quota exceeded: drop session rows of the oldest entries, keeping metadata.
      const trimmable = [...list].reverse().find((s) => s.records.length > 0);
      if (!trimmable) {
        try {
          window.localStorage.removeItem(HISTORY_KEY);
        } catch {
          /* ignore */
        }
        return [];
      }
      list = list.map((s) =>
        s.meta.id === trimmable.meta.id
          ? { ...s, records: [], meta: { ...s.meta, hasRecords: false } }
          : s,
      );
    }
  }
}

export function buildMeta(result: ParseResult, id: string, importedAt: Date): ImportMeta {
  return {
    id,
    fileName: result.fileName,
    importedAt: importedAt.toISOString(),
    rowCount: result.quality.totalRows,
    validRows: result.quality.validRows,
    invalidRows: result.quality.invalidRows,
    duplicateRows: result.quality.duplicateRows,
    agents: result.quality.agents,
    dateFrom: result.dates[0] ?? null,
    dateTo: result.dates[result.dates.length - 1] ?? null,
    hasRecords: true,
  };
}

export function listHistory(): ImportMeta[] {
  return read().map((s) => s.meta);
}

export function getSnapshot(id: string): ImportSnapshot | null {
  const found = read().find((s) => s.meta.id === id);
  if (!found) return null;
  return { ...found, records: deserialize(found.records) };
}

export function saveSnapshot(snapshot: ImportSnapshot): ImportMeta[] {
  const stored: StoredSnapshot = { ...snapshot, records: serialize(snapshot.records) };
  const next = write([stored, ...read().filter((s) => s.meta.id !== snapshot.meta.id)]);
  return next.map((s) => s.meta);
}

export function deleteSnapshot(id: string): ImportMeta[] {
  return write(read().filter((s) => s.meta.id !== id)).map((s) => s.meta);
}

export function clearHistory(): ImportMeta[] {
  return write([]).map((s) => s.meta);
}
