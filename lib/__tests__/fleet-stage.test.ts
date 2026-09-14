import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VEHICLE_CATALOG } from "@/types";

/**
 * The showroom window that replaced the fleet card grid on the homepage, the
 * locale homepages and /fleet. Guards the two things that would quietly break
 * it: a fare typed by hand, and a stage photo that is not on disk.
 */
const ROOT = process.cwd();
const SRC = readFileSync(join(ROOT, "components", "sections", "FleetStage.tsx"), "utf-8");

describe("fleet stage", () => {
  it("has a transparent photo on disk for every car in the catalogue", () => {
    for (const v of VEHICLE_CATALOG) {
      const m = SRC.match(new RegExp(v.class + ':\\s*"([^"]+)"'));
      expect(m, `${v.class} has no stage image`).not.toBeNull();
      expect(existsSync(join(ROOT, "public", m![1])), `${m![1]} is missing from public/`).toBe(true);
    }
  });

  it("reads every fare from the lookup the checkout uses", () => {
    expect(SRC).toContain("getFleetFromPrice(car.class)");
    expect(SRC).toContain("getFleetFromPrice(v.class)");
    expect(SRC).not.toMatch(/€\d/);
  });

  it("shows the photos as supplied, with no filter or tint", () => {
    // The 3D version darkened black cars into silhouettes; the owner asked for
    // the photos in their real style. Nothing here may adjust their colour.
    expect(SRC).not.toMatch(/filter:\s*["']?(brightness|contrast|saturate|sepia)/);
    expect(SRC).not.toMatch(/mix-blend|mixBlendMode/);
  });

  it("is what the homepage, the locale homepages and /fleet render", () => {
    for (const p of ["app/page.tsx", "app/[locale]/page.tsx", "app/fleet/page.tsx"]) {
      const s = readFileSync(join(ROOT, p), "utf-8");
      expect(s, p).toContain("<FleetStage />");
      expect(s, p).not.toContain("<FleetSection />");
    }
  });

  it("changes car by swipe, arrows and keyboard", () => {
    expect(SRC).toContain('drag="x"');
    expect(SRC).toContain("onDragEnd");
    expect(SRC).toContain('"ArrowRight"');
    expect(SRC).toContain('aria-label="Next vehicle"');
  });
});
