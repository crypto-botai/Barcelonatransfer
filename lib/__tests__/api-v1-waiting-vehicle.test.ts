import { describe, it, expect } from "vitest";
import { isAirportPickup, waitingState } from "@/lib/api/v1/waiting";
import { carName, clean, publicVehicle } from "@/lib/api/v1/vehicle";

const at = (m: number) => new Date(Date.UTC(2026, 9, 13, 10, m));

describe("waitingState", () => {
  it("is null until the chauffeur has arrived", () => {
    expect(waitingState({ airport: false, arrivedAt: null, onBoardAt: null, landedAt: null, pickupAt: at(0), now: at(5) })).toBeNull();
  });

  it("gives 15 free minutes in the city, then charges 25 euros per 30 minutes or part", () => {
    const base = { airport: false, arrivedAt: at(0), onBoardAt: null, landedAt: null, pickupAt: at(0) };
    expect(waitingState({ ...base, now: at(10) })).toMatchObject({ freeMinutesLeft: 5, charge: 0, active: true });
    expect(waitingState({ ...base, now: at(16) })).toMatchObject({ paidMinutes: 1, charge: 25 });
    expect(waitingState({ ...base, now: at(45) })).toMatchObject({ paidMinutes: 30, charge: 25 });
    expect(waitingState({ ...base, now: at(46) })).toMatchObject({ paidMinutes: 31, charge: 50 });
  });

  it("counts city waiting from the booked time when the chauffeur is early", () => {
    expect(waitingState({ airport: false, arrivedAt: at(-20), onBoardAt: null, landedAt: null, pickupAt: at(0), now: at(10) })).toMatchObject({ minutesWaited: 10, charge: 0 });
  });

  it("gives 60 free minutes from landing at the airport", () => {
    const base = { airport: true, arrivedAt: at(30), onBoardAt: null, landedAt: at(0), pickupAt: at(20) };
    expect(waitingState({ ...base, now: at(59) })).toMatchObject({ freeMinutes: 60, charge: 0 });
    expect(waitingState({ ...base, now: at(75) })).toMatchObject({ paidMinutes: 15, charge: 25 });
  });

  it("stops when the passenger boards", () => {
    const w = waitingState({ airport: false, arrivedAt: at(0), onBoardAt: at(20), landedAt: null, pickupAt: at(0), now: at(90) });
    expect(w).toMatchObject({ active: false, minutesWaited: 20, paidMinutes: 5, charge: 25 });
  });
});

describe("isAirportPickup", () => {
  it("recognises the airport by coordinates and by words, but not a city address", () => {
    expect(isAirportPickup({ pickupLat: 41.2971, pickupLng: 2.0785, pickupAddress: "x" })).toBe(true);
    expect(isAirportPickup({ pickupAddress: "Barcelona El Prat Airport T1" })).toBe(true);
    expect(isAirportPickup({ pickupLat: 41.39, pickupLng: 2.17, pickupAddress: "Passeig de Gràcia 1" })).toBe(false);
  });
});

describe("vehicle details", () => {
  it("treats placeholder dashes as blank", () => {
    expect(clean("—")).toBe("");
    expect(clean(" - ")).toBe("");
    expect(clean(" Tesla ")).toBe("Tesla");
    expect(carName({ make: "—", model: "—" })).toBe("");
    expect(carName({ make: "Mercedes", model: "V-Class" })).toBe("Mercedes V-Class");
  });

  it("shows a passenger a car only when it has a real name and plate", () => {
    const real = { class: "MINIVAN", make: "Mercedes", model: "V-Class", year: 2022, color: "Black", licensePlate: "1234 ABC", maxPassengers: 7, maxLuggage: 5 };
    expect(publicVehicle(real)).toMatchObject({ name: "Mercedes V-Class", year: 2022, color: "Black", plate: "1234 ABC", seats: 7 });
    expect(publicVehicle({ ...real, make: "—", model: "—" })).toBeNull();
    expect(publicVehicle({ ...real, licensePlate: "—" })).toBeNull();
    expect(publicVehicle(null)).toBeNull();
  });
});
