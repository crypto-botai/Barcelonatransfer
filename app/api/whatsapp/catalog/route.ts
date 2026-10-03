import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/whatsapp-settings-store";
import { catalogCsv, resolveServices } from "@/lib/whatsapp-services";

export const dynamic = "force-dynamic";

/**
 * The product feed for the WhatsApp catalogue.
 *
 * Public, because Meta fetches it without logging in, and safe to be: it holds
 * only what is already on the website, the service names and their "from"
 * prices. It is built from the same list and the same price table as the menu,
 * so the catalogue and the website quote the same figure.
 */
export async function GET() {
  const csv = catalogCsv(await resolveServices((await loadSettings()).services));
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
