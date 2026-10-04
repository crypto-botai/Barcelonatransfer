import { prisma } from "@/lib/prisma";

/**
 * Where the office's own alerts go.
 *
 * They were all addressed to one mailbox, booking@elitebcn.info, from that same
 * address, over a domain whose mail is hosted by IONOS. Every one was logged as
 * sent and none was ever opened, which is what mail from your own address to
 * your own address looks like to a spam filter. Nobody was reading that mailbox
 * in the first place.
 *
 * So an alert now goes to that address and to the inbox of every administrator,
 * the people who sign in to the admin panel and are the ones who need to act on
 * a lead. The addresses come from the database, so nothing personal is written
 * into the code, and adding an administrator adds an inbox.
 */

const TTL_MS = 10 * 60_000;
const MAX = 5;
let cache: { at: number; emails: string[] } | null = null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The primary address first, then each administrator, once each, at most five. Pure. */
export function mergeRecipients(primary: string, admins: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [primary, ...admins]) {
    const e = String(raw ?? "").trim().toLowerCase();
    if (!EMAIL.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
    if (out.length >= MAX) break;
  }
  return out;
}

/** Every inbox an office alert should reach. Never throws: with no database it is just the primary address. */
export async function adminInboxes(primary: string): Promise<string[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      const rows = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true }, take: 10 });
      cache = { at: Date.now(), emails: rows.map((r) => r.email ?? "") };
    } catch {
      cache = { at: Date.now(), emails: cache?.emails ?? [] };
    }
  }
  return mergeRecipients(primary, cache.emails);
}

/** For tests. */
export function resetAdminInboxCache() { cache = null; }
