import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Animation on this site has to stop when the visitor has asked it to.
 *
 * Thirty-four components animate with framer-motion and two of them called
 * useReducedMotion, so the other thirty-two, including the booking form, kept
 * moving for somebody whose device says not to. For a vestibular disorder that
 * is a symptom rather than a preference.
 *
 * The fix is deliberately not thirty-two edits: MotionProvider sets
 * reducedMotion="user" once at the root and every motion component underneath
 * inherits it, and globals.css covers the CSS half that framer-motion cannot
 * see. These guard both halves, because the failure is invisible to anyone
 * developing without the setting turned on.
 */
const ROOT = process.cwd();
const LAYOUT = readFileSync(join(ROOT, "app", "layout.tsx"), "utf-8");
const CSS = readFileSync(join(ROOT, "app", "globals.css"), "utf-8");
const PROVIDER = readFileSync(
  join(ROOT, "components", "layout", "MotionProvider.tsx"),
  "utf-8",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("reduced motion", () => {
  it("sets the preference once, at the root", () => {
    expect(PROVIDER).toContain('reducedMotion="user"');
    expect(PROVIDER).toContain("MotionConfig");
  });

  it("wraps the whole tree, so no component has to remember", () => {
    expect(LAYOUT).toContain("import MotionProvider");
    expect(LAYOUT).toContain("<MotionProvider>");
    expect(LAYOUT).toContain("</MotionProvider>");
    // Inside the providers and around {children}, or it covers nothing.
    const open = LAYOUT.indexOf("<MotionProvider>");
    const close = LAYOUT.indexOf("</MotionProvider>");
    const children = LAYOUT.indexOf("{children}");
    expect(open).toBeGreaterThan(-1);
    expect(children).toBeGreaterThan(open);
    expect(close).toBeGreaterThan(children);
  });

  it("stops CSS animation too, which no provider can reach", () => {
    const blocks = CSS.split("@media (prefers-reduced-motion: reduce)");
    expect(blocks.length).toBeGreaterThan(1);
    const universal = blocks.find((b) => b.trimStart().startsWith("{") && /\*,/.test(b.slice(0, 400)));
    expect(universal, "expected a universal selector inside a reduced-motion block").toBeDefined();
    expect(universal!).toContain("animation-duration");
    expect(universal!).toContain("transition-duration");
  });

  it("keeps a press readable on a touch device", () => {
    // .btn-gold:active only undid the hover lift, which a phone never shows,
    // and .btn-outline-gold had no :active rule at all.
    expect(CSS).toMatch(/\.btn-gold:active\s*\{[^}]*transform:\s*translateY\(1px\)/);
    expect(CSS).toMatch(/\.btn-outline-gold:active\s*\{/);
  });
});

describe("booking form motion", () => {
  const FORM = readFileSync(join(ROOT, "app", "book", "BookFormClient.tsx"), "utf-8");

  it("moves a step in the direction the user sent it", () => {
    expect(FORM).toContain("const stepVariants: Variants");
    expect(FORM).toContain("custom={stepDir}");
    expect(FORM).toContain('<AnimatePresence mode="wait" custom={stepDir}>');
    // The fixed offsets that played "forward" even when going back.
    expect(FORM).not.toContain("exit={{ opacity: 0, x: -20 }}");
  });

  it("routes every step change through the one place that tracks direction", () => {
    // setStep survives only as the raw useState setter inside goToStep.
    const rawCalls = FORM.match(/(?<!go)(?<!\w)setStep\(/g) ?? [];
    expect(rawCalls).toHaveLength(1);
    expect(FORM).toContain("const goToStep = useCallback");
  });
});

// Walks and reads every .tsx under app/ and components/. Under a parallel
// run that can pass vitest's 5 s default, which reads as a failure it is not.
describe("animated components", { timeout: 30_000 }, () => {
  it("no longer depends on each file remembering the preference", () => {
    const animated = walk(join(ROOT, "app"))
      .concat(walk(join(ROOT, "components")))
      .filter((f) => readFileSync(f, "utf-8").includes("framer-motion"));

    // The point of the root provider: this number is allowed to be large.
    expect(animated.length).toBeGreaterThan(20);
    // And the provider itself must be one of them, or nothing is inherited.
    expect(animated.some((f) => f.endsWith("MotionProvider.tsx"))).toBe(true);
  });
});

describe("booking form guidance", () => {
  const FORM = readFileSync(join(ROOT, "app", "book", "BookFormClient.tsx"), "utf-8");

  it("says what is missing instead of just greying the button out", () => {
    // Both Continue buttons went to opacity-40 with no explanation. On a phone
    // there is no cursor to change, so the primary button of the funnel simply
    // did nothing when tapped.
    expect(FORM).toContain("function StillNeeded");
    expect(FORM).toContain("const step1Missing");
    expect(FORM).toContain("const contactMissing");
    expect(FORM).toContain("aria-describedby=\"step1-missing\"");
    expect(FORM).toContain("aria-describedby=\"contact-missing\"");
  });

  it("announces the change without interrupting a screen reader mid-field", () => {
    // The list rewrites on every keystroke, so assertive would talk over typing.
    expect(FORM).toMatch(/aria-live="polite"/);
    expect(FORM).not.toMatch(/aria-live="assertive"/);
  });

  it("explains every condition the buttons actually gate on", () => {
    for (const cond of ["pickupLat", "dropoffLat", "data.date", "data.time", "guestName", "guestEmail", "phoneValid"]) {
      expect(FORM.slice(FORM.indexOf("const step1Missing"), FORM.indexOf("].filter(Boolean) as string[];", FORM.indexOf("const contactMissing"))), cond).toContain(cond);
    }
  });
});

describe("no page wider than the phone", () => {
  /**
   * The homepage measured 697 px wide on a 393 px phone and iOS Safari, which
   * ignores overflow-x: hidden on the body, showed the whole site at 56%. The
   * cause was an sr-only span (position: absolute) inside a horizontal scroller
   * that was not positioned, so the span escaped the scroller and stretched the
   * document. The rule below makes every scroller contain its own absolutes.
   */
  it("makes every horizontal scroller a containing block", () => {
    expect(CSS).toMatch(/\.overflow-x-auto,\s*\.overflow-x-scroll\s*\{\s*position:\s*relative;\s*\}/);
  });

  it("keeps the root clip rather than hidden, so sticky keeps working", () => {
    const html = CSS.slice(CSS.indexOf("  html {"), CSS.indexOf("  body {"));
    expect(html).toContain("overflow-x: clip;");
    expect(html).not.toMatch(/overflow-x:\s*hidden/);
  });
});
