import { apiHandler } from "@/lib/api/v1/response";
import { chatUnread } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** GET: unread chat messages across the caller's recent rides, for the badge on the ride list and the tab. Customers and drivers only see their own. */
export const GET = apiHandler(
  "chat.unread",
  async ({ auth }) => chatUnread(auth!.role === "DRIVER" ? "DRIVER" : "CUSTOMER", auth!.userId),
  { auth: { roles: ["CUSTOMER", "DRIVER"] }, rateLimit: "chatRead" },
);
