import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureOppref, readOppref, sanitiseOppref, OPPREF_KEY } from "@/lib/tracking/oppref";
import { parseBookingMeta } from "@/lib/booking-meta";

/**
 * Conversion tracking, and the one rule that matters: order_created means
 * money arrived.
 *
 * The booking record is created before payment, three separate paths can
 * confirm that payment, and SumUp retries webhooks on any non-2xx. So the
 * ways to report a sale that did not happen — or to report one sale twice —
 * are all live possibilities rather than hypotheticals, and each has a test
 * below.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/** Source with comment lines removed, so a test cannot match its own prose. */
const codeOnly = (src: string) =>
  src.split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join(" ");

/** Just one function's body, not everything after it to end of file. */
function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  if (start === -1) return "";

  // Step over the parameter list first: a typed parameter can itself be an
  // object literal, and balancing braces from the signature would stop at
  // the end of that type rather than the end of the function.
  let i = src.indexOf("(", start);
  for (let parens = 0; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") { parens--; if (parens === 0) { i++; break; } }
  }

  i = src.indexOf("{", i);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

// ── oppref ───────────────────────────────────────────────────────────────

describe("the oppref click reference", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("window", {
      location: { search: "" },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is captured from the landing URL", () => {
    expect(captureOppref("?oppref=abc123")).toBe("abc123");
    expect(readOppref()).toBe("abc123");
  });

  it("survives later pages that have no parameter", () => {
    captureOppref("?oppref=abc123");
    captureOppref("");           // a later page view
    expect(readOppref()).toBe("abc123");
  });

  it("keeps the first click, not a later one", () => {
    // The click that started the session is the one the booking belongs to.
    captureOppref("?oppref=first");
    captureOppref("?oppref=second");
    expect(readOppref()).toBe("first");
  });

  it("is null for organic traffic", () => {
    expect(captureOppref("?utm_source=google")).toBeNull();
    expect(readOppref()).toBeNull();
  });

  it("refuses anything that is not a plain token", () => {
    for (const bad of ["<script>x</script>", "a b", "a\nb", "x".repeat(600)]) {
      expect(captureOppref(`?oppref=${encodeURIComponent(bad)}`), bad).toBeNull();
    }
  });

  it("does not throw when storage is blocked", () => {
    vi.stubGlobal("window", {
      location: { search: "?oppref=abc" },
      localStorage: {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
        removeItem: () => {},
      },
    });
    expect(() => captureOppref()).not.toThrow();
    expect(readOppref()).toBeNull();
  });

  it("tolerates a corrupt stored value", () => {
    store[OPPREF_KEY] = "{not json";
    expect(readOppref()).toBeNull();
  });
});

describe("oppref on the server", () => {
  it("accepts a clean token and rejects the rest", () => {
    expect(sanitiseOppref("abc-123_X")).toBe("abc-123_X");
    expect(sanitiseOppref("<b>x</b>")).toBeNull();
    expect(sanitiseOppref(42)).toBeNull();
    expect(sanitiseOppref(undefined)).toBeNull();
  });

  it("round-trips through the booking metadata block", () => {
    const meta = parseBookingMeta(`[META]${JSON.stringify({ oppref: "abc123" })}[/META]\ncustomer note`);
    expect(meta.oppref).toBe("abc123");
    // and does not leak into anything customer-facing
    expect(meta.notes).toBe("customer note");
  });

  it("is null on a booking that had no click reference", () => {
    expect(parseBookingMeta(`[META]{"extras":[]}[/META]`).oppref).toBeNull();
    expect(parseBookingMeta(null).oppref).toBeNull();
  });
});

// ── where each event fires ───────────────────────────────────────────────

