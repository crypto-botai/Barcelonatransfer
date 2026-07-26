export type Role = "CUSTOMER" | "DRIVER" | "ADMIN";

export type BookingType = "TRANSFER" | "HOURLY" | "DAY_HIRE" | "CORPORATE";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DRIVER_ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type DriverStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SUSPENDED"
  | "OFFLINE"
  | "ONLINE"
  | "ON_RIDE";

// The 7 real physical vehicles in the fleet (display / catalog identifier)
export type FleetVehicle =
  | "COROLLA"
  | "CAMRY"
  | "TESLA_M3"
  | "EQE_300"
  | "VITO"
  | "V_CLASS"
  | "SPRINTER";

// Converts a FleetVehicle to its Prisma-compatible VehicleClass for API / DB writes
export const FLEET_TO_DB_CLASS: Record<FleetVehicle, VehicleClass> = {
  COROLLA:  "ECONOMY",
  CAMRY:    "BUSINESS",
  TESLA_M3: "ELECTRIC_VIP",
  EQE_300:  "LUXURY",
  VITO:     "MINIVAN",
  V_CLASS:  "LUXURY_MINIVAN",
  SPRINTER: "MINIBUS",
};

// DB-compatible vehicle class (matches the Prisma VehicleClass enum values we actually use)
export type VehicleClass =
  | "ECONOMY"
  | "BUSINESS"
  | "LUXURY"
  | "ELECTRIC_VIP"
  | "MINIVAN"
  | "LUXURY_MINIVAN"
  | "MINIBUS";

export interface BookingExtra {
  id:       string;
  label:    string;
  price:    number;
  quantity: number;
}

// Standard bag-size reference used across the whole fleet, boot/trunk space only
// (never counting seats or cabin room) — same 3 categories for every vehicle so
// the numbers are directly comparable card to card.
export const BAG_SIZES = {
  large:  { label: "Large",  cm: "75 × 50 × 30 cm" },
  medium: { label: "Medium", cm: "65 × 45 × 25 cm" },
  small:  { label: "Small",  cm: "55 × 40 × 20 cm" },
} as const;

export interface VehicleInfo {
  class:         FleetVehicle;
  label:         string;
  models:        string[];
  maxPassengers: number;
  largeBags:     number; // fits in the boot/trunk alone — see BAG_SIZES.large
  mediumBags:    number; // see BAG_SIZES.medium
  smallBags:     number; // see BAG_SIZES.small
  features:      string[];
  image:         string;
  description:   string;
  badge?:        string;
}

export interface QuoteRequest {
  bookingType:    BookingType;
  pickupAddress:  string;
  pickupLat:      number;
  pickupLng:      number;
  dropoffAddress?: string;
  dropoffLat?:    number;
  dropoffLng?:    number;
  vehicleClass:   VehicleClass;
  pickupDatetime: string;
  passengers:     number;
  durationHours?: number;
}

export interface QuoteResponse {
  vehicleClass:        VehicleClass;
  distanceKm:          number;
  durationMin:         number;
  baseFare:            number;
  distanceFare:        number;
  airportSurcharge:    number;
  nightSurcharge:      number;
  lastMinuteSurcharge?: number;
  vatAmount:           number;
  totalAmount:         number;
  currency:            string;
  isFixed?:            boolean;
  isCustomRoute?:      boolean;  // true = not in table, show "request a quote"
  fromLabel?:          string;   // e.g. "El Prat Airport"
  toLabel?:            string;   // e.g. "Barcelona City"
  hourlyRate?:         number;
  hours?:              number;
}

export interface BookingFormData {
  bookingType:     BookingType;
  pickupAddress:   string;
  pickupLat:       number;
  pickupLng:       number;
  dropoffAddress:  string;
  dropoffLat:      number;
  dropoffLng:      number;
  pickupDatetime:  string;
  date:            string;
  time:            string;
  passengers:      number;
  luggage:         number;
  vehicleClass:    VehicleClass;
  durationHours?:  number;
  flightNumber?:   string;
  specialRequests?: string;
  extras?:         BookingExtra[];
  guestName:       string;
  guestEmail:      string;
  guestPhone:      string;
  quote?:          QuoteResponse;
}

