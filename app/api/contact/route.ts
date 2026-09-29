import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company-facts";
import { emailDocument, contactEnquiryCard } from "@/lib/email/premium";
import { senderAddress } from "@/lib/sender";

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
const FROM = senderAddress();

/**
 * A name on its way into the subject line.
 *
 * Not escaped, because a subject is plain text and would show the entities.
 * Stripped of line breaks instead: that is how header injection starts, and
 * a name box is a strange place to have one.
 */
const subjectSafe = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 120);

/**
 * Write the enquiry down before trying to send anything.
 *
 * Best effort on purpose. The table is created by `prisma db push`, and a
 * deployment that runs ahead of that push must not take the contact form
 * down with it — the email is still the main path. Returns the row id when
 * the enquiry is safely stored, and null when it is not, which is what
 * decides whether a failed send is recoverable or genuinely lost.
 */
async function record(body: z.infer<typeof schema>): Promise<string | null> {
  try {
    const row = await prisma.contactEnquiry.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        message: body.message,
        status: "PENDING",
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[contact] could not store the enquiry", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // A body that is not JSON threw here, and an unhandled throw on a public
    // form is a 500 where the customer sees nothing but a dead button.
    const raw = await req.json().catch(() => null);
    if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const body = schema.parse(raw);

    // First, so that whatever happens to the email, the message survives.
    const storedId = await record(body);

    try {
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
    } catch (sendErr) {
      console.error("[contact] send failed", sendErr);
      if (storedId) {
        await prisma.contactEnquiry
          .update({
            where: { id: storedId },
            data: {
              status: "FAILED",
              emailError: sendErr instanceof Error ? sendErr.message : String(sendErr),
            },
          })
          .catch(() => {});
        // The enquiry is on disk and can be answered, so the customer has
        // not wasted their time and must not be told to try again. The
        // failure is the office's to chase, not theirs.
        return NextResponse.json({ ok: true });
      }
      // Nothing was stored and nothing was sent. This one really is lost,
      // and saying so is better than a false success.
      throw sendErr;
    }

    if (storedId) {
      await prisma.contactEnquiry
        .update({ where: { id: storedId }, data: { status: "EMAILED" } })
        .catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    console.error("[contact]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
