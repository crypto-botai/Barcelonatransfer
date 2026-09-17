import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identifyParticipant, listMessages, postMessage } from "@/lib/trip-chat";

export const dynamic = "force-dynamic";

/**
 * Chat on one booking, for whoever is on it.
 *
 *   GET  /api/bookings/:id/messages?after=<iso>&code=<confirmation>
 *   POST /api/bookings/:id/messages { body, code? }
 *
 * `code` is how the public tracking link proves the customer holds the
 * booking; signed-in people are identified by their session.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const me = await identifyParticipant(id, sp.get("code"));
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messages = await listMessages(id, sp.get("after"));
  return NextResponse.json({ me: me.sender, messages });
}

const schema = z.object({ body: z.string().min(1).max(1000), code: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write something first" }, { status: 422 });
  const me = await identifyParticipant(id, parsed.data.code);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const msg = await postMessage(me, parsed.data.body);
    return NextResponse.json(msg, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
