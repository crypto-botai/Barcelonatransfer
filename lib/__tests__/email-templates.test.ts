import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  emailDocument, passwordResetCard, newsletterWelcomeCard,
  contactEnquiryCard, adminNoticeCard,
} from "@/lib/email/premium";

/**
 * Every email the business sends, on one template.
 *
 * Six of them were not. They were written before lib/email/premium.ts
 * existed and nobody went back: a contact enquiry as a bare <div>, a
 * newsletter welcome as another, an operations alert as a grey box, the
 * admin test as a single <p>, the daily briefing as its own document, and —
 * worst of the lot — the password reset, styled with a <style> block and CSS
 * classes, which Gmail strips. What arrived there was unstyled black text on
 * white with a bare link in it, which is what a phishing attempt looks like,
 * on the one message where a customer is deciding whether to trust us.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("no email is built outside the template", () => {
  /**
   * Only the shell may declare a document.
   *
   * The first version of this test asked whether each *file* mentioned
   * emailDocument, and lib/resend.ts does — twenty times. So a hand-built
   * cream-coloured admin template sitting in the same file passed, and went
   * on being the one email that looked like a different company's. Counting
   * documents rather than files is what actually catches that: a second
   * <!DOCTYPE outside premium.ts is a second template by definition.
   */
  it("no email declares its own document outside the shell", () => {
    const files: string[] = [];
    for (const dir of ["app", "lib"]) {
      (function walk(d: string) {
        for (const e of readdirSync(d)) {
          const p = join(d, e);
          if (/node_modules|\.next|__tests__/.test(p)) continue;
          if (statSync(p).isDirectory()) walk(p);
          else if (e.endsWith(".ts") || e.endsWith(".tsx")) files.push(p);
        }
      })(join(ROOT, dir));
    }

    const rogue: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f).replace(/\\/g, "/");
      if (rel === "lib/email/premium.ts") continue;
      const s = readFileSync(f, "utf-8");
      if (!s.includes("<!DOCTYPE")) continue;
      // An HTML *page* returned to a browser is not an email.
      if (/new NextResponse\(|Content-Type": "text\/html/.test(s)) continue;
      /**
       * The one deliberate exception: the monthly newsletter is a magazine,
       * not a receipt. It is a light editorial layout that says so —
       * color-scheme: light — and putting it in the transactional shell
       * would be flattening two different jobs into one. It is allowed by
       * name so that a *new* rogue template still fails this test.
       */
      if (s.includes("The Barcelona Travel Insider")) continue;
      rogue.push(rel);
    }
    expect(rogue, `these build an email document by hand:\n${rogue.join("\n")}`).toEqual([]);
  });

  /** And every sender still has to reach for the shell. */
  it("every file that sends email uses emailDocument", () => {
    const files: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (/node_modules|\.next|__tests__/.test(p)) continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith(".ts") || e.endsWith(".tsx")) files.push(p);
      }
    })(join(ROOT, "app"));
    files.push(join(ROOT, "lib", "resend.ts"));

    const offTemplate: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, "utf-8");
      if (!/emails\.send\(|sendEmail\(/.test(s)) continue;
      if (s.includes("emailDocument(")) continue;
      offTemplate.push(relative(ROOT, f).replace(/\\/g, "/"));
    }
    expect(offTemplate, `these build email HTML by hand:\n${offTemplate.join("\n")}`).toEqual([]);
  });

  /** A <style> block is the one thing Gmail throws away outright. */
  it("no email depends on a stylesheet", () => {
    // Comments explaining this very rule name the tag, so they are stripped
    // before looking: what matters is markup, not prose about markup.
    const code = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const f of [
      "lib/email/premium.ts",
      "app/api/auth/forgot-password/route.ts",
      "app/api/contact/route.ts",
      "app/api/newsletter/subscribe/route.ts",
      "app/api/cron/daily/route.ts",
    ]) {
      expect(code(rd(f)), f).not.toMatch(/<style[\s>]/);
    }
  });

  it("declares a colour scheme, so Gmail stops repainting it", () => {
    const premium = rd("lib/email/premium.ts");
    expect(premium).toContain('<meta name="color-scheme" content="dark"/>');
    expect(premium).toContain('<meta name="supported-color-schemes" content="dark"/>');
  });
});

describe("the eyebrow escapes what it is given", () => {
  /**
   * Written twice now: `eyebrow("Operations &middot; Flight watch")` renders
   * the entity as literal text, because eyebrow() runs esc() over it. The
   * separator has to be the character, not the entity.
   */
  it("no eyebrow is passed an HTML entity", () => {
    const bad = [...rd("lib/email/premium.ts").matchAll(/eyebrow\("([^"]*)"\)/g)]
      .map((m) => m[1])
      .filter((s) => /&[a-z]+;|&#\d+;/i.test(s));
    expect(bad, `entities would render literally: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("the rebuilt emails", () => {
  it("the password reset carries the link twice, and says what it does", () => {
    const html = passwordResetCard({
      name: "Aaron", email: "a@b.com",
      resetUrl: "https://www.elitebcn.info/auth/reset-password?token=abc123",
      expiresIn: "one hour",
    });
    // Once as a button, once as text somebody can copy.
    expect(html.split("https://www.elitebcn.info/auth/reset-password?token=abc123").length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain("expires in one hour");
    expect(html).toContain("If you did not ask for this");
    expect(html).toContain("a@b.com");
  });

  it("the enquiry shows the customer's details and escapes them", () => {
    const html = contactEnquiryCard({
      name: "<script>x</script>",
      email: "m@example.com",
      phone: "+34 600 111 222",
      message: "Line one\nLine two & three",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("m@example.com");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("&amp; three");
  });

  it("the enquiry says the phone is missing rather than printing nothing", () => {
    expect(contactEnquiryCard({ name: "A", email: "a@b.com", message: "hi" })).toContain("Not given");
  });

  it("the newsletter welcome can be unsubscribed from", () => {
    const html = newsletterWelcomeCard({ name: "Aaron", unsubscribeUrl: "https://x/unsub" });
    expect(html).toContain("https://x/unsub");
    expect(html).toContain("Unsubscribe");
  });

  it("the operations notice takes a title, a body and optional facts", () => {
    const html = adminNoticeCard({
      title: "New lead", body: "Line one\nLine two",
      facts: [["Name", "Thomas"], ["Phone", ""]],
      ctaUrl: "https://x/admin", ctaText: "Open",
    });
    expect(html).toContain("New lead");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("Thomas");
    // An empty value is dropped rather than printed as a blank row.
    expect(html).not.toContain(">Phone<");
    expect(html).toContain("https://x/admin");
  });

  it("all of them render a full document with the masthead and footer", () => {
    for (const [name, card] of [
      ["reset", passwordResetCard({ email: "a@b.com", resetUrl: "https://x", expiresIn: "one hour" })],
      ["contact", contactEnquiryCard({ name: "A", email: "a@b.com", message: "hi" })],
      ["newsletter", newsletterWelcomeCard({ unsubscribeUrl: "https://x" })],
      ["notice", adminNoticeCard({ title: "T" })],
    ] as const) {
      const doc = emailDocument(card, "preheader");
      expect(doc, name).toContain("<!DOCTYPE html>");
      expect(doc, name).toContain("ELITE");
      expect(doc, name).toContain("Licensed VTC Operator");
      expect(doc, name).toContain('name="color-scheme"');
    }
  });
});
