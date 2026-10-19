import { apiHandler } from "@/lib/api/v1/response";
import { chatUploadPhoto } from "@/lib/api/v1/chat-routes";

export const dynamic = "force-dynamic";

/** POST { data: base64 } : store one photo for this ride's chat; attach it by sending a message with the returned attachmentId. */
export const POST = apiHandler(
  "driver.rides.chat.photo.upload",
  async ({ req, auth, params }) => chatUploadPhoto("DRIVER", (await params!).id, auth!.userId, req),
  { auth: { roles: ["DRIVER"] }, rateLimit: "chatSend", status: 201 },
);
