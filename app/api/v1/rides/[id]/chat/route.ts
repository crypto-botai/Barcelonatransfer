import { apiHandler } from "@/lib/api/v1/response";
import { chatSendMessage, chatThread } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** GET: the conversation (page, polling, unread, whether it is closed). POST: send one message. Only the rides of this ride. */
export const GET = apiHandler(
  "rides.chat.list",
  async ({ req, auth, params }) => chatThread("CUSTOMER", (await params!).id, auth!.userId, new URL(req.url)),
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "chatRead" },
);

export const POST = apiHandler(
  "rides.chat.send",
  async ({ req, auth, params, requestId }) => chatSendMessage("CUSTOMER", (await params!).id, auth!.userId, req, requestId),
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "chatSend", status: 201 },
);
