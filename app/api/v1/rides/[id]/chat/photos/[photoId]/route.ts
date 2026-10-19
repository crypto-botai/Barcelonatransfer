import { apiHandler } from "@/lib/api/v1/response";
import { chatGetPhoto } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** GET: one photo as { mime, data: base64 }, only if this person may see the message it belongs to. */
export const GET = apiHandler(
  "rides.chat.photo.get",
  async ({ auth, params }) => {
    const p = await params!;
    return chatGetPhoto("CUSTOMER", p.id, auth!.userId, p.photoId);
  },
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "chatRead" },
);
