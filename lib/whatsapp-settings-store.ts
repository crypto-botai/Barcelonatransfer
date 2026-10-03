import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS, sanitizeSettings, type WhatsAppSettings } from "@/lib/whatsapp-settings";

/**
 * Where the office's WhatsApp settings live.
 *
 * Saved as a row in the activity log, one per save, newest wins. That keeps a
 * history of who changed what for free, and needs no new table. Reading is one
 * indexed lookup. If the lookup fails the defaults are used, so a database
 * hiccup can never switch the inbox off.
 */

const ENTITY = "WhatsAppSettings";

export async function loadSettings(): Promise<WhatsAppSettings> {
  try {
    const row = await prisma.activityLog.findFirst({
      where: { entity: ENTITY, action: "WA_SETTINGS" },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });
    return row ? sanitizeSettings(row.details) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Cleans, stores and returns what was actually saved. */
export async function saveSettings(input: unknown, by: string): Promise<WhatsAppSettings> {
  const clean = sanitizeSettings(input);
  await prisma.activityLog.create({
    data: { action: "WA_SETTINGS", entity: ENTITY, adminName: by, details: clean as unknown as object },
  });
  return clean;
}
