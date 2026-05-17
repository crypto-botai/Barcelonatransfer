import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatShortDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function generateConfirmationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "EBC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const BARCELONA_AIRPORT_COORDS = { lat: 41.2971, lng: 2.0785 };
export const CRUISE_TERMINAL_COORDS  = { lat: 41.3585, lng: 2.1833 };

export function isAirportLocation(lat: number, lng: number): boolean {
  const distToAirport = haversineDistance(
    lat, lng,
    BARCELONA_AIRPORT_COORDS.lat,
    BARCELONA_AIRPORT_COORDS.lng
  );
  const distToCruise = haversineDistance(
    lat, lng,
    CRUISE_TERMINAL_COORDS.lat,
    CRUISE_TERMINAL_COORDS.lng
  );
  return distToAirport < 2 || distToCruise < 1;
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isNightTime(date: Date, startHour = 22, endHour = 6): boolean {
  const h = date.getHours();
  return h >= startHour || h < endHour;
}
