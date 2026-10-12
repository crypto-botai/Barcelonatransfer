import { describe, it, expect } from "vitest";
import { parsePhoto, MAX_PHOTO_BYTES } from "@/lib/api/v1/profile-photo";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)]);
const url = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

describe("parsePhoto", () => {
  it("accepts a real JPEG and PNG", () => {
    expect(parsePhoto(url("image/jpeg", JPEG))).toMatchObject({ mime: "image/jpeg", ext: "jpg" });
    expect(parsePhoto(url("image/png", PNG))).toMatchObject({ mime: "image/png", ext: "png" });
  });

  it("rejects a file whose label does not match what it is", () => {
    expect(() => parsePhoto(url("image/png", JPEG))).toThrow();
    expect(() => parsePhoto(url("image/jpeg", Buffer.from("<script>alert(1)</script>")))).toThrow();
  });

  it("rejects other kinds of file and malformed input", () => {
    expect(() => parsePhoto(url("application/pdf", JPEG))).toThrow();
    expect(() => parsePhoto("https://example.com/me.jpg")).toThrow();
    expect(() => parsePhoto("data:image/jpeg;base64,not base64!")).toThrow();
  });

  it("rejects a photo larger than a profile picture needs", () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(MAX_PHOTO_BYTES + 10, 3)]);
    expect(() => parsePhoto(url("image/jpeg", big))).toThrow();
  });
});
