import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitiseOppref } from "@/lib/tracking/oppref";

/**
 * Conformance with the documented OpenAI Ads Conversions API.
 *
 * The first version of this integration was written without the
 * specification to hand: it posted a flat object to api.openai.com with
 * field names that looked plausible. None of that would have been accepted.
 * These tests pin the request to the documented shape so it cannot drift
 * back into something invented.
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

const sender = rd("lib/tracking/openai-conversions.ts");

describe("endpoint and authentication", () => {
  it("posts to the documented host and path", () => {
    expect(sender).toContain('const ENDPOINT = "https://bzr.openai.com/v1/events"');
  });

  it("names the conversion source with the pid query parameter", () => {
    expect(sender).toContain('url.searchParams.set("pid", creds.pixelId)');
    expect(sender).toContain("process.env.OPENAI_PIXEL_ID");
  });

  it("authenticates with the dedicated conversions key", () => {
    expect(codeOnly(sender)).toContain("process.env.OPENAI_CONVERSIONS_API_KEY");
    expect(sender).toContain("Authorization:  `Bearer ${creds.key}`");
  });

  /** The ads key is a different credential and must not be used here. */
  it("does not fall back to the ads key", () => {
    expect(codeOnly(sender)).not.toContain("OPENAI_ADS_API_KEY");
  });

  it("refuses to send without both the key and the pixel id", () => {
    expect(sender).toContain("if (!key || !pixelId) return null;");
  });
});

describe("the event payload", () => {
  it("is an events array, not a bare object", () => {
    expect(sender).toContain("events: [");
  });

  it("carries every documented field", () => {
    for (const field of [
      "id:            input.eventId",
      "type:          input.eventType",
      "timestamp_ms:  input.timestampMs",
      'action_source: "web"',
      "source_url:    input.sourceUrl",
      'type:     "contents"',
      "amount:   input.amount",
      "currency: input.currency",
    ]) {
      expect(sender, field).toContain(field);
    }
  });

  /** The shape the first, un-documented attempt used. It must not return. */
  it("carries none of the invented fields from the first attempt", () => {
    const code = codeOnly(sender);
    for (const invented of ["event_name:", "event_id:", "event_time:", "advertiser_id", "value:"]) {
      expect(code, invented).not.toContain(invented);
    }
  });
});

describe("validate_only", () => {
  it("is supported as a query parameter", () => {
    expect(sender).toContain('url.searchParams.set("validate_only", "true")');
  });

  it("is driven by an environment variable, not a code change", () => {
    expect(rd("lib/payment-completion.ts"))
      .toContain('process.env.OPENAI_CONVERSIONS_VALIDATE_ONLY === "true"');
  });

  /**
   * A validate-only run records nothing at OpenAI. Marking the claim SENT
   * would suppress the real conversion for that booking permanently.
   */
  it("does not count as a recorded conversion", () => {
    expect(rd("lib/payment-completion.ts"))
      .toContain('result.outcome === "sent" ? "SENT" : "FAILED"');
    expect(sender).toContain('return { ok: true, outcome: "validated", detail }');
  });
});

describe("the click reference reaches OpenAI unchanged", () => {
  it("is passed straight through", () => {
    expect(sender).toContain("{ oppref: input.oppref }");
  });

  it("is never trimmed, re-cased or re-encoded on the way out", () => {
    expect(sender).not.toMatch(/oppref:\s*input\.oppref\.\w+\(/);
    expect(sender).not.toMatch(/encodeURI\w*\(input\.oppref/);
  });

  it("is omitted rather than nulled for organic traffic", () => {
    expect(sender).toContain("...(input.oppref ? { oppref: input.oppref } : {})");
  });
});

describe("the validator keeps real tokens intact", () => {
  /**
   * The first validator allowed only [\w.:~-], which would have rejected a
   * base64 or JWT-shaped reference outright and silently lost the click.
   */
  it("accepts base64, base64url, JWT and UUID shapes, byte for byte", () => {
    for (const token of [
      "YWJjZGVmZ2hpams=",
      "abc-_123.456",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
      "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90",
      "a+b/c=",
      "OPPREF~1:2",
    ]) {
      expect(sanitiseOppref(token), token).toBe(token);
    }
  });

  it("still refuses what could not be a token", () => {
    for (const bad of ["<b>x</b>", "a b", "a\tb", "x".repeat(600), 'a"b', "a'b", "a`b"]) {
      expect(sanitiseOppref(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("logging", () => {
  it("names every outcome an operator needs to tell apart", () => {
    for (const phrase of [
      "[conversions] not configured",
      "[conversions] authentication error",
      "[conversions] validation error",
      "[conversions] rejected",
      "[conversions] event rejected by the API",
      "[conversions] validated (nothing recorded)",
      "[conversions] sent",
    ]) {
      expect(sender, phrase).toContain(phrase);
    }
  });

  it("distinguishes auth from validation from rejection by status", () => {
    expect(sender).toContain("res.status === 401 || res.status === 403");
    expect(sender).toContain("res.status === 400 || res.status === 422");
  });

  it("never logs the key, the request body, or anything about the customer", () => {
    const logLines = sender.split(/\r?\n/).filter((l) => /console\.(log|info|warn|error)/.test(l));
    expect(logLines.length).toBeGreaterThan(4);
    for (const line of logLines) {
      for (const forbidden of ["creds.key", "guestEmail", "guestPhone", "guestName", "JSON.stringify(body)", "Authorization"]) {
        expect(line, forbidden).not.toContain(forbidden);
      }
    }
  });

  it("truncates the third party's response rather than logging it whole", () => {
    expect(sender).toContain("text.slice(0, 300)");
  });
});

describe("a conversion failure never breaks a payment", () => {
  it("times out rather than holding the confirmation open", () => {
    expect(sender).toContain("AbortController");
    expect(sender).toContain("10_000");
  });

  it("returns a result instead of throwing", () => {
    expect(sender).toContain('return { ok: false, outcome: "transport-error", detail }');
  });
});
