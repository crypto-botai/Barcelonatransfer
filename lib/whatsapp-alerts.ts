import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/notifications/push";
import { BASE_URL } from "@/lib/seo";

/**
 * Tell every admin's devices that a customer wrote.
 *
 * Uses the same web push the rest of the site does: it reaches a desktop
 * browser as a system notification even when the admin tab is closed, as long
 * as the browser itself is running and the admin turned alerts on there.
 *
 * Never throws. A failed alert must not stop the message being stored, and
 * the email and WhatsApp alerts are separate channels that do not depend on it.
 */
export async function pushNewMessageToAdmins(m: { phone: string; name: string | null; text: string }): Promise<number> {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const results = await Promise.all(
      admins.map((a) =>
        sendPushToUser(a.id, {
          title: m.name ? `${m.name} on WhatsApp` : `WhatsApp ${m.phone}`,
          body: m.text.replace(/\s+/g, " ").slice(0, 140) || "New message",
          // One notification per customer: a second message replaces the first instead of stacking.
          tag: `wa:${m.phone}`,
          url: `${BASE_URL}/admin/whatsapp?phone=${encodeURIComponent(m.phone)}`,
        }),
      ),
    );
    return results.reduce((n, r) => n + r.sent, 0);
  } catch (e) {
    console.warn("[whatsapp] desktop alert failed:", (e as Error)?.message);
    return 0;
  }
}
