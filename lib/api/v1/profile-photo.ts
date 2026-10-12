import { ApiError } from "./errors";

/**
 * A profile photo sent by an app: a small picture as a data address (`data:image/jpeg;base64,...`).
 *
 * The app resizes it to a few hundred pixels before sending, so a real photo is tens of kilobytes. This checks what arrived is
 * really a JPEG, PNG or WebP (the file's first bytes, not the label the sender gave it) and is no larger than a profile picture
 * needs to be, so the field cannot be used to store arbitrary files.
 */

export const MAX_PHOTO_BYTES = 400 * 1024;

export interface ParsedPhoto {
  mime: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
  ext: "jpg" | "png" | "webp";
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function sniff(bytes: Buffer): ParsedPhoto["mime"] | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function parsePhoto(input: string): ParsedPhoto {
  const match = DATA_URL.exec(input);
  if (!match) throw new ApiError("VALIDATION_FAILED", "Send the photo as a JPEG, PNG or WebP picture.");
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) throw new ApiError("VALIDATION_FAILED", "That photo is too large. Choose a smaller one.");
  const real = sniff(bytes);
  if (!real || real !== match[1]) throw new ApiError("VALIDATION_FAILED", "That file is not a valid photo.");
  return { mime: real, bytes, ext: real === "image/jpeg" ? "jpg" : real === "image/png" ? "png" : "webp" };
}

/** Where the photo lives: the website's file storage when it is set up, otherwise the picture itself (small enough to keep with the account). */
export async function storePhoto(userId: string, photo: ParsedPhoto): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`avatars/${userId}-${Date.now()}.${photo.ext}`, photo.bytes, { access: "public", contentType: photo.mime });
      return blob.url;
    } catch (err) {
      console.error("[profile-photo] blob store failed, keeping the picture with the account:", err instanceof Error ? err.message : err);
    }
  }
  return `data:${photo.mime};base64,${photo.bytes.toString("base64")}`;
}
