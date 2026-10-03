import { describe, it, expect } from "vitest";
import {
  avatarHue, clockTime, dayLabel, dayOf, formatSpans, initials, listStamp, matchQuickReplies, matchesSearch,
  previewText, windowLeft,
} from "@/lib/whatsapp-ui";
import { fileProblem, MAX_MEDIA_BYTES, SENDABLE_MEDIA } from "@/lib/whatsapp-files";
import { cleanName, matchesType } from "@/lib/whatsapp-files";
import { DEFAULT_QUICK_REPLIES } from "@/lib/whatsapp-settings";

/** The small rules behind what the inbox screen shows. */

describe("previewText", () => {
  it("shows a word for media, with the caption when there is one", () => {
    expect(previewText("image", "[image]")).toBe("Photo");
    expect(previewText("image", "[image] my flight")).toBe("Photo · my flight");
    expect(previewText("document", "[document] ticket.pdf")).toBe("Document · ticket.pdf");
    expect(previewText("audio", "[voice]")).toBe("Voice message");
    expect(previewText("audio", "[audio]")).toBe("Audio");
    expect(previewText("sticker", "[sticker]")).toBe("Sticker");
    expect(previewText("location", "[location] https://x")).toBe("Location");
  });
  it("collapses whitespace in plain text", () => {
    expect(previewText("text", "  hello\n\n  there ")).toBe("hello there");
  });
});

describe("times, in Barcelona's clock", () => {
  it("writes a clock time from the Barcelona hour whatever the viewer's zone", () => {
    expect(clockTime("2026-10-05T10:05:00Z")).toBe("12:05"); // UTC+2 in October
    expect(clockTime("2026-11-02T10:05:00Z")).toBe("11:05"); // UTC+1 after the change
  });

  it("calls the same Barcelona day Today, and the one before Yesterday", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(dayLabel("2026-10-05T08:00:00Z", now)).toBe("Today");
    expect(dayLabel("2026-10-04T12:00:00Z", now)).toBe("Yesterday");
  });

  it("uses Barcelona's midnight, not UTC's", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    // 22:30 UTC on the 4th is 00:30 on the 5th in Barcelona: that is Today.
    expect(dayLabel("2026-10-04T22:30:00Z", now)).toBe("Today");
    expect(dayOf("2026-10-04T22:30:00Z")).toBe("2026-10-05");
    expect(dayOf("2026-10-04T21:30:00Z")).toBe("2026-10-04");
  });

  it("names the weekday within a week and the date beyond", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(dayLabel("2026-10-02T10:00:00Z", now)).toBe("Friday");
    expect(dayLabel("2026-09-20T10:00:00Z", now)).toBe("20 Sept");
    expect(dayLabel("2025-09-20T10:00:00Z", now)).toMatch(/2025/);
  });

  it("shows a time for today and a day name otherwise in the list", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(listStamp("2026-10-05T08:15:00Z", now)).toBe("10:15");
    expect(listStamp("2026-10-04T08:15:00Z", now)).toBe("Yesterday");
  });

  it("says how long a free reply is still possible", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(windowLeft("2026-10-05T13:30:00Z", now)).toBe("3h 30m left to reply");
    expect(windowLeft("2026-10-05T10:20:00Z", now)).toBe("20m left to reply");
    expect(windowLeft("2026-10-05T10:00:10Z", now)).toBe("1m left to reply");
    expect(windowLeft("2026-10-05T09:59:00Z", now)).toBeNull();
    expect(windowLeft(null, now)).toBeNull();
  });
});

