import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { getWhatsAppProfile, updateWhatsAppProfile } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** The page customers see when they tap the business name in WhatsApp. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await getWhatsAppProfile();
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
  return NextResponse.json(result.profile);
}

// The limits are WhatsApp's own. Over them, Meta refuses the whole update with a
// message that does not say which field, so they are checked here.
const profile = z.object({
  about: z.string().trim().min(1).max(139),
  description: z.string().trim().max(512),
  address: z.string().trim().max(256),
  email: z.union([z.string().trim().email().max(128), z.literal("")]),
  vertical: z.string().trim().max(60),
  websites: z.array(z.string().trim().url().startsWith("http")).max(2),
});

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: `${first?.path.join(".") || "Profile"}: ${first?.message ?? "invalid"}` }, { status: 422 });
  }
  const result = await updateWhatsAppProfile(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
  return NextResponse.json({ ok: true });
}
