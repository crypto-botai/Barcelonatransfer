import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { driverVehicle, requireDriver } from "@/lib/api/v1/driver-rides";
import { currentVehicle, vehiclePhotos } from "@/lib/api/v1/vehicle";

export const dynamic = "force-dynamic";

const CLASSES = ["ECONOMY", "BUSINESS", "LUXURY", "FIRST_CLASS", "ELECTRIC_VIP", "SUV", "LUXURY_SUV", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const body = z.object({
  make: text(40),
  model: text(40),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  color: text(30),
  plate: text(16).transform((s) => s.toUpperCase()),
  vehicleClass: z.enum(CLASSES),
  seats: z.number().int().min(1).max(20),
  luggage: z.number().int().min(0).max(20).optional(),
});

async function snapshot(driverId: string) {
  return { vehicle: await driverVehicle(driverId), photos: await vehiclePhotos(driverId) };
}

/** GET /api/v1/driver/vehicle: the driver's car as passengers will see it, with the photos they added. */
export const GET = apiHandler(
  "driver.vehicle.get",
  async ({ auth }) => {
    const driver = await requireDriver(auth!.userId);
    return snapshot(driver.id);
  },
  { auth: { roles: ["DRIVER"] } },
);

/**
 * PUT /api/v1/driver/vehicle
 *
 * The driver filling in their own car: make, model, year, colour, number plate, class and seats. It updates the car they drive
 * now (or adds one when there is none), and from then on that is the car passengers see for their rides. Never touches another
 * driver's vehicle.
 */
export const PUT = apiHandler(
  "driver.vehicle.set",
  async ({ req, auth, requestId }) => {
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    const data = {
      make: input.make, model: input.model, year: input.year, color: input.color, licensePlate: input.plate,
      class: input.vehicleClass, maxPassengers: input.seats, maxLuggage: input.luggage ?? Math.max(1, Math.floor(input.seats / 2)),
    };
    const existing = await currentVehicle(driver.id);
    const saved = existing
      ? await prisma.vehicle.update({ where: { id: existing.id }, data })
      : await prisma.vehicle.create({ data: { ...data, driverId: driver.id, features: [], isActive: true } });
    await audit({ action: "API_V1_VEHICLE_SET", entity: "vehicle", entityId: saved.id, actorId: auth!.userId, actorRole: "DRIVER", requestId, ip: clientAddress(req), details: { plate: input.plate } });
    return snapshot(driver.id);
  },
  { auth: { roles: ["DRIVER"] } },
);