describe("avatars", () => {
  it("uses up to two initials", () => {
    expect(initials("Ana Maria López", "+34600000001")).toBe("AM");
    expect(initials("ana", "+34600000001")).toBe("A");
    expect(initials("Émile Zola", "+33600000001")).toBe("ÉZ");
  });
  it("falls back to the last digits for a number or a symbol-only name", () => {
    expect(initials(null, "+34635383712")).toBe("12");
    expect(initials("", "+34635383712")).toBe("12");
    expect(initials("😀", "+34635383712")).toBe("12");
  });
  it("keeps the same colour for the same customer and varies between customers", () => {
    expect(avatarHue("+34600000001")).toBe(avatarHue("+34600000001"));
    expect(avatarHue("+34600000001")).not.toBe(avatarHue("+34600000002"));
    expect(avatarHue("x")).toBeGreaterThanOrEqual(0);
    expect(avatarHue("x")).toBeLessThan(360);
  });
});

describe("formatSpans", () => {
  const kinds = (t: string) => formatSpans(t).map((s) => s.kind);

  it("leaves plain text alone", () => {
    expect(formatSpans("hello there")).toEqual([{ kind: "text", text: "hello there" }]);
    expect(formatSpans("")).toEqual([]);
  });

  it("links http and https addresses, without the trailing full stop", () => {
    const spans = formatSpans("Book at https://www.elitebcn.info/book. Thanks");
    expect(spans[1]).toEqual({ kind: "link", text: "https://www.elitebcn.info/book", href: "https://www.elitebcn.info/book" });
    expect(spans[2]).toEqual({ kind: "text", text: ". Thanks" });
  });

  it("never turns a javascript: or data: address into a link", () => {
    for (const t of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x.com/y", "[click](javascript:alert(1))"]) {
      expect(formatSpans(t).some((s) => s.kind === "link")).toBe(false);
    }
  });

  it("applies WhatsApp bold, italic and strike", () => {
    expect(formatSpans("this is *very* good")).toEqual([
      { kind: "text", text: "this is " }, { kind: "bold", text: "very" }, { kind: "text", text: " good" },
    ]);
    expect(kinds("_slanted_ and ~gone~")).toEqual(["italic", "text", "strike"]);
  });

  it("does not treat arithmetic or snake_case as formatting", () => {
    expect(kinds("2 * 3 * 4")).toEqual(["text"]);
    expect(kinds("file_name_here")).toEqual(["text"]);
    expect(kinds("a * b")).toEqual(["text"]);
    expect(kinds("**")).toEqual(["text"]);
  });

  it("does not format across a line break", () => {
    expect(kinds("*one\ntwo*")).toEqual(["text"]);
  });

  it("keeps a link intact when it contains marks, and formats around it", () => {
    const spans = formatSpans("see *https://a.com/x_y_z* now");
    expect(spans.filter((s) => s.kind === "link")).toHaveLength(1);
    expect(spans.find((s) => s.kind === "link")).toMatchObject({ href: expect.stringContaining("a.com/x_y_z") });
  });

  it("never loses or adds characters", () => {
    for (const t of ["*a* b _c_ ~d~ https://x.com/y.", "plain", "* lone", "~~", "mix *bold _nested_ text* end"]) {
      const out = formatSpans(t).map((s) => s.text).join("");
      // Marks are removed, everything else is kept in order.
      expect(out.replace(/[*_~]/g, "")).toBe(t.replace(/[*_~]/g, "").replace(/\*\*/g, ""));
    }
  });
});

