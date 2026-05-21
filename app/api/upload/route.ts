import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB limit for base64 fallback

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file   = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

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
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({
      error: `File too large (max 4MB). Please compress or use a smaller file.`,
    }, { status: 413 });
  }

  const buffer  = await file.arrayBuffer();
  const base64  = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`;

  return NextResponse.json({ url: dataUrl, configured: true });
}
