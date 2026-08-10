import { describe, it, expect } from "vitest";
import { RIDE_STAGES, STAGE_META, canTransition, nextStage, waitMinutes } from "@/lib/ride-stages";

describe("ride stage progression", () => {
  it("starts a journey only at the first stage", () => {
    expect(canTransition(null, "ON_THE_WAY")).toBe(true);
    // A driver cannot jump straight to collecting the passenger.
    expect(canTransition(null, "ARRIVED")).toBe(false);
    expect(canTransition(null, "ON_BOARD")).toBe(false);
    expect(canTransition(null, "COMPLETED")).toBe(false);
  });

  it("moves forward one step at a time", () => {
    expect(canTransition("ON_THE_WAY", "ARRIVED")).toBe(true);
    expect(canTransition("ARRIVED", "WAITING_PASSENGER")).toBe(true);
    expect(canTransition("WAITING_PASSENGER", "ON_BOARD")).toBe(true);
    expect(canTransition("ON_BOARD", "COMPLETED")).toBe(true);
  });

  it("lets a punctual passenger skip the waiting stage", () => {
    // Arrived and the passenger is already standing there.
    expect(canTransition("ARRIVED", "ON_BOARD")).toBe(true);
  });

  it("refuses to skip anything else", () => {
    expect(canTransition("ON_THE_WAY", "ON_BOARD")).toBe(false);
    expect(canTransition("ON_THE_WAY", "COMPLETED")).toBe(false);
    expect(canTransition("ARRIVED", "COMPLETED")).toBe(false);
  });

  it("never goes backwards", () => {
    // The customer has already been told the driver arrived; the timeline must
    // not contradict the message they received.
    expect(canTransition("ARRIVED", "ON_THE_WAY")).toBe(false);
    expect(canTransition("ON_BOARD", "ARRIVED")).toBe(false);
    expect(canTransition("COMPLETED", "ON_BOARD")).toBe(false);
  });

  it("refuses to repeat the stage it is already at", () => {
    for (const s of RIDE_STAGES) expect(canTransition(s, s), s).toBe(false);
  });

  it("is finished after the last stage", () => {
    expect(nextStage("COMPLETED")).toBeNull();
    expect(nextStage(null)).toBe("ON_THE_WAY");
    expect(nextStage("ARRIVED")).toBe("WAITING_PASSENGER");
  });
});

describe("stage metadata", () => {
  it("defines an action and label for every stage", () => {
    for (const s of RIDE_STAGES) {
      expect(STAGE_META[s]?.action, s).toBeTruthy();
      expect(STAGE_META[s]?.label, s).toBeTruthy();
    }
  });

  it("does not message the customer while waiting for them", () => {
    // Telling someone "we are waiting for you" nags rather than helps; the
    // stage exists to time the wait for the operator.
    expect(STAGE_META.WAITING_PASSENGER.event).toBeNull();
  });

  it("messages the customer at the moments that reassure them", () => {
    expect(STAGE_META.ON_THE_WAY.event).toBe("DRIVER_EN_ROUTE");
    expect(STAGE_META.ARRIVED.event).toBe("DRIVER_ARRIVED");
    expect(STAGE_META.ON_BOARD.event).toBe("RIDE_ON_BOARD");
    expect(STAGE_META.COMPLETED.event).toBe("RIDE_COMPLETED");
  });
});

describe("waiting time", () => {
  it("measures arrival to boarding in whole minutes", () => {
    const arrived = new Date("2026-08-10T10:00:00Z");
    const onBoard = new Date("2026-08-10T10:23:00Z");
    expect(waitMinutes(arrived, onBoard)).toBe(23);
  });

  it("is unknown when either stage was never recorded", () => {
    expect(waitMinutes(null, new Date())).toBeNull();
    expect(waitMinutes(new Date(), null)).toBeNull();
  });

  it("never reports a negative wait from clock skew", () => {
    const arrived = new Date("2026-08-10T10:05:00Z");
    const onBoard = new Date("2026-08-10T10:00:00Z");
    expect(waitMinutes(arrived, onBoard)).toBeNull();
  });
});
