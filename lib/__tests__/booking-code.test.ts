import { describe, it, expect, vi } from "vitest";
import { generateBookingCode, withUniqueBookingCode } from "@/lib/booking-code";

/** Mimics Prisma's unique-constraint error. */
function p2002(target: string[] = ["confirmationCode"]) {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } });
}

describe("generateBookingCode", () => {
  it("is 10 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateBookingCode();
      expect(c).toHaveLength(10);
      // No I, O, 0 or 1 — these codes get read aloud and written down.
      expect(c).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
    }
  });

  it("does not repeat across many draws", () => {
    // The old generator had 576 possible codes per phone number and collided in
    // production, hard-failing the booking with a 500 and sending no emails.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateBookingCode());
    expect(seen.size).toBe(5000);
  });

  it("reveals nothing about the customer", () => {
    // The old code embedded six digits of the customer's own phone number, so
    // anyone holding that number could reach their booking in ~576 guesses.
    const phone = "635383712";
    const codes = Array.from({ length: 300 }, () => generateBookingCode());
    for (const c of codes) {
      expect(c).not.toContain(phone.slice(-6));
    }

    // The old format was 6 phone digits + 2 letters. Length alone rules it out,
    // and every character is drawn from the CSPRNG rather than the phone.
    //
    // Deliberately NOT asserting that a code never starts with six digits: the
    // alphabet contains eight digits, so a random code opens with six of them
    // about once in 4,096 draws. That assertion failed intermittently and was
    // testing randomness rather than the property that matters.
    expect(new Set(codes.map((c) => c.length))).toEqual(new Set([10]));
  });
});

describe("withUniqueBookingCode", () => {
  it("passes a fresh code to the creator and returns its result", async () => {
    const create = vi.fn(async (code: string) => ({ id: "bk1", confirmationCode: code }));
    const out = await withUniqueBookingCode(create);
    expect(create).toHaveBeenCalledOnce();
    expect(out.confirmationCode).toHaveLength(10);
  });

  it("retries with a different code when one is already taken", async () => {
    const codes: string[] = [];
    let calls = 0;
    const create = vi.fn(async (code: string) => {
      codes.push(code);
      if (++calls < 3) throw p2002();
      return { id: "bk1", confirmationCode: code };
    });

    const out = await withUniqueBookingCode(create);
    expect(calls).toBe(3);
    expect(out.confirmationCode).toBe(codes[2]);
    // Each attempt must use a genuinely new code, not retry the same one.
    expect(new Set(codes).size).toBe(3);
  });

  it("propagates a non-collision database error immediately", async () => {
    // A dropped connection or a bad column must surface, not be retried away.
    const other = Object.assign(new Error("connection lost"), { code: "P1001" });
    const create = vi.fn(async () => { throw other; });
    await expect(withUniqueBookingCode(create)).rejects.toThrow("connection lost");
    expect(create).toHaveBeenCalledOnce();
  });

  it("ignores a unique violation on some other field", async () => {
    const create = vi.fn(async () => { throw p2002(["guestEmail"]); });
    await expect(withUniqueBookingCode(create)).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledOnce();
  });

  it("gives up after the attempt limit rather than looping forever", async () => {
    const create = vi.fn(async () => { throw p2002(); });
    await expect(withUniqueBookingCode(create, 3)).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(3);
  });
});
