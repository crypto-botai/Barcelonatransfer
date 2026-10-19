import { apiHandler } from "@/lib/api/v1/response";
import { chatMarkRead } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** POST: everything shown so far has been read. */
export const POST = apiHandler(
  "driver.rides.chat.read",
  async ({ auth, params }) => chatMarkRead("DRIVER", (await params!).id, auth!.userId),
  { auth: { roles: ["DRIVER"] }, rateLimit: "chatRead" },
);
