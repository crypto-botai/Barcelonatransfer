import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPickupDateTime } from "@/lib/datetime";
import {
  sendDriverAssignedEmail, sendDriverBookingDetailsEmail, sendTemporaryPassword,
  sendPartnerJobEmail, sendAdminPartnerDispatchAlert, sendAdminAlertEmail, sendPartnerConvertedEmail,
} from "@/lib/resend";
import { notify } from "@/lib/notifications/service";

/**
 * Fleet partner companies.
 *
 * A partner is an outside company with its own drivers. The office sends it a
 * job with a payout; the company dispatches one of its drivers, choosing what
 * that driver is shown; the customer sees only the driver, branded Elite BCN.
 * Everything a partner may do goes through here, so the admin side and the
 * partner side cannot drift on what "dispatch" or "earned" means.
 */

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

// ─── Session ─────────────────────────────────────────────────

export async function requirePartner() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!session || u?.role !== "PARTNER" || !u.id) return null;
  const partner = await prisma.fleetPartner.findUnique({ where: { userId: u.id } });
  if (!partner || !partner.active) return null;
  return partner;
}

// ─── Temporary passwords ─────────────────────────────────────

export function temporaryPassword(): string {
  return randomBytes(5).toString("hex").toUpperCase() + randomBytes(2).readUInt16BE(0).toString().slice(0, 4);
}

// ─── Creating a partner (admin) ──────────────────────────────

export async function createPartner(input: {
  name: string; contactName: string; email: string; phone: string;
  taxId?: string; address?: string; notes?: string;
  /**
   * The email already belongs to a customer account, and the office wants
   * that account to become the company login. Their password is kept; the
   * role changes and a company record is attached. Drivers and admins are
   * never converted.
   */
  convertExisting?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, include: { driver: { select: { id: true } }, fleetPartner: { select: { id: true } } } });

  if (existing && input.convertExisting) {
    if (existing.fleetPartner) throw new Error("That account is already a fleet company");
    if (existing.role !== "CUSTOMER" || existing.driver) throw new Error("Only a customer account can be converted into a company login");
    const partner = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: existing.id }, data: { role: "PARTNER", name: input.contactName.trim(), phone: input.phone.trim() } });
      return tx.fleetPartner.create({
        data: {
          userId: existing.id,
          name: input.name.trim(),
          contactName: input.contactName.trim(),
          email,
          phone: input.phone.trim(),
          taxId: input.taxId?.trim() || null,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });
    await sendPartnerConvertedEmail({ to: email, contactName: input.contactName, companyName: partner.name })
      .catch((e) => console.error("[partner] converted email:", e));
    return partner;
  }

  if (existing) throw new Error("EXISTS");

  const password = temporaryPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const partner = await prisma.fleetPartner.create({
    data: {
      name: input.name.trim(),
      contactName: input.contactName.trim(),
      email,
      phone: input.phone.trim(),
      taxId: input.taxId?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      user: {
        create: {
          name: input.contactName.trim(),
          email,
          phone: input.phone.trim(),
          passwordHash,
          mustChangePassword: true,
          role: "PARTNER",
        },
      },
    },
  });

  await sendTemporaryPassword({ to: email, name: input.contactName, password, portal: "partner" })
    .catch((e) => console.error("[partner] welcome email:", e));

  return partner;
}

// ─── Company drivers (partner) ───────────────────────────────

const CLASS_CAPACITY: Record<string, { max: number; luggage: number }> = {
  ECONOMY:        { max: 3,  luggage: 2 },
  BUSINESS:       { max: 3,  luggage: 3 },
  LUXURY:         { max: 3,  luggage: 3 },
  ELECTRIC_VIP:   { max: 3,  luggage: 3 },
  MINIVAN:        { max: 7,  luggage: 5 },
  LUXURY_MINIVAN: { max: 7,  luggage: 5 },
  MINIBUS:        { max: 16, luggage: 12 },
};

