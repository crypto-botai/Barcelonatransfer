import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The services grid shows one owner-supplied photograph per service. Guards
 * that every card key has a photo on disk and that the photos are shown as
 * supplied, with only a legibility gradient over them.
 */
const ROOT = process.cwd();
const SRC = readFileSync(join(ROOT, "components", "sections", "ServicesSection.tsx"), "utf-8");

describe("services section", () => {
  it("has a photo on disk for every service card", () => {
    const keys = SRC.match(/SERVICE_KEYS = \[([^\]]+)\]/)![1].match(/"(\w+)"/g)!.map((s) => s.replace(/"/g, ""));
    expect(keys).toHaveLength(12);
    for (const k of keys) {
      const m = SRC.match(new RegExp("\\b" + k + ':\\s*"([^"]+)"'));
      expect(m, `${k} has no photo`).not.toBeNull();
      expect(existsSync(join(ROOT, "public", m![1])), `${m![1]} is missing from public/`).toBe(true);
    }
  });

  it("shows the photos as supplied, with no filter or tint", () => {
    expect(SRC).not.toMatch(/filter:\s*["']?(brightness|contrast|saturate|sepia)/);
    expect(SRC).not.toMatch(/mix-blend|mixBlendMode/);
  });

  it("keeps every card a link with a heading", () => {
    expect(SRC).toContain("href={SERVICE_HREFS[index]}");
    expect(SRC).toContain("<h3");
    expect(SRC).toContain('alt={title}');
  });
});
