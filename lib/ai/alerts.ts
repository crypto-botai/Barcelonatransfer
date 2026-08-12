import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { COMPANY } from "@/lib/company-facts";

const resend = new Resend(process.env.RESEND_API_KEY);

type Severity = "INFO" | "WARNING" | "CRITICAL";

interface CreateAlertOptions {
  agentId?:   string;
  severity:   Severity;
  title:      string;
  message:    string;
  dedupeKey:  string;
  sendEmail?: boolean;
}

export async function createAlert(opts: CreateAlertOptions): Promise<void> {
  const existing = await prisma.aiAlert
    .findUnique({ where: { dedupeKey: opts.dedupeKey } })
    .catch(() => null);

  if (existing) return; // Already alerted within dedup window

  const alert = await prisma.aiAlert
    .create({
      data: {
        agentId:  opts.agentId ?? null,
        severity: opts.severity,
        title:    opts.title,
        message:  opts.message,
        channel:  opts.sendEmail ? "email" : "dashboard",
        dedupeKey: opts.dedupeKey,
      },
    })
    .catch(() => null);

  if (!alert) return;

  if (opts.sendEmail && opts.severity !== "INFO") {
    const adminEmail = process.env.ADMIN_EMAIL ?? COMPANY.email;
    await resend.emails
      .send({
        from:    process.env.RESEND_FROM ?? "Elite BCN AI <noreply@elitebcn.info>",
        to:      adminEmail,
        subject: `[${opts.severity}] ${opts.title}`,
        html:    `<p>${opts.message}</p><p><a href="https://www.elitebcn.info/admin/ai/alerts">View in dashboard →</a></p>`,
      })
      .catch((e) => console.error("[ai/alerts] email failed:", e?.message));

    await prisma.aiAlert
      .update({ where: { id: alert.id }, data: { emailSentAt: new Date() } })
      .catch(() => {});
  }
}

export function hourDedupeKey(prefix: string): string {
  return `${prefix}_${new Date().toISOString().slice(0, 13)}`;
}

export function dayDedupeKey(prefix: string): string {
  return `${prefix}_${new Date().toISOString().slice(0, 10)}`;
}
