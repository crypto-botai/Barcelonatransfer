import { describe, it, expect } from "vitest";
import { seatShare, vehicleNote } from "@/lib/vehicle-group";

/**
 * Four vans for one group.
 *
 * Each vehicle is a booking of its own, because each needs its own chauffeur,
 * its own job sheet and its own row on the dispatch board. What these two
 * functions decide is whether the set is legible once it exists: who is in
 * which car, and which car of how many the driver is holding.
 */

describe("splitting the party across the cars", () => {
  it("divides evenly when it divides evenly", () => {
    const vans = [0, 1, 2, 3].map((i) => seatShare(24, 4, i));
    expect(vans).toEqual([6, 6, 6, 6]);
    expect(vans.reduce((a, b) => a + b)).toBe(24);
  });

  /** Somebody has to take the spare passenger; the first cars do. */
  it("puts the remainder in the first cars, and loses nobody", () => {
    const vans = [0, 1, 2, 3].map((i) => seatShare(22, 4, i));
    expect(vans).toEqual([6, 6, 5, 5]);
    expect(vans.reduce((a, b) => a + b)).toBe(22);

    const three = [0, 1, 2].map((i) => seatShare(10, 3, i));
    expect(three).toEqual([4, 3, 3]);
    expect(three.reduce((a, b) => a + b)).toBe(10);
  });

  it("leaves a single car with the whole party", () => {
    expect(seatShare(24, 1, 0)).toBe(24);
    expect(seatShare(3, 1, 0)).toBe(3);
  });

  /**
   * A booking for nobody is not a job. Ordering five cars for three people is
   * the office making a mistake, but it must not produce empty bookings that
   * a chauffeur is dispatched to.
   */
  it("never sends a car out with nobody in it", () => {
    const vans = [0, 1, 2, 3, 4].map((i) => seatShare(3, 5, i));
    expect(vans.every((n) => n >= 1)).toBe(true);
  });

  it("splits luggage the same way", () => {
    expect([0, 1, 2].map((i) => seatShare(7, 3, i))).toEqual([3, 2, 2]);
  });
});

describe("telling the chauffeur which car they have", () => {
  it("says nothing extra when there is only one", () => {
    expect(vehicleNote("Child seat needed", 0, 1, "EB-1234")).toBe("Child seat needed");
    expect(vehicleNote(undefined, 0, 1, "EB-1234")).toBeUndefined();
  });

  it("names the car and the group when there are several", () => {
    expect(vehicleNote(undefined, 2, 4, "EB-1234")).toBe("Vehicle 3 of 4 for group booking EB-1234.");
  });

  /** The customer's own instructions must survive; they are why it is read. */
  it("keeps the customer's note and adds to it", () => {
    expect(vehicleNote("Two wheelchairs", 0, 3, "EB-9999"))
      .toBe("Two wheelchairs Vehicle 1 of 3 for group booking EB-9999.");
  });

  /**
   * The group's reference is the first car's, which does not exist until the
   * first car does, so the first note is written without one and rewritten
   * after. This is that first pass.
   */
  it("reads sensibly before the group has a reference", () => {
    expect(vehicleNote(undefined, 0, 4, null)).toBe("Vehicle 1 of 4.");
  });

  it("does not leave a stray space when the note is blank", () => {
    expect(vehicleNote("   ", 1, 2, "EB-1")).toBe("Vehicle 2 of 2 for group booking EB-1.");
    expect(vehicleNote(null, 1, 2, "EB-1")).toBe("Vehicle 2 of 2 for group booking EB-1.");
  });
});
