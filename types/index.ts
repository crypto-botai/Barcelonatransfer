export type Role = "CUSTOMER" | "DRIVER" | "ADMIN";

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

export interface VehicleInfo {
  class: VehicleClass;
  label: string;
  models: string[];
  maxPassengers: number;
  maxLuggage: number;
  features: string[];
  image: string;
  description: string;
}

export interface QuoteRequest {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleClass: VehicleClass;
  pickupDatetime: string;
  passengers: number;
}

export interface QuoteResponse {
  vehicleClass: VehicleClass;
  distanceKm: number;
  durationMin: number;
  baseFare: number;
  distanceFare: number;
  airportSurcharge: number;
  nightSurcharge: number;
  totalAmount: number;
  currency: string;
}

export interface BookingFormData {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  pickupDatetime: string;
  date: string;
  time: string;
  passengers: number;
  luggage: number;
  vehicleClass: VehicleClass;
  flightNumber?: string;
  specialRequests?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  quote?: QuoteResponse;
}

export interface AdminBooking {
  id: string;
  confirmationCode: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  user?: { name?: string; email: string };
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  passengers: number;
  vehicleClass: VehicleClass;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  driver?: { user: { name?: string } };
  createdAt: Date;
}

export interface DashboardStats {
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  totalRevenue: number;
  newBookingsToday: number;
  revenueToday: number;
}

export const VEHICLE_CATALOG: VehicleInfo[] = [
  {
    class: "ECONOMY",
    label: "Economy Sedan",
    models: ["Toyota Corolla", "Skoda Octavia"],
    maxPassengers: 3,
    maxLuggage: 3,
    features: ["Air Conditioning", "USB Charging", "WiFi"],
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    description: "Comfortable and reliable for everyday transfers.",
  },
  {
    class: "BUSINESS",
    label: "Business Sedan",
    models: ["Toyota Camry", "Lexus ES"],
    maxPassengers: 3,
    maxLuggage: 3,
    features: ["Premium Sound", "WiFi", "Water & Mints", "USB-C Charging"],
    image: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80",
    description: "The smart choice for business travel and airport transfers.",
  },
  {
    class: "LUXURY",
    label: "Luxury Sedan",
    models: ["Mercedes E-Class", "BMW 5 Series"],
    maxPassengers: 3,
    maxLuggage: 3,
    features: ["Leather Seats", "Privacy Glass", "Premium Sound", "WiFi", "Refreshments"],
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
    description: "Arrive in style with our flagship luxury sedans.",
  },
  {
    class: "FIRST_CLASS",
    label: "First Class",
    models: ["Mercedes S-Class", "BMW 7 Series"],
    maxPassengers: 3,
    maxLuggage: 3,
    features: ["Massaging Seats", "Ambient Lighting", "Champagne", "Privacy Screen", "4G WiFi"],
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
    description: "The pinnacle of automotive luxury for VIP clients.",
  },
  {
    class: "ELECTRIC_VIP",
    label: "Electric VIP",
    models: ["Tesla Model S", "Mercedes EQS"],
    maxPassengers: 3,
    maxLuggage: 3,
    features: ["Zero Emissions", "Autopilot", "Glass Roof", "Premium Sound", "Fast Charging"],
    image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80",
    description: "Cutting-edge electric luxury for the eco-conscious traveller.",
  },
  {
    class: "SUV",
    label: "Executive SUV",
    models: ["Mercedes GLE", "BMW X5"],
    maxPassengers: 5,
    maxLuggage: 5,
    features: ["Elevated Seating", "Large Boot", "4WD", "Premium Sound", "WiFi"],
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
    description: "Commanding presence with executive-level comfort.",
  },
  {
    class: "LUXURY_SUV",
    label: "Luxury SUV",
    models: ["Cadillac Escalade", "Range Rover Autobiography"],
    maxPassengers: 6,
    maxLuggage: 6,
    features: ["VIP Rear Suite", "Refrigerator", "Ambient Lighting", "Privacy Glass", "Champagne"],
    image: "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800&q=80",
    description: "Ultimate SUV luxury for groups demanding the very best.",
  },
  {
    class: "MINIVAN",
    label: "Minivan",
    models: ["Mercedes Vito", "Toyota Proace"],
    maxPassengers: 7,
    maxLuggage: 7,
    features: ["Spacious Cabin", "Climate Control", "WiFi", "USB Charging"],
    image: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
    description: "Ideal for families and groups up to 7 passengers.",
  },
  {
    class: "LUXURY_MINIVAN",
    label: "Luxury Minivan",
    models: ["Mercedes V-Class VIP"],
    maxPassengers: 7,
    maxLuggage: 7,
    features: ["Captain Seats", "Conference Layout", "Champagne Bar", "4K Screen", "Privacy Glass"],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    description: "A mobile lounge — the ultimate group luxury experience.",
  },
  {
    class: "MINIBUS",
    label: "Minibus",
    models: ["Mercedes Sprinter", "Ford Transit"],
    maxPassengers: 16,
    maxLuggage: 16,
    features: ["Large Group", "Air Conditioning", "PA System", "Luggage Hold"],
    image: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80",
    description: "Premium group transfers for up to 16 passengers.",
  },
];

export const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DRIVER_ASSIGNED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  IN_PROGRESS: "bg-green-500/20 text-green-400 border-green-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
  REFUNDED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DRIVER_ASSIGNED: "Driver Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
