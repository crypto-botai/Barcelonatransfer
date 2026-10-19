import { apiHandler } from "@/lib/api/v1/response";
import { chatSendMessage, chatThread } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** GET: the conversation (page, polling, unread, whether it is closed). POST: send one message. Only the driver.rides of this ride. */
export const GET = apiHandler(
  "driver.rides.chat.list",
  async ({ req, auth, params }) => chatThread("DRIVER", (await params!).id, auth!.userId, new URL(req.url)),
  { auth: { roles: ["DRIVER"] }, rateLimit: "chatRead" },
);

export const POST = apiHandler(
  "driver.rides.chat.send",
  async ({ req, auth, params, requestId }) => chatSendMessage("DRIVER", (await params!).id, auth!.userId, req, requestId),
  { auth: { roles: ["DRIVER"] }, rateLimit: "chatSend", status: 201 },
);
