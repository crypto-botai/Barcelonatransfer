import { NextRequest, NextResponse } from "next/server";

// Uploads a file to Supabase Storage.
// Required env vars:
//   NEXT_PUBLIC_SUPABASE_URL   — e.g. https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — service_role key (not anon key)
//
// The bucket "driver-documents" must exist and be set to private in Supabase Storage.
// Create it: Supabase Dashboard → Storage → New bucket → "driver-documents" (private).

const BUCKET = "driver-documents";

export async function POST(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Storage not configured — return a placeholder so registration still proceeds
    return NextResponse.json({ url: null, configured: false });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext      = file.name.split(".").pop() ?? "bin";
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const uploadUrl   = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filename}`;

  const res = await fetch(uploadUrl, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type":  file.type || "application/octet-stream",
      "x-upsert":      "true",
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[upload] Supabase error:", res.status, text);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Build a signed URL valid for 10 years (for admin viewing)
  const signRes = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${filename}`,
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ expiresIn: 315360000 }),
    }
  );

  if (signRes.ok) {
    const { signedURL } = await signRes.json() as { signedURL: string };
    return NextResponse.json({ url: `${supabaseUrl}/storage/v1${signedURL}`, configured: true });
  }

  // Fallback: return the public path pattern
  return NextResponse.json({ url: uploadUrl, configured: true });
}
