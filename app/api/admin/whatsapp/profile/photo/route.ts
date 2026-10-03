import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { setWhatsAppProfilePhoto } from "@/lib/whatsapp";
import { BASE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** WhatsApp's own ceiling is 5 MB; the host's request limit is lower, and is what applies here. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Change the business profile photo.
 *
 * Either a file from the admin's computer (multipart, field `file`), or
 * `{ "useLogo": true }` to use the Elite BCN logo already prepared on the site.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bytes: ArrayBuffer;
  let mime: string;

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const b = (await req.json().catch(() => ({}))) as { useLogo?: boolean };
    if (!b.useLogo) return NextResponse.json({ error: "Choose a photo." }, { status: 422 });
    const res = await fetch(`${BASE_URL}/brand/whatsapp-profile.jpg`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return NextResponse.json({ error: "The logo file could not be loaded." }, { status: 502 });
    bytes = await res.arrayBuffer();
    mime = "image/jpeg";
  } else {
    const file = (await req.formData().catch(() => null))?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 422 });
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      return NextResponse.json({ error: "The profile photo must be a JPEG or PNG." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 4 MB." }, { status: 413 });
    bytes = await file.arrayBuffer();
    mime = file.type;
  }

  const result = await setWhatsAppProfilePhoto(bytes, mime);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
  return NextResponse.json({ ok: true });
}
