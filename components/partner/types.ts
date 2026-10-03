/** What the partner jobs and drivers routes return. Shared by the list, the board and the sheets. */

export type Job = {
  id: string; confirmationCode: string; status: string;
  guestName: string | null; guestPhone: string | null; guestEmail: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  pickupLat?: number | null; pickupLng?: number | null; dropoffLat?: number | null; dropoffLng?: number | null;
  passengers: number; luggage: number; vehicleClass: string; flightNumber: string | null;
  /** The customer's own words, extras by name, stops. No prices: see the jobs route. */
  notes: string | null; extras: { id: string; label: string; quantity: number }[]; stops: string[]; durationHours: number | null;
  /** What the driver collects from the client on the day. */
  collect: number;
  noShow?: { images: string[]; note: string | null; waitedMin: number | null; createdAt: string; lat: number | null; lng: number | null } | null;
  partnerPayout: number | null; driverAmount: number | null; partnerDispatchedAt: string | null;
  driver: { id: string; user: { name: string | null; phone: string | null }; vehicles: { make: string; model: string; licensePlate: string }[] } | null;
};

export type Driver = {
  id: string; status: string; user: { name: string | null; phone: string | null };
  vehicles: { make: string; model: string; licensePlate: string; class: string }[];
  _count: { bookings: number };
};
