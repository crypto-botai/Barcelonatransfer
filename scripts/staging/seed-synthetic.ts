/**
 * Fills the STAGING database with invented data.
 *
 *   APP_ENV=staging STAGING_SEED_PASSWORD='...' npm run db:seed:staging
 *
 * Nothing here is real: every name is "Test ...", every email ends in
 * @staging.invalid (a reserved domain that cannot receive mail), every phone is
 * a placeholder, every booking is dated in the future. It can be run again; it
 * updates what it created and adds nothing twice.
 *
 * The password for the test accounts comes from STAGING_SEED_PASSWORD and is
 * never printed. It must be at least 12 characters.
 *
 * Run it only through `npm run db:seed:staging`, which first runs
 * assert-staging.ts. That check is repeated here, because a seed run against
 * production would add fake customers and bookings to the live business.
 */
import { PrismaClient, type BookingStatus, type PaymentStatus, type VehicleClass } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSafeDatabase, resolveAppEnvironment } from "../../lib/env-guard";

async function main() {
  if (resolveAppEnvironment() !== "staging") throw new Error('Seeding needs APP_ENV="staging".');
  assertSafeDatabase();

  const password = process.env.STAGING_SEED_PASSWORD ?? "";
  if (password.length < 12) throw new Error("Set STAGING_SEED_PASSWORD (12+ characters) for the test accounts.");
  const passwordHash = await bcrypt.hash(password, 10);

  const prisma = new PrismaClient();
  try {
    const user = (email: string, name: string, role: "ADMIN" | "CUSTOMER" | "DRIVER", phone: string) =>
      prisma.user.upsert({
        where: { email },
        update: { name, role, phone, passwordHash },
        create: { email, name, role, phone, passwordHash, emailVerified: new Date() },
      });

    const admin = await user("admin@staging.invalid", "Test Admin", "ADMIN", "+34600000001");
    const customer = await user("customer@staging.invalid", "Test Customer", "CUSTOMER", "+34600000002");
    const driverUser = await user("driver@staging.invalid", "Test Driver", "DRIVER", "+34600000003");
    const driver2User = await user("driver2@staging.invalid", "Test Driver Two", "DRIVER", "+34600000004");

    const driver = await prisma.driver.upsert({
      where: { userId: driverUser.id },
      update: { status: "ONLINE" },
      create: { userId: driverUser.id, status: "ONLINE", whatsappNumber: "+34600000003", bio: "Synthetic driver for staging." },
    });
    await prisma.driver.upsert({
      where: { userId: driver2User.id },
      update: { status: "PENDING_APPROVAL" },
      create: { userId: driver2User.id, status: "PENDING_APPROVAL", bio: "Synthetic driver awaiting approval." },
    });

    const existingVehicle = await prisma.vehicle.findFirst({ where: { driverId: driver.id } });
    const vehicle =
      existingVehicle ??
      (await prisma.vehicle.create({
        data: { driverId: driver.id, class: "BUSINESS", make: "Mercedes-Benz", model: "E-Class", year: 2024, color: "Black", licensePlate: "0000 TST", maxPassengers: 3, maxLuggage: 3, features: ["WiFi", "Water"] },
      }));

    const day = 86_400_000;
    const at = (days: number, hour: number) => {
      const d = new Date(Date.now() + days * day);
      d.setUTCHours(hour, 0, 0, 0);
      return d;
    };

    // One booking per interesting state. confirmationCode is fixed so reruns update, not duplicate.
    const rows: Array<{ code: string; status: BookingStatus; pay: PaymentStatus; days: number; hour: number; vc: VehicleClass; driver: boolean }> = [
      { code: "STG-0001", status: "PENDING", pay: "PENDING", days: 3, hour: 9, vc: "ECONOMY", driver: false },
      { code: "STG-0002", status: "CONFIRMED", pay: "PAID", days: 2, hour: 11, vc: "BUSINESS", driver: false },
      { code: "STG-0003", status: "DRIVER_ASSIGNED", pay: "PAID", days: 1, hour: 14, vc: "BUSINESS", driver: true },
      { code: "STG-0004", status: "IN_PROGRESS", pay: "PAID", days: 0, hour: 12, vc: "LUXURY", driver: true },
      { code: "STG-0005", status: "COMPLETED", pay: "PAID", days: -2, hour: 10, vc: "BUSINESS", driver: true },
      { code: "STG-0006", status: "CANCELLED", pay: "REFUNDED", days: -1, hour: 16, vc: "SUV", driver: false },
    ];

    for (const r of rows) {
      const fare = 70;
      const data = {
        userId: customer.id,
        driverId: r.driver ? driver.id : null,
        vehicleId: r.driver ? vehicle.id : null,
        guestName: "Test Customer",
        guestEmail: "customer@staging.invalid",
        guestPhone: "+34600000002",
        pickupAddress: "Barcelona Airport Terminal 1",
        pickupLat: 41.2974,
        pickupLng: 2.0833,
        dropoffAddress: "Hotel Arts Barcelona",
        dropoffLat: 41.3851,
        dropoffLng: 2.1963,
        pickupDatetime: at(r.days, r.hour),
        passengers: 2,
        luggage: 2,
        vehicleClass: r.vc,
        flightNumber: "VY0000",
        baseFare: fare,
        totalAmount: fare,
        status: r.status,
        paymentStatus: r.pay,
        driverAmount: r.driver ? 50 : null,
        adminNotes: "Synthetic staging booking.",
      };
      await prisma.booking.upsert({ where: { confirmationCode: r.code }, update: data, create: { ...data, confirmationCode: r.code } });
    }

    // Makes the database identifiable as staging to anyone who looks at it.
    const marker = await prisma.activityLog.findFirst({ where: { action: "STAGING_MARKER" } });
    if (!marker) {
      await prisma.activityLog.create({ data: { adminId: admin.id, adminName: "seed", action: "STAGING_MARKER", entity: "Environment", details: { environment: "staging", synthetic: true } } });
    }

    console.log("Seeded staging: 4 users, 2 drivers, 1 vehicle, 6 bookings (STG-0001 to STG-0006).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Seeding failed.");
  process.exit(1);
});
