import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/resend";

const schema = z.object({
  name:    z.string().min(2),
  email:   z.string().email(),
  phone:   z.string().optional(),
  message: z.string().min(5),
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    await resend.emails.send({
      from: "Élite BCN Transfers <noreply@elitebcntransfers.com>",
      to:   ADMIN_EMAIL,
      replyTo: body.email,
      subject: `📩 Contact Enquiry from ${body.name}`,
      html: `
        <div style="font-family:Georgia,serif;background:#0a0a0a;color:#e0e0e0;max-width:600px;margin:0 auto;padding:40px;">
          <h2 style="color:#c9a84c;margin-bottom:4px;">New Contact Enquiry</h2>
          <p style="color:#888;margin-top:0;font-size:13px;">Received via elitebcntransfers.com</p>
          <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Name</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;">${body.name}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Email</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;"><a href="mailto:${body.email}" style="color:#c9a84c;">${body.email}</a></td></tr>
            <tr><td style="color:#888;font-size:13px;padding:8px 0;border-bottom:1px solid #222;">Phone</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #222;">${body.phone || "—"}</td></tr>
          </table>
          <div style="margin-top:24px;background:#111;border-radius:8px;padding:20px;">
            <p style="color:#888;font-size:12px;margin:0 0 8px;letter-spacing:2px;">MESSAGE</p>
            <p style="color:#e0e0e0;margin:0;white-space:pre-wrap;">${body.message}</p>
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
