import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ vehicles: [] as Array<Record<string, any>>, last: null as any }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findFirst: async (args: { where: { driverId: string; isActive: boolean }; select: Record<string, boolean> }) => {
        db.last = args;
        const hit = db.vehicles.filter((v) => v.driverId === args.where.driverId && v.isActive === args.where.isActive).sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (!hit) return null;
        return Object.fromEntries(Object.keys(args.select).map((k) => [k, hit[k]]));
      },
    },
  },
}));

import { driverVehicle } from "@/lib/api/v1/driver-rides";

beforeEach(() => {
  db.vehicles = [
    { driverId: "d1", isActive: true, updatedAt: 1, make: "Toyota", model: "Corolla", licensePlate: "1111 AAA", maxPassengers: 3, class: "ECONOMY", imageUrl: "private", color: "black", year: 2020, maxLuggage: 2 },
    { driverId: "d1", isActive: true, updatedAt: 2, make: "Mercedes", model: "V-Class", licensePlate: "7842 LBB", maxPassengers: 7, class: "VCLASS", imageUrl: "private", color: "black", year: 2022, maxLuggage: 5 },
    { driverId: "d1", isActive: false, updatedAt: 9, make: "Old", model: "Car", licensePlate: "0000 ZZZ", maxPassengers: 4, class: "ECONOMY" },
    { driverId: "d2", isActive: true, updatedAt: 1, make: "Other", model: "Driver", licensePlate: "2222 BBB", maxPassengers: 4, class: "ECONOMY" },
  ];
});

describe("driverVehicle (home screen)", () => {
  it("gives the most recently updated active car of this driver", async () => {
    expect(await driverVehicle("d1")).toMatchObject({ name: "Mercedes V-Class", plate: "7842 LBB", passengers: 7, vehicleClass: "VCLASS", year: 2022, color: "black" });
  });

  it("is null when the driver has no active car, and never shows another driver's", async () => {
    expect(await driverVehicle("d3")).toBeNull();
  });

  it("never asks the database for photos, documents or notes", async () => {
    await driverVehicle("d1");
    expect(Object.keys(db.last.select)).not.toContain("imageUrl");
    expect(Object.keys(db.last.select).sort()).toEqual(["class", "color", "id", "licensePlate", "make", "maxLuggage", "maxPassengers", "model", "year"]);
  });

  it("treats placeholder dashes as no name", async () => {
    db.vehicles.push({ driverId: "d4", isActive: true, updatedAt: 1, make: "—", model: "—", licensePlate: "3333 CCC", maxPassengers: 4, class: "ECONOMY", year: 2020, color: "—", maxLuggage: 2 });
    expect(await driverVehicle("d4")).toMatchObject({ name: "", color: null, plate: "3333 CCC" });
  });
});
