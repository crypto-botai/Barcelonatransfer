import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ vehicles: [] as Array<Record<string, any>>, last: null as any }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findFirst: async (args: { where: { driverId: string; isActive: boolean }; select: Record<string, boolean> }) => {
        db.last = args;
        const hit = db.vehicles.filter((v) => v.driverId === args.where.driverId && v.isActive === args.where.isActive).sort((a, b) => a.createdAt - b.createdAt)[0];
        if (!hit) return null;
        return Object.fromEntries(Object.keys(args.select).map((k) => [k, hit[k]]));
      },
    },
  },
}));

import { driverVehicle } from "@/lib/api/v1/driver-rides";

beforeEach(() => {
  db.vehicles = [
    { driverId: "d1", isActive: true, createdAt: 2, make: "Toyota", model: "Corolla", licensePlate: "1111 AAA", maxPassengers: 3, class: "ECONOMY", imageUrl: "private", color: "black" },
    { driverId: "d1", isActive: true, createdAt: 1, make: "Mercedes", model: "V-Class", licensePlate: "7842 LBB", maxPassengers: 7, class: "VCLASS", imageUrl: "private", color: "black" },
    { driverId: "d1", isActive: false, createdAt: 0, make: "Old", model: "Car", licensePlate: "0000 ZZZ", maxPassengers: 4, class: "ECONOMY" },
    { driverId: "d2", isActive: true, createdAt: 1, make: "Other", model: "Driver", licensePlate: "2222 BBB", maxPassengers: 4, class: "ECONOMY" },
  ];
});

describe("driverVehicle (home screen)", () => {
  it("gives the oldest active car of this driver: name, plate, seats and class", async () => {
    expect(await driverVehicle("d1")).toEqual({ name: "Mercedes V-Class", plate: "7842 LBB", passengers: 7, vehicleClass: "VCLASS" });
  });

  it("is null when the driver has no active car, and never shows another driver's", async () => {
    expect(await driverVehicle("d3")).toBeNull();
  });

  it("asks the database only for the five fields it sends", async () => {
    await driverVehicle("d1");
    expect(Object.keys(db.last.select).sort()).toEqual(["class", "licensePlate", "make", "maxPassengers", "model"]);
  });
});