export interface AdminBooking {
  id:               string;
  confirmationCode: string;
  guestName?:       string;
  guestEmail?:      string;
  guestPhone?:      string;
  user?:            { name?: string; email: string };
  pickupAddress:    string;
  dropoffAddress:   string;
  pickupDatetime:   Date;
  passengers:       number;
  vehicleClass:     VehicleClass;
  totalAmount:      number;
  status:           BookingStatus;
  paymentStatus:    PaymentStatus;
  driver?:          { user: { name?: string } };
  createdAt:        Date;
}

export interface DashboardStats {
  totalBookings:    number;
  activeBookings:   number;
  completedBookings: number;
  totalRevenue:     number;
  newBookingsToday: number;
  revenueToday:     number;
}

// ─── Available extras/add-ons ───────────────────────────────
export interface ExtraOption {
  id:          string;
  label:       string;
  description: string;
  price:       number;
  icon:        string;
  maxQty:      number;
  priceLabel:  string;
}

export const EXTRAS_CATALOG: ExtraOption[] = [
  { id: "baby_seat",     label: "Baby Seat",              description: "For infants 0–13 kg",         price: 5,  icon: "👶", maxQty: 2, priceLabel: "€5 each" },
  { id: "child_seat",    label: "Child Seat",             description: "For children 9–18 kg",        price: 5,  icon: "🧒", maxQty: 2, priceLabel: "€5 each" },
  { id: "booster_seat",  label: "Booster Seat",           description: "For children 15–36 kg",       price: 5,  icon: "🪑", maxQty: 2, priceLabel: "€5 each" },
  { id: "meet_greet",    label: "Meet & Greet",           description: "Driver meets you at arrivals", price: 5,  icon: "🤝", maxQty: 1, priceLabel: "€5" },
  { id: "name_board",    label: "Name Board Sign",        description: "Personalised sign at pickup",  price: 5,  icon: "📋", maxQty: 1, priceLabel: "€5" },
  { id: "extra_waiting", label: "Extra Waiting (30 min)", description: "Additional waiting time",      price: 25, icon: "⏱️", maxQty: 4, priceLabel: "€25 / 30 min" },
  { id: "pet_transport", label: "Pet Transport",          description: "Travel with your pet",         price: 20, icon: "🐾", maxQty: 2, priceLabel: "€20 each" },
  { id: "multi_stop",    label: "Multiple Stops",         description: "Additional stops en route",    price: 25, icon: "📍", maxQty: 3, priceLabel: "€25 each" },
  { id: "wheelchair",    label: "Wheelchair Accessible",  description: "Accessible vehicle requested", price: 0,  icon: "♿", maxQty: 1, priceLabel: "On request" },
];

