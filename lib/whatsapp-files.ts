/** Checks on a file before it is sent to a customer. Shared by the screen and the server, so both agree. */

/** Files the inbox lets the office send. Meta accepts more; the host's request size limit is what bounds this. */
export const SENDABLE_MEDIA: Record<string, { kind: "image" | "document"; label: string }> = {
  "image/jpeg": { kind: "image", label: "photo" },
  "image/png": { kind: "image", label: "photo" },
  "application/pdf": { kind: "document", label: "PDF" },
  "application/msword": { kind: "document", label: "Word file" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", label: "Word file" },
  "application/vnd.ms-excel": { kind: "document", label: "Excel file" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { kind: "document", label: "Excel file" },
  "text/plain": { kind: "document", label: "text file" },
};

/** Largest file the host will accept in one request (4.5 MB), less headroom for the form around it. */
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

/** Why a file cannot be sent, in words for the person who picked it, or null when it can. */
export function fileProblem(file: { type: string; size: number }): string | null {
  if (!SENDABLE_MEDIA[file.type]) return "Only photos (JPEG, PNG), PDF, Word, Excel and text files can be sent.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_MEDIA_BYTES) return "That file is over 4 MB. Send a smaller one, or share a link.";
  return null;
}

/**
 * Does the start of the file match what the browser says it is?
 *
 * The type comes from the browser and the file from whoever picked it, and
 * nothing checks they agree. A mismatch is not dangerous to us, since WhatsApp
 * does its own checking, but it turns into a confusing error from Meta two
 * steps later. Better to say "that is not a JPEG" here.
 */
export function matchesType(bytes: Uint8Array, mime: string): boolean {
  const at = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (mime === "image/jpeg") return at(0xff, 0xd8, 0xff);
  if (mime === "image/png") return at(0x89, 0x50, 0x4e, 0x47);
  if (mime === "application/pdf") return at(0x25, 0x50, 0x44, 0x46);
  return true;
}

/** A name that is safe to show the customer and to put in a header. */
export function cleanName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";
}