describe("booking_started", () => {
  const form = rd("app/book/BookFormClient.tsx");

  it("fires only after the booking API returns an id", () => {
    const call = form.indexOf('track("booking_started"');
    expect(call).toBeGreaterThan(-1);
    expect(form.indexOf("setBookingId(json.bookingId)")).toBeLessThan(call);
  });

  it("carries the booking id, so it counts once per booking", () => {
    expect(form).toMatch(/track\("booking_started",\s*\{\s*\n\s*bookingId: json\.bookingId/);
  });

  it("sends the click reference with the booking", () => {
    expect(form).toContain("oppref: readOppref() ?? undefined");
  });
});

describe("checkout_started", () => {
  const pay = rd("app/booking/pay/[checkoutId]/page.tsx");

  it("fires when the card widget has loaded, not on page mount", () => {
    const call = pay.indexOf('track("checkout_started"');
    expect(call).toBeGreaterThan(-1);
    // Inside the widget's onLoad callback.
    expect(pay.lastIndexOf("onLoad: () => {", call)).toBeGreaterThan(-1);
  });

  it("does not fire on a payment result", () => {
    const onResponse = pay.slice(pay.indexOf("const onResponse"), pay.indexOf("try {"));
    expect(onResponse).not.toContain("track(");
  });
});

describe("order_created", () => {
  const completion = rd("lib/payment-completion.ts");
  const success    = rd("app/booking/success/page.tsx");
  const pay        = rd("app/booking/pay/[checkoutId]/page.tsx");
  const bookings   = rd("app/api/bookings/route.ts");

  it("is sent to OpenAI from finalizeSumUpPayment and nowhere else", () => {
    expect(completion).toContain("await reportOrderCreated(updated, checkout)");
    expect(completion).toContain('eventType: "order_created"');
    // The only other file allowed to mention the OpenAI sender is the sender.
    for (const f of ["app/booking/success/page.tsx", "app/booking/pay/[checkoutId]/page.tsx",
                     "app/api/bookings/route.ts", "app/book/BookFormClient.tsx"]) {
      expect(rd(f), f).not.toContain("sendOpenAiConversion");
    }
  });

  it("runs only after the booking is marked PAID and CONFIRMED", () => {
    const paidWrite = completion.indexOf('paymentStatus:   "PAID"');
    const report    = completion.indexOf("await reportOrderCreated(updated, checkout)");
    expect(paidWrite).toBeGreaterThan(-1);
    expect(paidWrite).toBeLessThan(report);
  });

  it("is not fired by booking creation", () => {
    expect(bookings).not.toContain("order_created");
  });

  it("is not fired by the SumUp widget callback", () => {
    const onResponse = pay.slice(pay.indexOf("const onResponse"), pay.indexOf("try {"));
    expect(onResponse).not.toContain("order_created");
  });

  /** The browser tags cannot be reached from the server, so there is a
   *  client copy — but only when the server has already said PAID. */
  it("fires client-side only on a server-verified PAID status", () => {
    const call = success.indexOf('track("order_created"');
    expect(call).toBeGreaterThan(-1);
    const guard = success.lastIndexOf('if (json.status === "PAID")', call);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(call);
  });
});

// ── event_id and deduplication ───────────────────────────────────────────

describe("event_id", () => {
  const completion = rd("lib/payment-completion.ts");

  it("is booking.id", () => {
    expect(completion).toContain("eventId:   booking.id");
  });

  it("is not the confirmation code or the transaction id", () => {
    const fn = codeOnly(fnBody(completion, "async function reportOrderCreated"));
    expect(fn).not.toBe("");
    expect(fn).not.toContain("confirmationCode");
    expect(fn).not.toContain("transaction_id");
  });
});

describe("the same booking cannot convert twice", () => {
  const completion = rd("lib/payment-completion.ts");

  it("skips when a conversion was already sent", () => {
    expect(completion).toContain('if (priors.some((r) => r.status === "SENT")) return;');
  });

  it("claims before sending, and the earliest claim wins", () => {
    expect(completion).toContain("const claim = await prisma.emailLog.create(");
    expect(completion).toContain("if (winner?.id !== claim.id)");
  });

  it("does not block forever on a claim that died", () => {
    expect(completion).toContain("CLAIM_TTL_MS");
  });

  it("marks the outcome so a retry knows", () => {
    expect(completion).toContain('data:  { status: result.outcome === "sent" ? "SENT" : "FAILED" }');
  });

  it("never lets a tracking failure break the payment", () => {
    const fn = fnBody(completion, "async function reportOrderCreated");
    expect(fn).toContain("catch (err)");
    expect(fn).toContain("[conversions] order_created threw");
  });
});

// ── credentials stay on the server ───────────────────────────────────────

describe("OpenAI credentials never reach the browser", () => {
  const sender = rd("lib/tracking/openai-conversions.ts");

  it("uses no NEXT_PUBLIC_ variable", () => {
    // The prose above the code explains the rule and names the prefix, so
    // only the code itself is checked.
    expect(codeOnly(sender)).not.toContain("NEXT_PUBLIC_");
    expect(codeOnly(sender)).toContain("process.env.OPENAI_CONVERSIONS_API_KEY");
  });

  it("is imported only by server code", () => {
    for (const f of ["app/booking/success/page.tsx", "app/booking/pay/[checkoutId]/page.tsx",
                     "app/book/BookFormClient.tsx", "lib/tracking/events.ts"]) {
      expect(rd(f), f).not.toContain("openai-conversions");
    }
  });

  it("never logs the key", () => {
    expect(sender).not.toMatch(/console\.\w+\([^)]*creds\.key/);
  });
});

// ── existing tags are untouched ──────────────────────────────────────────

describe("the existing Google installation is left alone", () => {
  const layout = rd("app/layout.tsx");

  it("sends to the www.elitebcn.info Analytics property and the Google Ads account, and to no other property", () => {
    expect(layout).toContain("G-PTFFJ19396");
    expect(layout).toContain("AW-18391666445");
    // The property it used to send to. The Analytics property for this site showed no data while it did.
    expect(layout).not.toContain("G-E9QZFG5WZY");
    // Every Google ID on the page is one of the two above: a third would load another container.
    const ids = new Set([...layout.matchAll(/\b(?:G|AW)-[A-Z0-9]{8,12}\b/g)].map((m) => m[0]));
    expect([...ids].sort()).toEqual(["AW-18391666445", "G-PTFFJ19396"]);
  });

  it("does not load Google's own snippet a second time", () => {
    expect(layout).not.toContain("googletagmanager.com/gtag/js");
  });

  it("still loads the heavy script through the deferred component", () => {
    expect(layout).toContain("<DeferredAnalytics");
  });

  /**
   * The shim and both config commands are inline in the head, not deferred.
   *
   * gtag.js drains dataLayer in order and discards an event it reaches before
   * that property's `config`. Deferring the config commands alongside the
   * script put every event ahead of them in the queue.
   */
  it("installs the gtag shim and both configs inline in the head", () => {
    expect(layout).toContain("function gtag(){window.dataLayer.push(arguments);}");
    expect(layout).toContain("window.gtag=gtag;");
    expect(layout).toContain("gtag('config','G-PTFFJ19396');");
    expect(layout).toContain("gtag('config','AW-18391666445');");
  });

  /**
   * The regression this file previously enshrined as a requirement.
   *
   * This site runs gtag.js, not Tag Manager. gtag.js processes only
   * `arguments` objects on dataLayer; a plain object or a plain array is
   * ignored silently. Verified against the live site: `push({event:…})` and
   * `push(["event",…])` produced no network request, while `gtag("event",…)`
   * and `push(arguments)` both reached /g/collect and /ccm/collect.
   */
  it("sends events through gtag, never as a bare object or array push", () => {
    const events = rd("lib/tracking/events.ts");
    const code = events
      .split(/\r?\n/)
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");

    // Goes through the shim.
    expect(code).toContain("window.gtag(...args)");
    expect(code).toContain('gtagCommand("event", event,');
    expect(code).toContain('gtagCommand("event", "conversion",');

    // The fallback reproduces the shim, pushing `arguments` — not an array.
    expect(code).toContain("window.dataLayer!.push(arguments)");

    // Tag Manager syntax must not come back.
    expect(code).not.toMatch(/dataLayer\s*\.\s*push\s*\(\s*\{/);
    expect(code).not.toMatch(/dataLayer\s*\.\s*push\s*\(\s*\[/);
  });

  /** The conversion page cannot wait twelve seconds for the tag. */
  it("loads analytics immediately on the payment success page", () => {
    const deferred = rd("components/layout/DeferredAnalytics.tsx");
    expect(deferred).toContain('const IMMEDIATE_PATHS = ["/booking/success"]');
    expect(deferred).toContain("useState(immediate)");
  });
});

// ── the five scenarios ───────────────────────────────────────────────────

describe("scenario E: the payment fails", () => {
  const completion = rd("lib/payment-completion.ts");

  it("markSumUpPaymentFailed never reports a conversion", () => {
    const fn = fnBody(completion, "export async function markSumUpPaymentFailed");
    expect(fn).not.toBe("");
    expect(fn).not.toContain("reportOrderCreated");
    expect(fn).not.toContain("sendOpenAiConversion");
  });

  it("a FAILED booking never reaches the reporting call", () => {
    // reportOrderCreated sits after the PAID write inside finalizeSumUpPayment,
    // which is only entered when SumUp answered PAID.
    const fn = fnBody(completion, "export async function finalizeSumUpPayment");
    expect(fn).toContain("await reportOrderCreated(updated, checkout)");
    expect(fn).toContain('if (booking.paymentStatus === "PAID") return "already-paid"');
  });
});

describe("scenario A: the customer abandons the payment", () => {
  it("the success page reports nothing while the status is PENDING", () => {
    const success = rd("app/booking/success/page.tsx");
    const call  = success.indexOf('track("order_created"');
    const guard = success.lastIndexOf('if (json.status === "PAID")', call);
    // The only path to the call is through the PAID guard.
    expect(guard).toBeGreaterThan(-1);
    expect(success.slice(guard, call)).not.toContain("}");
  });
});

describe("scenario C: confirmation is processed twice", () => {
  const completion = rd("lib/payment-completion.ts");

  it("the second pass returns before any work", () => {
    const fn = fnBody(completion, "export async function finalizeSumUpPayment");
    const guard = fn.indexOf('if (booking.paymentStatus === "PAID") return "already-paid"');
    const report = fn.indexOf("await reportOrderCreated(updated, checkout)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(report);
  });

  it("and even a concurrent pass is stopped by the claim", () => {
    const fn = fnBody(completion, "async function reportOrderCreated");
    expect(fn).toContain('if (priors.some((r) => r.status === "SENT")) return;');
    expect(fn).toContain("if (winner?.id !== claim.id)");
  });

  it("sends the same event_id both times, so OpenAI deduplicates too", () => {
    expect(fnBody(completion, "async function reportOrderCreated")).toContain("eventId:   booking.id");
  });
});

describe("scenario D: no oppref", () => {
  it("the conversion omits the field rather than sending an empty one", () => {
    const sender = rd("lib/tracking/openai-conversions.ts");
    expect(sender).toContain("...(input.oppref ? { oppref: input.oppref } : {})");
  });

  it("the booking stores no oppref key at all", () => {
    expect(rd("app/api/bookings/route.ts"))
      .toContain("...(sanitiseOppref(body.oppref) ? { oppref: sanitiseOppref(body.oppref) } : {})");
  });
});

describe("an unconfigured ads account is not an error", () => {
  it("skips cleanly when no API key is set", () => {
    const sender = rd("lib/tracking/openai-conversions.ts");
    expect(sender).toContain('return { ok: true, outcome: "not-configured" }');
  });
});
