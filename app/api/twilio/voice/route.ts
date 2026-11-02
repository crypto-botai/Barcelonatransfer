import { NextRequest, NextResponse } from "next/server";
import { COMPANY } from "@/lib/company-facts";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";
import { dialOffice, gatherAndSay, twiml, voiceAgentEnabled } from "@/lib/voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A call comes in. Twilio is pointed here from the number's settings: Voice, "A call comes in", webhook, HTTP POST.
 *
 * With VOICE_AGENT_ENABLED off the caller is simply put through to the office, so pointing the number here is safe
 * before the agent is switched on. With it on, the caller is greeted by the booking assistant, told it is automated, and
 * the conversation continues at /api/twilio/voice/turn.
 */
export async function POST(req: NextRequest) {
  const params = await formParams(req).catch(() => ({} as Record<string, string>));
  const url = new URL(req.url);
  const ok = validTwilioSignature(
    candidateWebhookUrls(`${url.pathname}${url.search}`, req.url),
    params,
    req.headers.get("x-twilio-signature"),
    process.env.TWILIO_AUTH_TOKEN,
  );
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  if (!voiceAgentEnabled()) return dialOffice(COMPANY.phone, "en");

  const greeting =
    "Hello, you have reached Elite BCN Transfers. This is our automated booking assistant, and your words are written down to arrange your transfer. " +
    "How can I help? Para español, diga español.";
  return twiml(
    gatherAndSay(greeting, "en", "/api/twilio/voice/turn?lang=en&n=0") +
      // Nothing heard at all: try once more through the turn route, which decides when to give up.
      `<Redirect method="POST">/api/twilio/voice/turn?lang=en&amp;n=0&amp;silent=1</Redirect>`,
  );
}