// ─── Vehicle Catalog ────────────────────────────────────────
// Exactly the 7 vehicles we operate. Ordered by price column (Economy → Minibus).
// Both the quote widget and booking wizard derive their vehicle list from this array.
export const VEHICLE_CATALOG: VehicleInfo[] = [
  {
    class: "COROLLA",
    label: "Toyota Corolla",
    models: ["Toyota Corolla"],
    maxPassengers: 3,
    largeBags: 2,
    mediumBags: 3,
    smallBags: 4,
    features: ["Air Conditioning", "USB Charging", "WiFi", "Professional Driver"],
    image: "/fleet/sedan-corolla.png",
    description: "Reliable and comfortable for city transfers and airport runs. Ideal for solo travellers and small groups.",
    badge: "Economy",
  },
  {
    class: "CAMRY",
    label: "Toyota Camry",
    models: ["Toyota Camry"],
    maxPassengers: 3,
    largeBags: 3,
    mediumBags: 4,
    smallBags: 5,
    features: ["Air Conditioning", "USB Charging", "WiFi", "Professional Driver", "Comfortable Seating"],
    image: "/fleet/sedan-camry.png",
    description: "A step above standard — the Camry delivers a smooth, quiet ride perfect for business and leisure travel.",
    badge: "Business",
  },
  {
    class: "TESLA_M3",
    label: "Tesla Model 3",
    models: ["Tesla Model 3"],
    maxPassengers: 4,
    largeBags: 2,
    mediumBags: 3,
    smallBags: 4,
    features: ["100% Electric", "Autopilot", "Panoramic Roof", "WiFi", "USB Charging"],
    image: "/fleet/tesla-model-3.png",
    description: "All-electric executive sedan with autopilot and panoramic roof. Zero emissions for a tech-forward transfer.",
    badge: "Electric VIP",
  },
  {
    class: "EQE_300",
    label: "Mercedes EQE 300",
    models: ["Mercedes EQE 300"],
    maxPassengers: 4,
    largeBags: 2,
    mediumBags: 3,
    smallBags: 4,
    features: ["100% Electric", "Leather Seats", "Climate Control", "WiFi", "Water & Mints", "USB-C Charging"],
    image: "/fleet/eqe-300.png",
    description: "Premium all-electric Mercedes EQE 300 — zero emissions, whisper-quiet, executive comfort for any transfer.",
    badge: "Luxury",
  },
  {
    class: "VITO",
    label: "Mercedes Vito",
    models: ["Mercedes Vito"],
    maxPassengers: 8,
    largeBags: 4,
    mediumBags: 5,
    smallBags: 12,
    features: ["Spacious Cabin", "Climate Control", "WiFi", "USB Charging", "Sliding Doors"],
    image: "/fleet/mercedes-vito.png",
    description: "Spacious and practical for families, groups, and travellers with ample luggage — up to 8 passengers.",
    badge: "Minivan",
  },
  {
    class: "V_CLASS",
    label: "Mercedes V-Class",
    models: ["Mercedes V-Class"],
    maxPassengers: 7,
    largeBags: 4,
    mediumBags: 5,
    smallBags: 12,
    features: ["Captain Seats", "Conference Layout", "Champagne Bar", "4K Screen", "Privacy Glass"],
    image: "/fleet/v-class-mercedes.png",
    description: "A mobile luxury lounge — the ultimate group experience. Perfect for VIP transfers and corporate events.",
    badge: "Luxury Minivan",
  },
  {
    class: "SPRINTER",
    label: "Mercedes Sprinter",
    models: ["Mercedes Sprinter"],
    maxPassengers: 16,
    largeBags: 12,
    mediumBags: 16,
    smallBags: 20,
    features: ["Large Group", "Air Conditioning", "PA System", "Luggage Hold", "Reclining Seats"],
    image: "/fleet/minibus.png",
    description: "Premium group transfers for corporate events, airport runs, and tours for up to 16 passengers.",
    badge: "Minibus",
  },
];

// Single source of truth for the vehicle-class badge color scheme — every fleet
// card (homepage, /fleet, /fleet/[slug], the booking-form vehicle picker) reads
// from this instead of keeping its own copy, which had drifted out of sync
// across all three call sites (each recognised different badge strings).
// Solid, fully-opaque fills — badges sit on top of a vehicle photo, so a
// semi-transparent background (the old "Economy" was white/10, nearly
// invisible) washes out depending on what's underneath. Every class gets
// its own distinct, vivid color so they're identifiable at a glance.
export const VEHICLE_BADGE_STYLES: Record<string, string> = {
  "Economy":        "bg-sky-500 text-white",
  "Business":       "bg-blue-600 text-white",
  "Electric VIP":   "bg-emerald-500 text-white",
  "Luxury":         "bg-[#c9a84c] text-black",
  "Minivan":        "bg-orange-500 text-white",
  "Luxury Minivan": "bg-purple-600 text-white",
  "Minibus":        "bg-rose-500 text-white",
};

export function vehicleBadgeClass(badge?: string): string {
  return (badge && VEHICLE_BADGE_STYLES[badge]) || "bg-sky-500 text-white";
}

export const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING:         "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DRIVER_ASSIGNED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  IN_PROGRESS:     "bg-green-500/20 text-green-400 border-green-500/30",
  COMPLETED:       "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CANCELLED:       "bg-red-500/20 text-red-400 border-red-500/30",
  REFUNDED:        "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:         "Pending",
  CONFIRMED:       "Confirmed",
  DRIVER_ASSIGNED: "Driver Assigned",
  IN_PROGRESS:     "In Progress",
  COMPLETED:       "Completed",
  CANCELLED:       "Cancelled",
  REFUNDED:        "Refunded",
};

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  TRANSFER:  "Point-to-Point Transfer",
  HOURLY:    "Hourly Chauffeur",
  DAY_HIRE:  "Full Day Hire (8h)",
  CORPORATE: "Corporate Transfer",
};
