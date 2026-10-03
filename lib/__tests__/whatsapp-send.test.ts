import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getWhatsAppProfile, markWhatsAppRead, sendWhatsAppInteractive, sendWhatsAppMedia, sendWhatsAppReaction,
  sendWhatsAppTextResult, setWhatsAppProfilePhoto, updateWhatsAppProfile, uploadWhatsAppMedia,
} from "@/lib/whatsapp";

/**
 * What is actually sent to Meta.
 *
 * The network is replaced, so nothing leaves the machine, and each test reads
 * the request that would have gone: its address, its headers and its body.
 * These requests are the part nobody sees until a customer does not get the
 * message, so they are checked field by field.
 */

const fetchMock = vi.fn();
type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };
const calls = (): Call[] => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init as Call["init"] }));
const json = (c: Call) => JSON.parse(String(c.init.body));

const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const fail = (code: number, message = "nope") => {
  const body = { error: { code, message } };
  return { ok: false, status: 400, json: async () => body, text: async () => JSON.stringify(body) };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WA_PHONE_ID", "PHONE1");
  vi.stubEnv("WA_TOKEN", "TOKEN1");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("text", () => {
  it("sends to the right number with the token, and returns Meta's id", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "wamid.X" }] }));
    const r = await sendWhatsAppTextResult("+34635383712", "Hello");
    expect(r).toEqual({ outcome: "sent", id: "wamid.X" });
    const [c] = calls();
    expect(c.url).toBe("https://graph.facebook.com/v21.0/PHONE1/messages");
    expect(c.init.headers.Authorization).toBe("Bearer TOKEN1");
    expect(json(c)).toMatchObject({ messaging_product: "whatsapp", to: "+34635383712", type: "text", text: { body: "Hello" } });
    expect(json(c).context).toBeUndefined();
  });

  it("marks a reply to a specific message", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "wamid.X" }] }));
    await sendWhatsAppTextResult("+34635383712", "Yes", { replyTo: "wamid.ORIG" });
    expect(json(calls()[0]).context).toEqual({ message_id: "wamid.ORIG" });
  });

  it("cuts a message to WhatsApp's 4096 characters", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    await sendWhatsAppTextResult("+34635383712", "x".repeat(9000));
    expect(json(calls()[0]).text.body).toHaveLength(4096);
  });

  it("sends nothing when WhatsApp is not configured, or the number has no country", async () => {
    vi.stubEnv("WA_TOKEN", "");
    expect(await sendWhatsAppTextResult("+34635383712", "x")).toMatchObject({ outcome: "skipped" });
    vi.stubEnv("WA_TOKEN", "TOKEN1");
    expect(await sendWhatsAppTextResult("635383712", "x")).toMatchObject({ outcome: "skipped", reason: "number has no country code" });
    expect(await sendWhatsAppTextResult(null, "x")).toMatchObject({ outcome: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a refusal in words, not a code", async () => {
    fetchMock.mockResolvedValue(fail(131047));
    expect(await sendWhatsAppTextResult("+34635383712", "x")).toMatchObject({ outcome: "skipped", reason: expect.stringContaining("24-hour") });
    fetchMock.mockResolvedValue(fail(190));
    expect(await sendWhatsAppTextResult("+34635383712", "x")).toMatchObject({ outcome: "failed", reason: expect.stringContaining("token") });
    fetchMock.mockResolvedValue(fail(131042));
    expect(await sendWhatsAppTextResult("+34635383712", "x")).toMatchObject({ reason: expect.stringContaining("payment") });
  });

  it("reports a network failure instead of throwing", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    expect(await sendWhatsAppTextResult("+34635383712", "x")).toEqual({ outcome: "failed", reason: "socket hang up" });
  });
});

describe("read receipts and reactions", () => {
  it("marks the customer's message as read", async () => {
    fetchMock.mockResolvedValue(ok());
    await markWhatsAppRead("wamid.IN");
    expect(json(calls()[0])).toEqual({ messaging_product: "whatsapp", status: "read", message_id: "wamid.IN" });
  });

  it("never throws, and sends nothing without a message or without configuration", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(markWhatsAppRead("wamid.IN")).resolves.toBeUndefined();
    fetchMock.mockClear();
    await markWhatsAppRead("");
    vi.stubEnv("WA_TOKEN", "");
    await markWhatsAppRead("wamid.IN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends and removes a reaction", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    await sendWhatsAppReaction("+34635383712", "wamid.IN", "👍");
    expect(json(calls()[0])).toMatchObject({ type: "reaction", reaction: { message_id: "wamid.IN", emoji: "👍" } });
    await sendWhatsAppReaction("+34635383712", "wamid.IN", "");
    expect(json(calls()[1]).reaction.emoji).toBe("");
  });
});

