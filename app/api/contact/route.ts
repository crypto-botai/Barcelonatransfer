import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/resend";
import { COMPANY } from "@/lib/company-facts";

const schema = z.object({
  name:    z.string().min(2),
  email:   z.string().email(),
  phone:   z.string().optional(),
  message: z.string().min(5),
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? COMPANY.email;

/**
 * The enquiry goes into an HTML email, so it has to be escaped.
 *
 * Every field below was interpolated raw. Anyone could put markup in the
 * name box of a public form and have it rendered in the owner's inbox: a
 * link that says one thing and goes somewhere else is the obvious use, and
 * the message arrives from our own domain, which is what makes it work.
 */
/**
 * A name on its way into the subject line.
 *
 * Not escaped, because a subject is plain text and would show the entities.
 * Stripped of line breaks instead: that is how header injection starts, and
 * a name box is a strange place to have one.
 */
const subjectSafe = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 120);

const esc = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function POST(req: NextRequest) {
  try {
    // A body that is not JSON threw here, and an unhandled throw on a public
    // form is a 500 where the customer sees nothing but a dead button.
    const raw = await req.json().catch(() => null);
    if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const body = schema.parse(raw);

    await resend.emails.send({
      from: "Elite BCN Transfers <noreply@elitebcntransfers.com>",
      to:   ADMIN_EMAIL,
      replyTo: body.email,
      // A subject is plain text, so it is not escaped — but a newline in
      // it is how header injection starts, and a name box is a strange place
      // to have one.
      subject: `📩 Contact Enquiry from ${subjectSafe(body.name)}`,
      html: `
        <div style="font-family:Georgia,serif;background:#0a0a0a;color:#e0e0e0;max-width:600px;margin:0 auto;padding:40px;">
          <h2 style="color:#c9a84c;margin-bottom:4px;">New Contact Enquiry</h2>
          <p style="color:#888;margin-top:0;font-size:13px;">Received via elitebcntransfers.com</p>
          <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Name</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;">${esc(body.name)}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Email</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;"><a href="mailto:${encodeURIComponent(body.email)}" style="color:#c9a84c;">${esc(body.email)}</a></td></tr>
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Phone</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;">${esc(body.phone) || "—"}</td></tr>
          </table>
          <div style="margin-top:24px;background:#111;border-radius:8px;padding:20px;">
            <p style="color:#888;font-size:12px;margin:0 0 8px;letter-spacing:2px;">MESSAGE</p>
            <p style="color:#e0e0e0;margin:0;white-space:pre-wrap;">${esc(body.message)}</p>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#555;">Reply directly to this email to respond to the customer.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    console.error("[contact]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
