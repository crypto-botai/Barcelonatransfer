import { apiHandler } from "@/lib/api/v1/response";
import { chatMarkRead } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** POST: everything shown so far has been read. */
export const POST = apiHandler(
  "rides.chat.read",
  async ({ auth, params }) => chatMarkRead("CUSTOMER", (await params!).id, auth!.userId),
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "chatRead" },
);