export async function createPartnerDriver(partnerId: string, input: {
  name: string; email: string; phone: string; licenseNumber?: string;
  vehicleMake: string; vehicleModel: string; vehiclePlate: string; vehicleClass: string; vehicleColor?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("That email already has an account");

  const password = temporaryPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const cap = CLASS_CAPACITY[input.vehicleClass] ?? { max: 4, luggage: 3 };

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      passwordHash,
      mustChangePassword: true,
      role: "DRIVER",
      driver: {
        create: {
          status: "APPROVED",
          partnerId,
          whatsappNumber: input.phone.trim(),
          licenseNumber: input.licenseNumber?.trim() || null,
          vehicles: {
            create: {
              licensePlate: input.vehiclePlate.trim().toUpperCase(),
              class: input.vehicleClass as never,
              make: input.vehicleMake.trim(),
              model: input.vehicleModel.trim(),
              year: new Date().getFullYear(),
              color: input.vehicleColor?.trim() || "Black",
              maxPassengers: cap.max,
              maxLuggage: cap.luggage,
              isActive: true,
            },
          },
        },
      },
    },
    include: { driver: { include: { vehicles: true } } },
  });

  await sendTemporaryPassword({ to: email, name: input.name, password, portal: "driver" })
    .catch((e) => console.error("[partner] driver welcome email:", e));

  return user.driver!;
}

// ─── Sending a job to a partner (admin) ──────────────────────

export async function assignBookingToPartner(bookingId: string, partnerId: string, payout: number, adminName: string) {
  const [booking, partner] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    prisma.fleetPartner.findUnique({ where: { id: partnerId } }),
  ]);
  if (!booking || booking.isDeleted) throw new Error("Booking not found");
  if (!partner || !partner.active) throw new Error("Partner not found or inactive");
  if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status)) throw new Error("This booking can no longer be assigned");

  // Moving a job to a company takes it off any office driver; the company
  // will pick its own. Back to CONFIRMED so the board shows it as open.
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      partnerId,
      partnerPayout: payout,
      partnerAssignedAt: new Date(),
      partnerDispatchedAt: null,
      driverId: null,
      driverAssignedAt: null,
      status: booking.status === "PENDING" ? "CONFIRMED" : (booking.status === "DRIVER_ASSIGNED" ? "CONFIRMED" : booking.status),
    },
  });

  await prisma.activityLog.create({
    data: {
      adminId: "admin", adminName,
      action: "ASSIGN_PARTNER", entity: "BOOKING", entityId: bookingId,
      details: { partner: partner.name, payout, confirmationCode: booking.confirmationCode } as never,
    },
  }).catch(() => {});

  sendPartnerJobEmail({
    to: partner.email,
    contactName: partner.contactName,
    companyName: partner.name,
    confirmationCode: booking.confirmationCode,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDatetime: formatPickupDateTime(booking.pickupDatetime),
    vehicleClass: booking.vehicleClass,
    passengers: booking.passengers,
    luggage: booking.luggage,
    flightNumber: booking.flightNumber,
    payout,
    panelUrl: `${SITE_URL}/partner/jobs`,
  }).catch((e) => console.error("[resend] partner job:", e));

  return updated;
}

export async function unassignBookingFromPartner(bookingId: string, adminName: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { partner: true } });
  if (!booking) throw new Error("Booking not found");
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      partnerId: null, partnerPayout: null, partnerAssignedAt: null, partnerDispatchedAt: null,
      // A company driver was on it: take them off too.
      ...(booking.partnerDispatchedAt ? { driverId: null, driverAssignedAt: null, status: "CONFIRMED" as const } : {}),
    },
  });
  await prisma.activityLog.create({
    data: {
      adminId: "admin", adminName,
      action: "UNASSIGN_PARTNER", entity: "BOOKING", entityId: bookingId,
      details: { partner: booking.partner?.name, confirmationCode: booking.confirmationCode } as never,
    },
  }).catch(() => {});
  return updated;
}

// ─── Dispatching a job to a company driver (partner) ─────────

