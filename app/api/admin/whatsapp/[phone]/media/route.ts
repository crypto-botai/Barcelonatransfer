import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { toE164 } from "@/lib/phone";
import { loadThread, recordOutbound } from "@/lib/whatsapp-inbox-store";
import { MAX_MEDIA_BYTES, SENDABLE_MEDIA, sendWhatsAppMedia, uploadWhatsAppMedia } from "@/lib/whatsapp";
import { cleanName, matchesType } from "@/lib/whatsapp-files";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Send a photo or document: a multipart form with `file`, and optionally `caption` and `replyTo`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = toE164(decodeURIComponent((await params).phone));
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to send." }, { status: 422 });

  const type = SENDABLE_MEDIA[file.type];
  if (!type) return NextResponse.json({ error: "Only photos (JPEG, PNG), PDF, Word, Excel and text files can be sent." }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 422 });
  if (file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "That file is over 4 MB. Send a smaller one, or share a link." }, { status: 413 });

  const bytes = await file.arrayBuffer();
  if (!matchesType(new Uint8Array(bytes.slice(0, 8)), file.type)) {
    return NextResponse.json({ error: `That file is not really a ${type.label}.` }, { status: 415 });
  }

  const { canReplyFreely } = await loadThread(phone);
  if (!canReplyFreely) {
    return NextResponse.json(
      { error: "This customer last wrote more than 24 hours ago, so WhatsApp only accepts an approved template now. Ask them to message you first." },
      { status: 409 },
    );
  }

  const caption = String(form?.get("caption") ?? "").trim().slice(0, 1024);
  const replyTo = String(form?.get("replyTo") ?? "").slice(0, 200) || null;
  const filename = cleanName(file.name);

  const up = await uploadWhatsAppMedia(bytes, file.type, filename);
  if (!up.ok) return NextResponse.json({ error: up.reason }, { status: 502 });

  const sent = await sendWhatsAppMedia(phone, { kind: type.kind, mediaId: up.id, caption, filename, replyTo });
  if (sent.outcome !== "sent" || !sent.id) return NextResponse.json({ error: sent.reason ?? "WhatsApp did not accept the file." }, { status: 502 });

  await recordOutbound({
    phone, wamid: sent.id, by: user.name, type: type.kind, mediaId: up.id, fileName: type.kind === "document" ? filename : null,
    text: caption ? `[${type.kind}] ${caption}` : `[${type.kind}] ${filename}`, replyTo,
  });
  return NextResponse.json({ ok: true, id: sent.id });
}
