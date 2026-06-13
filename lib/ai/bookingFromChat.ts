/**
 * Booking creation from AI chat.
 *
 * Flow:
 *  1. Parse the structured draft the support AI embeds in its summary message
 *  2. Geocode pickup + dropoff (known-location lookup → Google Geocoding → BCN fallback)
 *  3. Fetch OSRM route distance/duration (haversine × 1.35 fallback)
 *  4. Select vehicle class from passenger count
 *  5. calculateQuote() with live DB PricingRule
 *  6. checkPriceIntegrity() — flags discrepancies to admin, never blocks
 *  7. Create Booking in DB (status: PENDING, paymentStatus: PENDING)
 *  8. Create SumUp checkout → return payment URL
 *
 * SECURITY:
 *  - NEVER asks for card/CVV/bank details — only generates a SumUp payment link
 *  - NEVER changes live prices — only calls calculateQuote(), flags discrepancies
 *  - NEVER invents coords — falls back to BCN city centre + creates admin flag
 */

import { prisma } from "@/lib/prisma";
import { calculateQuote, DEFAULT_PRICING } from "@/lib/pricing";
import { haversineDistance } from "@/lib/utils";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { checkPriceIntegrity } from "@/lib/ai/priceCheck";
import type { VehicleClass } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatBookingDraft {
  name: string;
  phone: string;
  email: string;
  pickup: string;
  dropoff: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  passengers: number;
  luggage: number;
  flightNumber?: string | null;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  reference?: string;
  paymentUrl?: string;
  amount?: number;
  currency?: string;
  error?: string;
  geocodeFallback?: boolean; // true = coords approximated, admin flagged
}

// ─── Known locations ──────────────────────────────────────────────────────────

interface KnownLocation {
  lat: number;
  lng: number;
  label: string;
}

const KNOWN: Array<{ keywords: RegExp; loc: KnownLocation }> = [
  {
    keywords: /\b(bcn airport|el prat|barcelona airport|aeroport|aeropuerto|t1|t2|terminal 1|terminal 2|terminal one|terminal two)\b/i,
    loc: { lat: 41.2971, lng: 2.0785, label: "Barcelona Airport (BCN)" },
  },
  {
    keywords: /\b(cruise|port|world trade|wtc|terminal de creuers|moll)\b/i,
    loc: { lat: 41.3585, lng: 2.1833, label: "Barcelona Cruise Port" },
  },
  {
    keywords: /\b(sants|estació de sants|barcelona sants)\b/i,
    loc: { lat: 41.3788, lng: 2.1403, label: "Barcelona Sants Station" },
  },
  {
    keywords: /\b(sagrada familia)\b/i,
    loc: { lat: 41.4036, lng: 2.1744, label: "Sagrada Família" },
  },
  {
    keywords: /\b(camp nou|fc barcelona|nou camp)\b/i,
    loc: { lat: 41.3809, lng: 2.1228, label: "Camp Nou" },
  },
  {
    keywords: /\b(port aventura|portaventura)\b/i,
    loc: { lat: 41.0859, lng: 1.1541, label: "PortAventura" },
  },
  {
    keywords: /\b(girona airport|gro airport|costa brava airport)\b/i,
    loc: { lat: 41.9009, lng: 2.7605, label: "Girona Airport (GRO)" },
  },
  {
    keywords: /\b(montserrat)\b/i,
    loc: { lat: 41.5931, lng: 1.8331, label: "Montserrat" },
  },
  {
    keywords: /\b(andorra|andorra la vella)\b/i,
    loc: { lat: 42.5063, lng: 1.5218, label: "Andorra la Vella" },
  },
  {
    keywords: /\b(sitges)\b/i,
    loc: { lat: 41.2243, lng: 1.8144, label: "Sitges" },
  },
  {
    keywords: /\b(tarragona)\b/i,
    loc: { lat: 41.1189, lng: 1.2445, label: "Tarragona" },
  },
];

const BCN_CENTER: KnownLocation = { lat: 41.3851, lng: 2.1734, label: "Barcelona City Centre" };

function matchKnownLocation(address: string): KnownLocation | null {
  for (const { keywords, loc } of KNOWN) {
    if (keywords.test(address)) return loc;
  }
  return null;
}

