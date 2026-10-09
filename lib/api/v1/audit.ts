import { logApi } from "./logger";

/**
 * The audit trail for /api/v1.
 *
 * What must be audited: sign-in, sign-out and refresh reuse; every status change
 * on a booking; assigning or rejecting a driver; refunds and payment changes;
 * document approvals; role changes; and every read of another person's location.
 * Each entry says who did it, to what, from which request, and never carries a
 * token, a password or a card detail.
 *
 * Entries go to the existing activity_logs table, the same trail the admin
 * already reads, so no schema change is needed. A failure to write the audit
 * entry is logged loudly but never fails the request that caused it.
 */

export interface AuditEntry {
  /** UPPER_SNAKE, prefixed API_V1_, for example API_V1_BOOKING_STATUS. */
  action: string;
  entity: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  requestId: string;
  ip?: string;
  /** Before and after values, reasons. Redacted by the logger when echoed. */
  details?: Record<string, unknown>;
}

export type AuditSink = (entry: AuditEntry) => Promise<void>;

/** Default sink: the activity_logs table. Imported lazily so tests and tools do not need a database. */
const databaseSink: AuditSink = async (entry) => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.activityLog.create({
    data: {
      adminId: entry.actorId,
      adminName: entry.actorRole,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      ip: entry.ip,
      details: { requestId: entry.requestId, ...(entry.details ?? {}) } as object,
    },
  });
};

let sink: AuditSink = databaseSink;

export function setAuditSink(next: AuditSink): void {
  sink = next;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await sink(entry);
  } catch (e) {
    logApi({
      requestId: entry.requestId,
      method: "AUDIT",
      route: entry.action,
      status: 500,
      durationMs: 0,
      errorCode: "AUDIT_WRITE_FAILED",
      extra: { message: e instanceof Error ? e.message : "unknown" },
    });
  }
}
