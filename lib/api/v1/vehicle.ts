import { prisma } from "@/lib/prisma";

/**
 * The car a driver drives, as the apps see it.
 *
 * One rule decides "the" car everywhere (the driver's home screen, the passenger's ride): the driver's active vehicle that was
 * changed most recently, so when a driver fills in their own car it is the one everyone sees. Placeholder text the office used
 * before real details existed (a dash) counts as blank, and a passenger is only ever shown a car with a real make, model and plate.
 */

const PLACEHOLDER = /^[\s\-–—_.?]*$/;

export const clean = (s: string | null | undefined): string => (s && !PLACEHOLDER.test(s) ? s.trim() : "");

export function carName(v: { make: string; model: string }): string {
  return [clean(v.make), clean(v.model)].filter(Boolean).join(" ");
}

export const VEHICLE_SELECT = {
  id: true, class: true, make: true, model: true, year: true, color: true, licensePlate: true,
  maxPassengers: true, maxLuggage: true,
} as const;

export function currentVehicleWhere(driverId: string) {
  return { where: { driverId, isActive: true }, orderBy: { updatedAt: "desc" as const } };
}

export async function currentVehicle(driverId: string) {
  return prisma.vehicle.findFirst({ ...currentVehicleWhere(driverId), select: VEHICLE_SELECT });
}

type VehicleRow = { class: unknown; make: string; model: string; year: number; color: string; licensePlate: string; maxPassengers: number; maxLuggage: number };

/** What a passenger may know about the car, or null when the details are not real yet. */
export function publicVehicle(v: VehicleRow | null | undefined) {
  if (!v) return null;
  const name = carName(v);
  const plate = clean(v.licensePlate);
  if (!name || !plate) return null;
  return {
    make: clean(v.make),
    model: clean(v.model),
    name,
    year: v.year > 1980 ? v.year : null,
    color: clean(v.color) || null,
    plate,
    vehicleClass: String(v.class),
    seats: v.maxPassengers > 0 ? v.maxPassengers : null,
  };
}

export async function vehiclePhotos(driverId: string): Promise<{ front: string | null; back: string | null }> {
  const d = await prisma.driver.findUnique({ where: { id: driverId }, select: { vehiclePhotoFront: true, vehiclePhotoBack: true } });
  return { front: d?.vehiclePhotoFront ?? null, back: d?.vehiclePhotoBack ?? null };
}
