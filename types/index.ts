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

export type VehicleClass =
  | "ECONOMY"
  | "BUSINESS"
  | "LUXURY"
  | "FIRST_CLASS"
  | "ELECTRIC_VIP"
  | "SUV"
  | "LUXURY_SUV"
  | "MINIVAN"
  | "LUXURY_MINIVAN"
  | "MINIBUS";

export interface BookingExtra {
  id:       string;
  label:    string;
  price:    number;
  quantity: number;
}

export interface VehicleInfo {
  class:         VehicleClass;
  label:         string;
  models:        string[];
  maxPassengers: number;
  maxLuggage:    number;
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
  vehicleClass:     VehicleClass;
  distanceKm:       number;
  durationMin:      number;
  baseFare:         number;
  distanceFare:     number;
  airportSurcharge: number;
  nightSurcharge:   number;
  totalAmount:      number;
  currency:         string;
  hourlyRate?:      number;
  hours?:           number;
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
export const VEHICLE_CATALOG: VehicleInfo[] = [
  {
    class: "ECONOMY",
    label: "Standard Sedan",
    models: ["Toyota Corolla", "Toyota Camry", "Toyota Prius"],
    maxPassengers: 4,
    maxLuggage: 3,
    features: ["Air Conditioning", "USB Charging", "WiFi", "Professional Driver"],
    image: "/fleet/sedan-corolla.png",
    description: "Reliable and comfortable for everyday city transfers and airport runs. Ideal for solo travellers and small groups.",
  },
  {
    class: "LUXURY",
    label: "Luxury Sedan",
    models: ["Lexus ES 350", "Mercedes-Benz E-Class"],
    maxPassengers: 4,
    maxLuggage: 3,
    features: ["Leather Seats", "Climate Control", "WiFi", "Water & Mints", "USB-C Charging"],
    image: "/fleet/e-class.png",
    description: "Premium executive sedan for business travel, client meetings, and airport transfers in refined style.",
    badge: "Popular",
  },
  {
    class: "MINIVAN",
    label: "Executive Minivan",
    models: ["Mercedes Vito", "Ford Tourneo Custom"],
    maxPassengers: 7,
    maxLuggage: 7,
    features: ["Spacious Cabin", "Climate Control", "WiFi", "USB Charging", "Sliding Doors"],
    image: "/fleet/mercedes-vito.png",
    description: "Spacious and practical for families, groups, and travellers with ample luggage — up to 7 passengers.",
  },
  {
    class: "LUXURY_MINIVAN",
    label: "Luxury Minivan",
    models: ["Mercedes V-Class VIP", "Mercedes EQV"],
    maxPassengers: 7,
    maxLuggage: 7,
    features: ["Captain Seats", "Conference Layout", "Champagne Bar", "4K Screen", "Privacy Glass"],
    image: "/fleet/v-class-mercedes.png",
    description: "A mobile luxury lounge — the ultimate group experience. Perfect for VIP transfers and corporate events.",
    badge: "VIP",
  },
  {
    class: "MINIBUS",
    label: "Group Minibus",
    models: ["Mercedes Sprinter", "Mercedes V-Class"],
    maxPassengers: 16,
    maxLuggage: 16,
    features: ["Large Group", "Air Conditioning", "PA System", "Luggage Hold", "Reclining Seats"],
    image: "/fleet/minibus.png",
    description: "Premium group transfers for corporate events, airport runs, and tours for up to 16 passengers.",
  },
  {
    class: "ELECTRIC_VIP",
    label: "Electric Vehicle",
    models: ["Tesla Model S", "Tesla Model Y"],
    maxPassengers: 4,
    maxLuggage: 3,
    features: ["Zero Emissions", "Autopilot Ready", "Glass Roof", "Premium Sound", "Fast Charging"],
    image: "/fleet/tesla.png",
    description: "Eco-conscious premium travel. Zero-emission Tesla for those who demand technology and sustainability.",
    badge: "Eco",
  },
];

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
