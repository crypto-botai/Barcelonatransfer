import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/resend";
import { COMPANY } from "@/lib/company-facts";
import { emailDocument, contactEnquiryCard } from "@/lib/email/premium";

const schema = z.object({
  name:    z.string().min(2),
  email:   z.string().email(),
  phone:   z.string().optional(),
  message: z.string().min(5),
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? COMPANY.email;

/**
 * The address enquiries are sent from.
 *
 * It was noreply@elitebcntransfers.com, a domain that does not exist — no A
 * record, no MX, no DKIM, NXDOMAIN at a public resolver. Nothing here ever
 * failed loudly, because Resend accepts a send and delivers it afterwards,
 * so the form returned {"ok":true} to the customer and the enquiry went
 * nowhere. elitebcn.info is the domain that actually has the DKIM key and
 * the SPF record, and is what every other email on the site is sent from.
 */
const FROM = process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>";

/**
 * A name on its way into the subject line.
 *
 * Not escaped, because a subject is plain text and would show the entities.
 * Stripped of line breaks instead: that is how header injection starts, and
 * a name box is a strange place to have one.
 */
const subjectSafe = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 120);

export async function POST(req: NextRequest) {
  try {
    // A body that is not JSON threw here, and an unhandled throw on a public
    // form is a 500 where the customer sees nothing but a dead button.
    const raw = await req.json().catch(() => null);
    if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const body = schema.parse(raw);

    await resend.emails.send({
      from: FROM,
      to:   ADMIN_EMAIL,
      replyTo: body.email,
      // A subject is plain text, so it is not escaped — but a newline in
      // it is how header injection starts, and a name box is a strange place
      // to have one.
      subject: `📩 Contact Enquiry from ${subjectSafe(body.name)}`,
      html: emailDocument(
        contactEnquiryCard({
          name: body.name,
          email: body.email,
          phone: body.phone,
          message: body.message,
        }),
        `${subjectSafe(body.name)} — ${body.email}`,
      ),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    console.error("[contact]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