// ─── Google Geocoding ─────────────────────────────────────────────────────────

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const query = `${address}, Spain`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}&region=es&language=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

async function resolveAddress(address: string): Promise<{ lat: number; lng: number; label: string; fallback: boolean }> {
  const known = matchKnownLocation(address);
  if (known) return { ...known, fallback: false };

  const geocoded = await geocodeAddress(address);
  if (geocoded) return { ...geocoded, label: address, fallback: false };

  // Last resort: BCN city centre
  return { ...BCN_CENTER, label: address, fallback: true };
}

// ─── Route distance via OSRM ──────────────────────────────────────────────────

async function getRouteDuration(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<{ distanceKm: number; durationMin: number }> {
  try {
    const url =
      `http://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json() as { routes?: Array<{ distance: number; duration: number }> };
    const route = data.routes?.[0];
    if (route) return { distanceKm: route.distance / 1000, durationMin: route.duration / 60 };
  } catch {}

  const km = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.35;
  return { distanceKm: km, durationMin: (km / 40) * 60 };
}

// ─── Vehicle class from passenger count ──────────────────────────────────────

function vehicleClassFromPax(passengers: number): VehicleClass {
  if (passengers <= 3) return "BUSINESS";
  if (passengers <= 7) return "MINIVAN";
  return "MINIBUS";
}

// ─── Booking code (same logic as /api/bookings) ───────────────────────────────

function generateBookingCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last6 = digits.slice(-6).padStart(6, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = Array.from({ length: 2 }, () =>
    letters[Math.floor(Math.random() * letters.length)],
  ).join("");
  return `${last6}${suffix}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function createBookingFromChat(
  draft: ChatBookingDraft,
  sessionId: string,
  visitorIp: string,
): Promise<BookingResult> {
  // ── 1. Validate required fields ──────────────────────────────────────────────
  if (!draft.name || !draft.email || !draft.phone || !draft.pickup || !draft.dropoff || !draft.date || !draft.time) {
    return { success: false, error: "Incomplete booking information — some required fields are missing." };
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(draft.email)) {
    return { success: false, error: "Invalid email address in booking data." };
  }

  // ── 2. Geocode addresses ─────────────────────────────────────────────────────
  const [pickupGeo, dropoffGeo] = await Promise.all([
    resolveAddress(draft.pickup),
    resolveAddress(draft.dropoff),
  ]);

  const geocodeFallback = pickupGeo.fallback || dropoffGeo.fallback;

  // ── 3. Route distance ────────────────────────────────────────────────────────
  const { distanceKm, durationMin } = await getRouteDuration(
    pickupGeo.lat, pickupGeo.lng,
    dropoffGeo.lat, dropoffGeo.lng,
  );

  // ── 4. Parse datetime ────────────────────────────────────────────────────────
  const pickupDatetime = new Date(`${draft.date}T${draft.time}:00`);
  if (isNaN(pickupDatetime.getTime())) {
    return { success: false, error: "Invalid pickup date or time." };
  }

  // ── 5. Vehicle class + live pricing rule ─────────────────────────────────────
  const vehicleClass = vehicleClassFromPax(draft.passengers);
  const pricingRule = await prisma.pricingRule.findUnique({
    where: { vehicleClass },
  }).catch(() => null);

  // ── 6. Build pricing map, overriding the relevant class with DB rule ──────────
  const pricing = { ...DEFAULT_PRICING };
  if (pricingRule) {
    pricing[vehicleClass] = {
      baseFare:      pricingRule.baseFare,
      pricePerKm:    pricingRule.pricePerKm,
      pricePerMinute: pricingRule.pricePerMinute,
      minimumFare:   pricingRule.minimumFare,
    };
  }

  // ── 7. Calculate quote ───────────────────────────────────────────────────────
  const quote = calculateQuote(
    vehicleClass,
    distanceKm,
    durationMin,
    pickupGeo.lat,
    pickupGeo.lng,
    dropoffGeo.lat,
    dropoffGeo.lng,
    pickupDatetime,
    pricing,
  );

  // ── 8. Price integrity check (non-blocking) ───────────────────────────────────
  checkPriceIntegrity({
    vehicleClass,
    calculatedTotal: quote.totalAmount,
    distanceKm,
    expectedNote: `Chat booking: ${draft.pickup} → ${draft.dropoff}`,
  }).catch(() => {});

  // ── 9. Create Booking ────────────────────────────────────────────────────────
  let booking: { id: string; confirmationCode: string; totalAmount: number; currency: string };
  try {
    const metaPrefix = `[META]${JSON.stringify({ bookingType: "TRANSFER", source: "chat_ai", sessionId })  }[/META]\n`;

    booking = await prisma.booking.create({
      data: {
        guestName:        draft.name,
        guestEmail:       draft.email,
        guestPhone:       draft.phone,
        pickupAddress:    draft.pickup,
        pickupLat:        pickupGeo.lat,
        pickupLng:        pickupGeo.lng,
        dropoffAddress:   draft.dropoff,
        dropoffLat:       dropoffGeo.lat,
        dropoffLng:       dropoffGeo.lng,
        pickupDatetime,
        passengers:       Math.max(1, draft.passengers),
        luggage:          Math.max(0, draft.luggage),
        vehicleClass,
        flightNumber:     draft.flightNumber?.trim() || null,
        specialRequests:  metaPrefix + (geocodeFallback ? "⚠ Address coordinates approximated — please verify." : ""),
        distanceKm:       Math.round(distanceKm * 10) / 10,
        durationMin:      Math.round(durationMin),
        baseFare:         quote.baseFare,
        distanceFare:     quote.distanceFare,
        airportSurcharge: quote.airportSurcharge,
        nightSurcharge:   quote.nightSurcharge,
        totalAmount:      quote.totalAmount,
        currency:         quote.currency,
        confirmationCode: generateBookingCode(draft.phone),
        status:           "PENDING",
        paymentStatus:    "PENDING",
      },
      select: { id: true, confirmationCode: true, totalAmount: true, currency: true },
    });
  } catch (err) {
    console.error("[bookingFromChat] DB create failed:", err);
    return { success: false, error: "Could not save booking. Please contact us via WhatsApp." };
  }

  // ── 10. Flag geocode fallback to admin ────────────────────────────────────────
  if (geocodeFallback) {
    prisma.approvalItem.create({
      data: {
        type:      "GEO_FLAG",
        title:     `Chat booking ${booking.confirmationCode} — address could not be geocoded`,
        preview:   `Pickup: ${draft.pickup}\nDropoff: ${draft.dropoff}\nFallback coords used. Please verify addresses.`,
        diffBefore: "Unknown coordinates",
        diffAfter:  `Pickup: (${pickupGeo.lat.toFixed(4)}, ${pickupGeo.lng.toFixed(4)})\nDropoff: (${dropoffGeo.lat.toFixed(4)}, ${dropoffGeo.lng.toFixed(4)})`,
        metadata:  { bookingId: booking.id, pickupFallback: pickupGeo.fallback, dropoffFallback: dropoffGeo.fallback },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }

  // ── 11. Create SumUp checkout ────────────────────────────────────────────────
  let paymentUrl: string;
  try {
    const checkout = await createSumUpCheckout({
      bookingId:     booking.id,
      amount:        booking.totalAmount,
      currency:      booking.currency,
      description:   `Élite BCN Transfer — ${draft.pickup} → ${draft.dropoff}`,
      customerEmail: draft.email,
    });
    paymentUrl = getSumUpCheckoutUrl(checkout.id, booking.id);
  } catch (err) {
    console.error("[bookingFromChat] SumUp checkout failed:", err);
    // Booking saved but payment link failed — admin can resend manually
    paymentUrl = `/booking/${booking.id}`;
  }

  // ── 12. Link existing user account if found ───────────────────────────────────
  prisma.user.findUnique({ where: { email: draft.email }, select: { id: true } })
    .then((u) => {
      if (u) prisma.booking.update({ where: { id: booking.id }, data: { userId: u.id } }).catch(() => {});
    })
    .catch(() => {});

  return {
    success:       true,
    bookingId:     booking.id,
    reference:     booking.confirmationCode,
    paymentUrl,
    amount:        booking.totalAmount,
    currency:      booking.currency,
    geocodeFallback,
  };
}
