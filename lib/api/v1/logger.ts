/**
 * One structured JSON line per API call, with anything secret removed.
 *
 * Logs end up in Vercel's log drain and in screenshots people send. So a log line
 * carries identifiers (request id, user id, route, status, timing) and never a
 * token, a password, a card detail or a request body.
 */

const SECRET_KEY = /authorization|cookie|token|password|passwd|secret|refresh|^otp$|card|cvv|iban|signature|api[-_]?key/i;

/** Copies a value with every secret-looking key replaced. Bounded depth, never throws. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value === null || typeof value !== "object") return typeof value === "string" && value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export interface ApiLogEntry {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  userId?: string;
  role?: string;
  errorCode?: string;
  /** Anything extra worth knowing. Redacted before it is written. */
  extra?: Record<string, unknown>;
}

export type LogSink = (line: string) => void;

let sink: LogSink = (line) => console.log(line);

/** Tests replace the sink to read what was logged. */
export function setLogSink(next: LogSink): void {
  sink = next;
}

export function logApi(entry: ApiLogEntry): void {
  try {
    sink(JSON.stringify({ level: entry.status >= 500 ? "error" : "info", at: new Date().toISOString(), api: "v1", ...(redact(entry) as object) }));
  } catch {
    /* logging must never break a request */
  }
}
