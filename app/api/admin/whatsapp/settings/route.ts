import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { loadSettings, saveSettings } from "@/lib/whatsapp-settings-store";
import { resolveServices } from "@/lib/whatsapp-services";
import { isPushConfigured } from "@/lib/notifications/push";
import { BASE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** What the office can change, plus what the services will actually show customers right now. */
async function view(settings: Awaited<ReturnType<typeof loadSettings>>) {
  return {
    settings,
    // The prices customers will see, so the editor shows the real figure beside each service.
    services: await resolveServices(settings.services),
    pushConfigured: isPushConfigured(),
    catalogFeedUrl: `${BASE_URL}/api/whatsapp/catalog`,
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await view(await loadSettings()));
}

export async function PUT(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Nothing to save." }, { status: 422 });
  // Saving cleans first, so what comes back is what is really stored.
  return NextResponse.json(await view(await saveSettings(input, user.name)));
}
