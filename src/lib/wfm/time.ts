/** Duration/date parsing + formatting helpers for WFM data. */

export function parseDurationToSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (raw instanceof Date) {
    return raw.getUTCHours() * 3600 + raw.getUTCMinutes() * 60 + raw.getUTCSeconds();
  }
  if (typeof raw === "number") {
    if (!isFinite(raw) || raw < 0) return null;
    // Excel serial fraction of a day
    if (raw < 10) return Math.round(raw * 86400);
    return Math.round(raw);
  }
  const text = String(raw).trim();
  if (!text) return 0;
  const m = text.match(/^(-?\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] ? Number(m[3]) : 0;
  if (h < 0) return null;
  return h * 3600 + min * 60 + s;
}

export function formatSeconds(total: number): string {
  if (!isFinite(total) || total < 0) return "00:00:00";
  const t = Math.round(total);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function parseDateValue(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const text = String(raw).trim();
  if (!text) return null;
  // dd/MM/yyyy HH:mm(:ss)?
  const m = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    );
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(text);
  return isNaN(iso.getTime()) ? null : iso;
}

export function toDateKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  const text = String(raw).replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!text) return 0;
  const n = Number(text);
  return isFinite(n) ? n : null;
}