describe("files", () => {
  it("uploads with the type and the file as a form, and returns the id", async () => {
    fetchMock.mockResolvedValue(ok({ id: "MEDIA9" }));
    const r = await uploadWhatsAppMedia(new Uint8Array([1, 2, 3]).buffer, "image/png", "pic.png");
    expect(r).toEqual({ ok: true, id: "MEDIA9" });
    const [c] = calls();
    expect(c.url).toBe("https://graph.facebook.com/v21.0/PHONE1/media");
    expect(c.init.headers.Authorization).toBe("Bearer TOKEN1");
    const form = c.init.body as FormData;
    expect(form.get("messaging_product")).toBe("whatsapp");
    expect(form.get("type")).toBe("image/png");
    expect((form.get("file") as File).name).toBe("pic.png");
    expect((form.get("file") as File).size).toBe(3);
    // The form sets its own boundary: a hand-written Content-Type would break it.
    expect(c.init.headers["Content-Type"]).toBeUndefined();
  });

  it("explains an upload that is refused, and one that returns no id", async () => {
    fetchMock.mockResolvedValueOnce(fail(190));
    expect(await uploadWhatsAppMedia(new ArrayBuffer(1), "image/png", "a.png")).toMatchObject({ ok: false, reason: expect.stringContaining("token") });
    fetchMock.mockResolvedValueOnce(ok({}));
    expect(await uploadWhatsAppMedia(new ArrayBuffer(1), "image/png", "a.png")).toMatchObject({ ok: false });
  });

  it("sends a photo with its caption, as a reply when asked", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    await sendWhatsAppMedia("+34635383712", { kind: "image", mediaId: "M1", caption: "Your meeting point", replyTo: "wamid.Q" });
    expect(json(calls()[0])).toMatchObject({ type: "image", image: { id: "M1", caption: "Your meeting point" }, context: { message_id: "wamid.Q" } });
  });

  it("sends a document with its file name, and no empty caption", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    await sendWhatsAppMedia("+34635383712", { kind: "document", mediaId: "M2", filename: "voucher.pdf" });
    const body = json(calls()[0]);
    expect(body.document).toEqual({ id: "M2", filename: "voucher.pdf" });
    expect(body.context).toBeUndefined();
  });

  it("cuts a caption to WhatsApp's limit", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    await sendWhatsAppMedia("+34635383712", { kind: "image", mediaId: "M1", caption: "c".repeat(3000) });
    expect(json(calls()[0]).image.caption).toHaveLength(1024);
  });
});

describe("interactive messages", () => {
  it("sends the menu as given", async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: "w" }] }));
    const menu = { type: "list", body: { text: "x" } };
    await sendWhatsAppInteractive("+34635383712", menu, { replyTo: "wamid.Q" });
    expect(json(calls()[0])).toMatchObject({ type: "interactive", interactive: menu, context: { message_id: "wamid.Q" } });
  });
});

describe("business profile", () => {
  it("reads the profile fields", async () => {
    fetchMock.mockResolvedValue(ok({ data: [{ about: "Hi", address: "Carrer Llull 465", websites: ["https://www.elitebcn.info"], profile_picture_url: "https://pps/x.jpg" }] }));
    const r = await getWhatsAppProfile();
    expect(r).toMatchObject({ ok: true, profile: { about: "Hi", address: "Carrer Llull 465", email: "", websites: ["https://www.elitebcn.info"], profile_picture_url: "https://pps/x.jpg" } });
    expect(calls()[0].url).toContain("/PHONE1/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical");
  });

  it("updates the profile", async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));
    expect(await updateWhatsAppProfile({ about: "New" })).toEqual({ ok: true });
    expect(json(calls()[0])).toEqual({ messaging_product: "whatsapp", about: "New" });
  });

  it("reports a refused update", async () => {
    fetchMock.mockResolvedValue(fail(100, "Invalid parameter"));
    expect(await updateWhatsAppProfile({ about: "New" })).toMatchObject({ ok: false, reason: expect.stringContaining("Invalid parameter") });
  });

  it("changes the photo in Meta's three steps, in order, with the right credentials", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ id: "upload:SESSION" }))
      .mockResolvedValueOnce(ok({ h: "HANDLE" }))
      .mockResolvedValueOnce(ok({ success: true }));
    const bytes = new Uint8Array(1234).buffer;
    expect(await setWhatsAppProfilePhoto(bytes, "image/jpeg")).toEqual({ ok: true });

    const [open, upload, apply] = calls();
    expect(open.url).toContain("/uploads?file_length=1234&file_type=image%2Fjpeg");
    expect(open.url).toContain("/2233351653890022/");
    expect(open.init.headers.Authorization).toBe("Bearer TOKEN1");
    expect(upload.url).toBe("https://graph.facebook.com/v21.0/upload:SESSION");
    expect(upload.init.headers.Authorization).toBe("OAuth TOKEN1");
    expect(upload.init.headers.file_offset).toBe("0");
    expect(upload.init.body).toBe(bytes);
    expect(apply.url).toBe("https://graph.facebook.com/v21.0/PHONE1/whatsapp_business_profile");
    expect(json(apply)).toEqual({ messaging_product: "whatsapp", profile_picture_handle: "HANDLE" });
  });

  it("refuses anything but JPEG or PNG before calling Meta", async () => {
    expect(await setWhatsAppProfilePhoto(new ArrayBuffer(10), "image/gif")).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops and says which step failed", async () => {
    fetchMock.mockResolvedValueOnce(fail(100, "bad session"));
    expect(await setWhatsAppProfilePhoto(new ArrayBuffer(10), "image/png")).toMatchObject({ ok: false, reason: expect.stringContaining("start the upload") });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(ok({ id: "upload:S" })).mockResolvedValueOnce(fail(100, "too big"));
    expect(await setWhatsAppProfilePhoto(new ArrayBuffer(10), "image/png")).toMatchObject({ ok: false, reason: expect.stringContaining("upload the photo") });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(ok({ id: "upload:S" })).mockResolvedValueOnce(ok({}));
    expect(await setWhatsAppProfilePhoto(new ArrayBuffer(10), "image/png")).toMatchObject({ ok: false, reason: expect.stringContaining("handle") });
  });
});
