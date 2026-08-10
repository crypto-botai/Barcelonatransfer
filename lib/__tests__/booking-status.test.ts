import { describe, it, expect } from "vitest";
import { resolveBookingStatus } from "../booking-status";

describe("resolveBookingStatus", () => {
  it("marks a journey completed even though the form posts the existing driver", () => {
    // The reported bug: the admin picked COMPLETED, the save reported success,
    // and the booking went back to DRIVER_ASSIGNED because the unchanged driver
    // on the form was read as a fresh assignment.
    expect(resolveBookingStatus({
      submittedStatus:   "COMPLETED",
      submittedDriverId: "driver-1",
      currentStatus:     "IN_PROGRESS",
      currentDriverId:   "driver-1",
    })).toBe("COMPLETED");
  });

  it("honours every status an admin can pick on a booking that has a driver", () => {
    for (const s of ["PENDING","CONFIRMED","IN_PROGRESS","COMPLETED","CANCELLED","REFUNDED"]) {
      expect(resolveBookingStatus({
        submittedStatus:   s,
        submittedDriverId: "driver-1",
        currentStatus:     "DRIVER_ASSIGNED",
        currentDriverId:   "driver-1",
      })).toBe(s);
    }
  });

  it("still advances to DRIVER_ASSIGNED when a driver is attached for the first time", () => {
    // This is what tells the customer a car has been allocated, so it has to
    // keep working — the fix must not simply stop setting the status.
    expect(resolveBookingStatus({
      submittedStatus:   "CONFIRMED",
      submittedDriverId: "driver-1",
      currentStatus:     "CONFIRMED",
      currentDriverId:   null,
    })).toBe("DRIVER_ASSIGNED");
  });

  it("advances on a driver swap, when the admin left the status alone", () => {
    expect(resolveBookingStatus({
      submittedStatus:   "DRIVER_ASSIGNED",
      submittedDriverId: "driver-2",
      currentStatus:     "DRIVER_ASSIGNED",
      currentDriverId:   "driver-1",
    })).toBe("DRIVER_ASSIGNED");
  });

  it("lets an explicit choice win over a simultaneous new assignment", () => {
    // Assigning a driver and completing in one save is unusual, but the admin
    // said COMPLETED and nothing should quietly countermand that.
    expect(resolveBookingStatus({
      submittedStatus:   "COMPLETED",
      submittedDriverId: "driver-2",
      currentStatus:     "IN_PROGRESS",
      currentDriverId:   "driver-1",
    })).toBe("COMPLETED");
  });

  it("leaves the status alone when nothing was submitted", () => {
    // Saving only a note or an amount must not move the booking.
    expect(resolveBookingStatus({
      submittedDriverId: "driver-1",
      currentStatus:     "IN_PROGRESS",
      currentDriverId:   "driver-1",
    })).toBeNull();
    expect(resolveBookingStatus({ currentStatus: "PENDING" })).toBeNull();
  });

  it("handles a booking with no driver at all", () => {
    expect(resolveBookingStatus({
      submittedStatus: "COMPLETED",
      currentStatus:   "IN_PROGRESS",
      currentDriverId: null,
    })).toBe("COMPLETED");
  });
});