export async function dispatchPartnerJob(partnerId: string, bookingId: string, driverId: string, driverAmount: number | null) {
  const [booking, driver, partner] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    prisma.driver.findUnique({ where: { id: driverId }, include: { user: true, vehicles: { take: 1 } } }),
    prisma.fleetPartner.findUnique({ where: { id: partnerId } }),
  ]);
  if (!booking || booking.partnerId !== partnerId) throw new Error("This job is not assigned to your company");
  if (!driver || driver.partnerId !== partnerId) throw new Error("That driver is not one of yours");
  if (driver.status === "SUSPENDED" || driver.status === "PENDING_APPROVAL") throw new Error("That driver is not active");
  if (["COMPLETED", "CANCELLED", "REFUNDED", "IN_PROGRESS"].includes(booking.status)) throw new Error("This job can no longer be dispatched");
  if (!partner) throw new Error("Partner not found");

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverId,
      driverAssignedAt: new Date(),
      partnerDispatchedAt: new Date(),
      driverAmount,
      status: "DRIVER_ASSIGNED",
    },
  });

  const driverName  = driver.user.name ?? "Your chauffeur";
  const driverPhone = driver.user.phone ?? driver.whatsappNumber ?? "";
  const vehicle     = driver.vehicles[0];
  const when        = formatPickupDateTime(booking.pickupDatetime);

  // Customer: the same card an office driver triggers. No company name.
  if (booking.guestEmail) {
    sendDriverAssignedEmail({
      to: booking.guestEmail,
      name: booking.guestName ?? "Guest",
      confirmationCode: booking.confirmationCode,
      driverName, driverPhone,
      vehicleMake: vehicle?.make ?? "Vehicle",
      vehicleModel: vehicle?.model ?? "",
      licensePlate: vehicle?.licensePlate ?? "",
      pickupDatetime: when,
    }).catch((e) => console.error("[resend] partner dispatch (customer):", e));
  }

  // Driver: the job sheet, with the price the company chose to show them.
  if (driver.user.email) {
    sendDriverBookingDetailsEmail({
      to: driver.user.email,
      driverName,
      confirmationCode: booking.confirmationCode,
      guestName: booking.guestName ?? "Client",
      guestPhone: booking.guestPhone ?? "",
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDatetime: when,
      vehicleClass: booking.vehicleClass,
      passengers: booking.passengers,
      luggage: booking.luggage,
      flightNumber: booking.flightNumber,
      specialRequests: booking.specialRequests,
      driverAmount,
    }).catch((e) => console.error("[resend] partner dispatch (driver):", e));
  }

  // Office: everything about who is driving.
  sendAdminPartnerDispatchAlert({
    companyName: partner.name,
    confirmationCode: booking.confirmationCode,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDatetime: when,
    driverName,
    driverEmail: driver.user.email,
    driverPhone,
    vehicleMake: vehicle?.make ?? "—",
    vehicleModel: vehicle?.model ?? "",
    licensePlate: vehicle?.licensePlate ?? "—",
    payout: booking.partnerPayout ?? 0,
    driverAmount,
  }).catch((e) => console.error("[resend] partner dispatch (admin):", e));

  await notify({
    event: "DRIVER_ASSIGNED",
    channels: ["inapp", "whatsapp"],
    userId: booking.userId,
    bookingId: booking.id,
    phone: booking.guestPhone,
    vars: {
      driver: driverName,
      code: booking.confirmationCode,
      when,
      link: `${SITE_URL}/track/${booking.confirmationCode}`,
    },
  }).catch(() => {});

  return updated;
}

// ─── Completing a job (partner) ──────────────────────────────

export async function completePartnerJob(partnerId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.partnerId !== partnerId) throw new Error("This job is not assigned to your company");
  if (!["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(booking.status)) throw new Error("Only a dispatched job can be completed");
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: "COMPLETED", rideEndedAt: booking.rideEndedAt ?? new Date() },
  });
}

// ─── Earnings ────────────────────────────────────────────────

/**
 * What a company has earned and what it can withdraw.
 *
 * A payout counts once the ride is completed — an assignment that never
 * happened earns nothing. Withdrawals that are pending or already paid both
 * reduce what is available; only a completed ride replenishes it.
 */
