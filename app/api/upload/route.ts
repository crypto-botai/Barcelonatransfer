import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB limit for base64 fallback

/** Only images and PDFs. Everything here is a document photo or a licence scan. */
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);

export async function POST(req: NextRequest) {
  // This endpoint previously accepted uploads from anyone at all, which meant a
  // stranger could fill the blob store — and serve arbitrary files from this
  // domain. Uploading is a thing signed-in drivers, customers and staff do.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file   = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only photos and PDFs can be uploaded." },
      { status: 415 },
    );
  }

  // Checked before the Blob branch too, not only in the base64 fallback —
  // otherwise a configured Blob store accepts a file of any size at all.
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 4MB). Please compress it and try again." },
      { status: 413 },
    );
  }

  // Option 1: Vercel Blob (if token configured)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const ext      = file.name.split(".").pop() ?? "bin";
      const filename = `driver-docs/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const blob     = await put(filename, file, { access: "public" });
      return NextResponse.json({ url: blob.url, configured: true });
    } catch (err) {
      console.error("[upload] Vercel Blob error:", err);
    }
  }

  // Fallback: base64 data URL stored in DB (works without external storage)
  const buffer  = await file.arrayBuffer();
  const base64  = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`;

  return NextResponse.json({ url: dataUrl, configured: true });
}