describe("matchQuickReplies", () => {
  it("opens on a leading slash and narrows by what follows", () => {
    expect(matchQuickReplies("/", DEFAULT_QUICK_REPLIES)!.length).toBe(DEFAULT_QUICK_REPLIES.length);
    expect(matchQuickReplies("/fl", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toEqual(["flight"]);
  });
  it("also finds a reply by a word in its text", () => {
    expect(matchQuickReplies("/passengers", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toContain("details");
  });
  it("ranks the shortcut first and does not search the wording for one or two letters", () => {
    // "f" appears in nearly every message; only the shortcut should count.
    expect(matchQuickReplies("/f", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toEqual(["flight"]);
    expect(matchQuickReplies("/th", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toEqual(["thanks"]);
    // With three letters the wording is searched too, after the shortcut matches.
    const r = matchQuickReplies("/pas", DEFAULT_QUICK_REPLIES)!.map((x) => x.shortcut);
    expect(r).toContain("details");
  });
  it("returns an empty list when nothing matches, so the box can say so", () => {
    expect(matchQuickReplies("/zzzz", DEFAULT_QUICK_REPLIES)).toEqual([]);
  });
  it("leaves normal typing alone", () => {
    for (const t of ["hello", "go to /book", "/book now", " /x", "", "/a b"]) expect(matchQuickReplies(t, DEFAULT_QUICK_REPLIES)).toBeNull();
  });
  it("offers at most eight", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, shortcut: `a${i}`, text: "t" }));
    expect(matchQuickReplies("/a", many)).toHaveLength(8);
  });
});

describe("matchesSearch", () => {
  const c = { name: "Ana López", phone: "+34635383712", lastText: "Need a car to Sitges" };
  it("matches name, number (ignoring formatting) and message, in any case", () => {
    expect(matchesSearch(c, "ana")).toBe(true);
    expect(matchesSearch(c, "LÓPEZ")).toBe(true);
    expect(matchesSearch(c, "635 383")).toBe(true);
    expect(matchesSearch(c, "+34-635")).toBe(true);
    expect(matchesSearch(c, "sitges")).toBe(true);
  });
  it("matches everything for an empty search, and nothing unrelated", () => {
    expect(matchesSearch(c, "")).toBe(true);
    expect(matchesSearch(c, "   ")).toBe(true);
    expect(matchesSearch(c, "girona")).toBe(false);
  });
  it("does not match every number just because the query has no digits", () => {
    expect(matchesSearch({ name: null, phone: "+34635383712", lastText: "" }, "zzz")).toBe(false);
  });
});

describe("files", () => {
  it("accepts photos and office documents, not programs or scripts", () => {
    for (const t of ["image/jpeg", "image/png", "application/pdf", "text/plain"]) expect(fileProblem({ type: t, size: 1000 })).toBeNull();
    for (const t of ["application/x-msdownload", "text/html", "image/svg+xml", "video/mp4", "image/gif", ""]) expect(fileProblem({ type: t, size: 1000 })).toMatch(/Only photos/);
  });
  it("refuses an empty file and one over the limit", () => {
    expect(fileProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(fileProblem({ type: "image/png", size: MAX_MEDIA_BYTES })).toBeNull();
    expect(fileProblem({ type: "image/png", size: MAX_MEDIA_BYTES + 1 })).toMatch(/4 MB/);
  });
  it("sends photos as photos and the rest as documents", () => {
    expect(SENDABLE_MEDIA["image/jpeg"].kind).toBe("image");
    expect(SENDABLE_MEDIA["application/pdf"].kind).toBe("document");
  });
  it("checks that the start of a file matches what it claims to be", () => {
    const bytes = (...b: number[]) => new Uint8Array(b);
    expect(matchesType(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(matchesType(bytes(0x89, 0x50, 0x4e, 0x47), "image/png")).toBe(true);
    expect(matchesType(bytes(0x25, 0x50, 0x44, 0x46), "application/pdf")).toBe(true);
    expect(matchesType(bytes(0x4d, 0x5a, 0x90, 0x00), "image/jpeg")).toBe(false); // an .exe renamed .jpg
    expect(matchesType(bytes(0xff, 0xd8, 0xff), "image/png")).toBe(false);
    expect(matchesType(bytes(), "image/png")).toBe(false);
    expect(matchesType(bytes(1, 2, 3), "text/plain")).toBe(true);
  });
  it("makes a file name safe to show and to send", () => {
    expect(cleanName('..\\..\\evil:"name".pdf')).not.toMatch(/[\\/:"]/);
    expect(cleanName("  spaced   name.pdf ")).toBe("spaced name.pdf");
    expect(cleanName("")).toBe("file");
    expect(cleanName("x".repeat(500))).toHaveLength(120);
  });
});
