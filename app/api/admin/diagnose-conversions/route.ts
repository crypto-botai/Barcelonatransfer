import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendOpenAiConversion } from "@/lib/tracking/openai-conversions";

export const dynamic = "force-dynamic";

/**
 * Whether the OpenAI conversion is wired up, and whether the credentials
 * actually work — without waiting for a customer to pay.
 *
 * The first live validation would otherwise need a real booking taken
 * through a real card, and the only way to see the outcome would be to read
 * the function log at the right moment. This asks the same question
 * directly: it sends a validate_only event to the real endpoint with the
 * real credentials and reports what came back.
 *
 * Two things make it safe to have on a live site for as long as it takes:
 *
 *   - validate_only is forced true here regardless of the environment
 *     variable, so this route cannot record a conversion even by mistake.
 *   - the event id is synthetic and clearly marked, never a booking id, so
 *     it can never collide with or pre-empt a real order_created.
 *
 * It never returns a key, a pixel id, or any part of one. Delete it once the
 * configuration is confirmed.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json(
      { error: "Sign in as an admin first, then open this link again." },
      { status: 401 },
    );
  }

  // Presence only. The values themselves are never read into the response.
  const config = {
    apiKeyConfigured:  Boolean(process.env.OPENAI_CONVERSIONS_API_KEY?.trim()),
    pixelIdConfigured: Boolean(process.env.OPENAI_PIXEL_ID?.trim()),
    validateOnlyMode:  process.env.OPENAI_CONVERSIONS_VALIDATE_ONLY === "true",
    endpoint:          "https://bzr.openai.com/v1/events",
    siteUrl:           process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info",
  };

  const ready = config.apiKeyConfigured && config.pixelIdConfigured;

  if (req.nextUrl.searchParams.get("send") !== "1") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      config,
      note: ready
        ? "Both credentials are present. Add ?send=1 to send a validate_only event to the real endpoint and see what it says."
        : "Missing credentials. Set OPENAI_CONVERSIONS_API_KEY and OPENAI_PIXEL_ID in Vercel (Production scope), then redeploy.",
    });
  }

  if (!ready) {
    return NextResponse.json({
      ok: false,
      config,
      note: "Nothing to send: one or both credentials are missing.",
    }, { status: 400 });
  }

  // A synthetic id, so this can never be mistaken for — or block — the
  // conversion for a real booking.
  const eventId = `diagnostic-${Date.now()}`;

  const result = await sendOpenAiConversion({
    eventId,
    eventType: "order_created",
    amount:    1,
    currency:  "EUR",
    sourceUrl: `${config.siteUrl}/booking/success?booking_id=${eventId}`,
    // Forced, not read from the environment. This route never records.
    validateOnly: true,
  });

  const explain: Record<string, string> = {
    validated:
      "The endpoint, the pixel id, the API key and the payload shape are all accepted. Nothing was recorded. You are ready to go live: remove OPENAI_CONVERSIONS_VALIDATE_ONLY and redeploy.",
    sent:
      "The API accepted the event but did not treat it as a validation. Check that validate_only is being honoured before going live.",
    "authentication-error":
      "The API key or the pixel id was rejected. Check OPENAI_CONVERSIONS_API_KEY is the Conversions API key (not the Ads key) and that OPENAI_PIXEL_ID belongs to the EliteBCN web conversion source.",
    "validation-error":
      "The credentials were accepted but the payload was not. The detail below is OpenAI's own message.",
    rejected:
      "The request reached OpenAI and was refused. The detail below is OpenAI's own message.",
    "transport-error":
      "Could not reach the endpoint at all — network, DNS or timeout.",
    "not-configured":
      "Credentials are missing at the moment of sending.",
  };

  return NextResponse.json({
    ok: result.ok,
    sent: true,
    eventId,
    outcome: result.outcome,
    detail: result.detail ?? null,
    config,
    note: explain[result.outcome] ?? "Unrecognised outcome.",
  }, { status: result.ok ? 200 : 502 });
}