export async function partnerBalance(partnerId: string) {
  const [earned, withdrawn] = await Promise.all([
    prisma.booking.aggregate({
      where: { partnerId, status: "COMPLETED", isDeleted: false },
      _sum: { partnerPayout: true }, _count: true,
    }),
    prisma.partnerWithdrawal.aggregate({
      where: { partnerId, status: { in: ["PENDING", "COMPLETED", "TRANSFERRED"] } },
      _sum: { amount: true },
    }),
  ]);
  const totalEarned = earned._sum.partnerPayout ?? 0;
  const totalWithdrawn = withdrawn._sum.amount ?? 0;
  return {
    totalEarned: round2(totalEarned),
    totalWithdrawn: round2(totalWithdrawn),
    available: round2(Math.max(0, totalEarned - totalWithdrawn)),
    completedRides: earned._count,
  };
}

export async function requestPartnerWithdrawal(partnerId: string, input: {
  amount: number; method: "BANK" | "BIZUM"; bankIban?: string; bankHolder?: string; bizumPhone?: string; notes?: string;
}) {
  const bal = await partnerBalance(partnerId);
  if (input.amount <= 0) throw new Error("Enter an amount");
  if (input.amount > bal.available + 0.001) throw new Error(`Only €${bal.available.toFixed(2)} is available`);
  if (input.method === "BANK" && !input.bankIban) throw new Error("An IBAN is needed for a bank transfer");
  if (input.method === "BIZUM" && !input.bizumPhone) throw new Error("A phone number is needed for Bizum");

  const partner = await prisma.fleetPartner.findUnique({ where: { id: partnerId } });
  const w = await prisma.partnerWithdrawal.create({
    data: {
      partnerId,
      amount: round2(input.amount),
      method: input.method,
      bankIban: input.bankIban?.trim() || null,
      bankHolder: input.bankHolder?.trim() || null,
      bizumPhone: input.bizumPhone?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  sendAdminAlertEmail(
    `Withdrawal request — ${partner?.name ?? "fleet partner"} · €${w.amount.toFixed(2)}`,
    `${partner?.name ?? "A fleet partner"} has requested €${w.amount.toFixed(2)} by ${input.method === "BANK" ? "bank transfer" : "Bizum"}.\n` +
    (input.method === "BANK" ? `IBAN: ${w.bankIban}\nHolder: ${w.bankHolder ?? "—"}` : `Bizum: ${w.bizumPhone}`) +
    `\n\nSettle it at ${SITE_URL}/admin/partners/${partnerId}`,
  ).catch(() => {});

  return w;
}

/** Rides and earnings for today, this week and this month, Barcelona time. */
export async function partnerPeriodStats(partnerId: string) {
  const now = new Date();
  const tz = "Europe/Madrid";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(get("year")), m = Number(get("month")), d = Number(get("day"));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  // Midnight in Barcelona is 22:00 or 23:00 UTC the day before; parsePickupInput
  // already knows the rule, but here a plain Date.UTC minus the offset guess
  // would drift at DST. Use the site's converter instead.
  const { pickupToUtc } = await import("@/lib/datetime");
  const dayStart   = pickupToUtc(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, "00:00")!;
  const weekStart  = new Date(dayStart.getTime() - Math.max(0, weekday) * 86_400_000);
  const monthStart = pickupToUtc(`${y}-${String(m).padStart(2, "0")}-01`, "00:00")!;
  const dayEnd     = new Date(dayStart.getTime() + 86_400_000);

  const range = async (from: Date, to?: Date) => {
    const where = { partnerId, isDeleted: false, status: { not: "CANCELLED" as const }, pickupDatetime: { gte: from, ...(to ? { lt: to } : {}) } };
    const [count, sum] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { partnerPayout: true } }),
    ]);
    return { rides: count, earned: round2(sum._sum.partnerPayout ?? 0) };
  };

  const [today, week, month] = await Promise.all([range(dayStart, dayEnd), range(weekStart), range(monthStart)]);
  return { today, week, month };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
