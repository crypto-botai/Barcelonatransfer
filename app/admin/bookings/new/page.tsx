"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Car, Inbox, Loader2, MapPin, Plus, Send, Sparkles, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type BookingPaymentMethod } from "@/lib/payment-method";
import ImportPanel, { type ImportSource, type Prefill } from "./ImportPanel";
import ExtraRides, { blankRide, rideReady, rideTotal, type ExtraRide } from "./ExtraRides";

/**
 * A booking made by the office.
 *
 * Phone and WhatsApp customers were being typed into the database by hand or
 * not recorded at all, so they never got a confirmation, never appeared on
 * the dispatch board, and could not be marked paid. This form takes the same
 * details the website asks for, quotes the same price the website would, and
 * lets the office say how the customer is paying.
 */

type Place = { address: string; lat: number; lng: number };

const METHOD_HELP: Record<BookingPaymentMethod, string> = {
  CARD_LINK:     "The confirmation carries a pay-by-card button. Marked paid automatically when they use it.",
  WHATSAPP:      "Bizum or transfer arranged on WhatsApp. Mark paid once it arrives.",
  CASH:          "The customer pays the chauffeur on the day. Mark paid after the ride.",
  BANK_TRANSFER: "Invoice paid by bank transfer. Mark paid once it lands.",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Scrolls to the control the chip is about, and rings it briefly.
 *
 * The chips at the top switch the option on; the fields that go with it are
 * further down a long form. Without this the office presses "Return journey",
 * nothing visibly happens, and they press it again.
 */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-gold-500/60");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-gold-500/60"), 1600);
}

function TripChip({ active, onClick, label, icon }: {
  active: boolean; onClick: () => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${active ? "border-gold-500 bg-gold-500/10 text-white" : "border-white/[0.1] text-dark-300 hover:border-white/25 hover:text-white"}`}
    >
      {icon}{label}
    </button>
  );
}

export default function NewBookingPage() {
  const router = useRouter();

  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [pickup, setPickup]   = useState<Place>({ address: "", lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState<Place>({ address: "", lat: 0, lng: 0 });
  const [date, setDate]       = useState("");
  const [time, setTime]       = useState("");
  const [pax, setPax]         = useState(2);
  const [bags, setBags]       = useState(2);
  const [vehicle, setVehicle] = useState<FleetVehicle>("EQE_300");
  /**
   * How many cars this journey needs.
   *
   * A group of twenty-four is one journey and four vans, and four vans is
   * four chauffeurs with four job sheets. Each becomes a booking of its own,
   * because there is no way to express four cars as one booking that anybody
   * can be assigned to drive.
   */
  const [vehicleCount, setVehicleCount] = useState(1);
  const [flight, setFlight]   = useState("");
  const [notes, setNotes]     = useState("");

  /**
   * The journey home.
   *
   * A date and a time, never a second pair of addresses: the return is the
   * outbound reversed, which is what the website has always meant by one and
   * what stops the office typing the same two places twice. It is saved as a
   * booking of its own with its own reference, because it is its own job on
   * its own day and may well be a different chauffeur.
   */
  const [returnOn, setReturnOn]     = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [returnPrice, setReturnPrice] = useState("");
  const [returnPriceTouched, setReturnPriceTouched] = useState(false);

  /**
   * A return that does not simply retrace the outbound.
   *
   * Arriving at one hotel and leaving from another is ordinary: guests move
   * mid-stay, and plenty fly into El Prat and home out of Girona. Reversing
   * the outbound in those cases sends a chauffeur to the wrong door.
   */
  const [returnCustom, setReturnCustom] = useState(false);
  const [returnFrom, setReturnFrom] = useState<Place>({ address: "", lat: 0, lng: 0 });
  const [returnTo, setReturnTo]     = useState<Place>({ address: "", lat: 0, lng: 0 });

  /** Other journeys for this same customer, each its own booking. */
  const [rides, setRides] = useState<ExtraRide[]>([]);

  const [quote, setQuote]         = useState<number | null>(null);
  const [quoting, setQuoting]     = useState(false);
  const [price, setPrice]         = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [driverAmount, setDriverAmount] = useState("");

  const [method, setMethod]   = useState<BookingPaymentMethod>("CARD_LINK");
  const [paid, setPaid]       = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving]   = useState(false);

  /** Set when the form was filled from a lead or an unpaid booking. */
  const [source, setSource] = useState<ImportSource | null>(null);
  /** A source named in the URL, so Abandoned can link straight into this form. */
  const [linked, setLinked] = useState<{ bookingId?: string; sessionId?: string }>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const bookingId = p.get("booking") ?? undefined;
    const sessionId = p.get("session") ?? undefined;
    if (bookingId || sessionId) setLinked({ bookingId, sessionId });
  }, []);

  // The imported price is the one the customer was quoted, so it counts as a
  // deliberate price: the quote must not overwrite it when the route resolves.
  const applyPrefill = useCallback((p: Prefill) => {
    setName(p.name); setEmail(p.email); setPhone(p.phone);
    setPickup(p.pickup); setDropoff(p.dropoff);
    setDate(p.date); setTime(p.time);
    setPax(p.pax); setBags(p.bags);
    setVehicle(p.vehicle); setFlight(p.flight); setNotes(p.notes);
    if (p.price) { setPrice(p.price); setPriceTouched(true); }
    // A cart that wanted a return arrives with one already ticked.
    if (p.returnDate && p.returnTime) {
      setReturnOn(true); setReturnDate(p.returnDate); setReturnTime(p.returnTime);
      setReturnPrice(""); setReturnPriceTouched(false);
    } else {
      setReturnOn(false); setReturnDate(""); setReturnTime("");
    }
    setSource(p.source);
    toast.success(p.source.kind === "unpaid" ? `Loaded ${p.source.label}` : `Loaded ${p.source.label}'s cart`);
  }, []);

  function clearSource() {
    setSource(null);
    setLinked(undefined);
  }

  // The same quote the website gives, so a phone customer is never charged a
  // different fare from one who booked online. The office can still override.
  const fetchQuote = useCallback(async () => {
    if (!pickup.lat || !dropoff.lat || !date || !time) return;
    setQuoting(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingType: "TRANSFER",
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
          vehicleClass: FLEET_TO_DB_CLASS[vehicle], fleetVehicle: vehicle,
          pickupDatetime: `${date}T${time}`, passengers: pax,
          pickupAddress: pickup.address, dropoffAddress: dropoff.address,
        }),
      });
      if (res.ok) {
        const q = await res.json();
        setQuote(q.totalAmount);
        if (!priceTouched) setPrice(String(q.totalAmount));
      }
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, date, time, vehicle, pax, priceTouched]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const amount = parseFloat(price);

  // The same journey reversed costs the same, until the office says otherwise.
  const backAmount = returnOn
    ? (returnPriceTouched && returnPrice !== "" ? parseFloat(returnPrice) : amount)
    : 0;
  // Every price on this form is the price of one car. Charging one car for a
  // party of four vans is the kind of mistake nobody notices until later.
  const extrasTotal = rideTotal(rides);
  const tripTotal = amount * vehicleCount
    + (Number.isFinite(backAmount) ? backAmount : 0) * (returnOn ? vehicleCount : 0)
    + extrasTotal;

  const seats = VEHICLE_CATALOG.find((v) => v.class === vehicle)?.maxPassengers ?? 4;
  // Rounded up: an uneven split puts the spare passengers in the first cars,
  // so the fullest car is what has to fit.
  const perCar = Math.ceil(pax / vehicleCount);
  const overCapacity = perCar > seats;
  // A chauffeur cannot drive them home before they have set off. Checked here
  // as well as at the API so the office sees it before pressing the button.
  const returnAfterOutbound = !returnOn || (!!returnDate && !!returnTime && !!date && !!time
    && `${returnDate}T${returnTime}` > `${date}T${time}`);
  const returnReady = !returnOn || (!!returnDate && !!returnTime && returnAfterOutbound && Number.isFinite(backAmount) && backAmount >= 0);
  // A half-filled extra ride cannot be created, and silently dropping it would
  // lose a journey the office believes it has booked.
  const ridesReady = rides.every(rideReady);
  // Bookings, not journeys: four vans on one journey is four rows on the
  // dispatch board and four references for the office to read out.
  const legCount = vehicleCount + (returnOn ? vehicleCount : 0)
    + rides.reduce((s, r) => s + r.vehicleCount, 0);

  const ready = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 6
    && pickup.address && dropoff.address && date && time && amount >= 0 && !Number.isNaN(amount)
    && returnReady && ridesReady;

  async function submit() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim(),
          pickupAddress: pickup.address, pickupLat: pickup.lat || 41.3851, pickupLng: pickup.lng || 2.1734,
          dropoffAddress: dropoff.address, dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
          pickupDatetime: `${date}T${time}`,
          passengers: pax, luggage: bags,
          vehicleClass: FLEET_TO_DB_CLASS[vehicle],
          flightNumber: flight.trim() || undefined,
          specialRequests: notes.trim() || undefined,
          totalAmount: amount,
          driverAmount: driverAmount ? parseFloat(driverAmount) : undefined,
          paymentMethod: method,
          paymentStatus: paid ? "PAID" : "PENDING",
          sendEmail,
          fromBookingId: source?.kind === "unpaid" ? source.bookingId : undefined,
          fromSessionId: source?.kind === "lead"   ? source.sessionId : undefined,
          vehicleCount,
          returnDatetime: returnOn ? `${returnDate}T${returnTime}` : undefined,
          returnAmount:   returnOn ? backAmount : undefined,
          returnVehicleCount: returnOn ? vehicleCount : undefined,
          // Only sent when the office actually changed them; the API falls
          // back to the reversed route for anything left out.
          ...(returnOn && returnCustom && returnFrom.address ? {
            returnPickupAddress: returnFrom.address, returnPickupLat: returnFrom.lat, returnPickupLng: returnFrom.lng,
          } : {}),
          ...(returnOn && returnCustom && returnTo.address ? {
            returnDropoffAddress: returnTo.address, returnDropoffLat: returnTo.lat, returnDropoffLng: returnTo.lng,
          } : {}),
          extraRides: rides.length ? rides.map((r) => ({
            pickupAddress: r.pickup.address, pickupLat: r.pickup.lat || 41.3851, pickupLng: r.pickup.lng || 2.1734,
            dropoffAddress: r.dropoff.address, dropoffLat: r.dropoff.lat, dropoffLng: r.dropoff.lng,
            pickupDatetime: `${r.date}T${r.time}`,
            vehicleClass: FLEET_TO_DB_CLASS[r.vehicle],
            totalAmount: parseFloat(r.price),
            vehicleCount: r.vehicleCount,
            flightNumber: r.flight.trim() || undefined,
            specialRequests: r.notes.trim() || undefined,
          })) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the booking");
      const codes = [data.confirmationCode, data.returnConfirmationCode, ...(data.extraConfirmationCodes ?? [])].filter(Boolean);
      toast.success(
        codes.length > 1
          ? `${codes.length} bookings created — ${codes.join(", ")}${sendEmail ? ". Confirmations sent." : ""}`
          : `Booking ${data.confirmationCode} ${source?.kind === "unpaid" ? "completed" : "created"}${sendEmail ? " — confirmation sent" : ""}`,
      );
      router.push("/admin/bookings");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the booking");
    } finally {
      setSaving(false);
    }
  }

  const field = "input-luxury w-full px-3 py-2.5 rounded-lg text-sm";
  const label = "block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5";

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-5xl">
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-dark-400 hover:text-white text-sm mb-4">
        <ArrowLeft size={14} /> Bookings
      </Link>
      <div className="mb-5">
        <h1 className="font-display text-3xl text-white">New booking</h1>
        <p className="text-dark-400 mt-1">For a customer booking by phone or WhatsApp, or finishing one they started online. Priced the same as the website; the customer receives the confirmation email.</p>
      </div>

      {/*
        What kind of booking this is, said at the top.

        All three of these already existed further down the form — the return
        inside the journey section, the vehicle count under the car picker,
        the extra rides in a section below the fold — and the office could not
        find any of them, which is the same as not having them. The controls
        stay where the details are entered; this is the part that says they
        are there, in the place the eye lands first, and matches the One Way /
        Return tabs the booking widget on the website already uses.
      */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-gold-500/80 font-semibold mr-1">This booking</span>

          <TripChip
            active={!returnOn}
            onClick={() => setReturnOn(false)}
            label="One way"
          />
          <TripChip
            active={returnOn}
            onClick={() => { setReturnOn(true); if (!returnTime && time) setReturnTime(time); jumpTo("return-journey"); }}
            label="Return journey"
            icon={<ArrowLeftRight size={12} />}
          />

          <span className="h-5 w-px bg-white/[0.1] mx-1" />

          {/* The count lives with the car picker; this shows and reaches it. */}
          <button
            type="button"
            onClick={() => jumpTo("vehicle-count")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${vehicleCount > 1 ? "border-gold-500 bg-gold-500/10 text-white" : "border-white/[0.1] text-dark-300 hover:border-white/25 hover:text-white"}`}
          >
            <Car size={12} />
            {vehicleCount === 1 ? "1 vehicle" : `${vehicleCount} vehicles`}
          </button>

          <button
            type="button"
            onClick={() => { setRides((r) => (r.length ? r : [blankRide(vehicle)])); jumpTo("more-rides"); }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${rides.length ? "border-gold-500 bg-gold-500/10 text-white" : "border-white/[0.1] text-dark-300 hover:border-white/25 hover:text-white"}`}
          >
            <Plus size={12} />
            {rides.length === 0 ? "Add another ride" : `${rides.length} extra ${rides.length === 1 ? "ride" : "rides"}`}
          </button>

          {legCount > 1 && (
            <span className="ml-auto text-[11px] text-dark-400">
              {legCount} bookings will be created
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          {/* Start from something the customer already began */}
          {source ? (
            <div className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 ${source.kind === "unpaid" ? "border-gold-500/30 bg-gold-500/[0.06]" : "border-white/[0.1] bg-white/[0.03]"}`}>
              <Inbox size={15} className="text-gold-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {source.kind === "unpaid" ? (
                  <>
                    <p className="text-white text-sm">Completing booking <span className="font-medium text-gold-300">{source.label}</span></p>
                    <p className="text-dark-400 text-[12px] mt-0.5">Saving updates that booking rather than creating a second one, so the customer keeps the reference they were given.</p>
                  </>
                ) : (
                  <>
                    <p className="text-white text-sm">From <span className="font-medium text-gold-300">{source.label}</span>&apos;s abandoned cart</p>
                    <p className="text-dark-400 text-[12px] mt-0.5">Saving creates a new booking and closes the lead, so the recovery emails stop.</p>
                  </>
                )}
              </div>
              <button type="button" onClick={clearSource} title="Forget where this came from" className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white shrink-0">
                <X size={13} />
              </button>
            </div>
          ) : (
            <ImportPanel onPick={applyPrefill} autoOpen={linked} />
          )}

          {/* Customer */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4">Customer</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={label}>Full name</label><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aaron Donovan" /></div>
              <div><label className={label}>Email</label><input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
              <div><label className={label}>Phone</label><input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 6…" /></div>
            </div>
          </section>

          {/* Journey */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4">Journey</h2>
            <div className="space-y-3">
              <div>
                <label className={label}>Pick-up</label>
                <AddressAutocomplete value={pickup.address} onChange={setPickup} placeholder="Airport terminal, hotel, address…" icon={<MapPin size={14} className="text-gold-500" />} />
              </div>
              <div>
                <label className={label}>Drop-off</label>
                <AddressAutocomplete value={dropoff.address} onChange={setDropoff} placeholder="Destination" icon={<MapPin size={14} className="text-gold-500" />} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className={label}>Date</label><input className={`${field} [color-scheme:dark]`} type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div><label className={label}>Time</label><input className={`${field} [color-scheme:dark]`} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
                <div><label className={label}>Passengers</label><input className={field} type="number" min={1} max={16} value={pax} onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))} /></div>
                <div><label className={label}>Bags</label><input className={field} type="number" min={0} max={30} value={bags} onChange={(e) => setBags(Math.max(0, parseInt(e.target.value) || 0))} /></div>
              </div>
              <div>
                <label className={label}>Vehicle</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_CATALOG.map((v) => (
                    <button
                      key={v.class}
                      type="button"
                      onClick={() => setVehicle(v.class)}
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${vehicle === v.class ? "border-gold-500 bg-gold-500/10" : "border-white/[0.08] hover:border-white/20"}`}
                    >
                      <div className="text-white text-sm">{v.label}</div>
                      <div className="text-dark-400 text-[11px]">{v.badge} · up to {v.maxPassengers}</div>
                    </button>
                  ))}
                </div>

                {/* A group of twenty-four is one journey and four vans. Each
                    van is a booking of its own, because each needs its own
                    chauffeur, job sheet and place on the dispatch board. */}
                <div id="vehicle-count" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg transition-shadow">
                  <span className={`${label} mb-0`}>How many</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVehicleCount(n)}
                        className={`w-9 h-9 rounded-lg border text-sm transition-colors ${vehicleCount === n ? "border-gold-500 bg-gold-500/10 text-white" : "border-white/[0.08] text-dark-300 hover:border-white/20"}`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number" min={1} max={10}
                      value={vehicleCount > 6 ? vehicleCount : ""}
                      onChange={(e) => setVehicleCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                      placeholder="7+"
                      className={`${field} w-16 text-center px-1`}
                    />
                  </div>
                  {vehicleCount > 1 && (
                    <span className={`text-[11px] ${overCapacity ? "text-red-400" : "text-dark-400"}`}>
                      {vehicleCount} × {VEHICLE_CATALOG.find((v) => v.class === vehicle)?.label}
                      {" · "}{pax} {pax === 1 ? "passenger" : "passengers"} split {perCar} per car
                      {overCapacity && ` — that is more than the ${seats} it seats`}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-3">
                <div><label className={label}>Flight number</label><input className={field} value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="VY8301" /></div>
                <div><label className={label}>Notes for the chauffeur</label><input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Child seat, name board text, meeting point…" /></div>
              </div>

              {/* The way home. Only a date and a time: the route is the one
                  above, reversed, so there is nothing else to enter. */}
              <div id="return-journey" className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-shadow">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnOn}
                    onChange={(e) => {
                      setReturnOn(e.target.checked);
                      // Most returns are a few days later; offering the same
                      // day is a worse guess than offering nothing.
                      if (e.target.checked && !returnTime && time) setReturnTime(time);
                    }}
                    className="mt-0.5 accent-[#c9a84c]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm text-white">
                      <ArrowLeftRight size={13} className="text-gold-400" /> Return journey
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-dark-400">
                      {dropoff.address && pickup.address
                        ? <>Back from <span className="text-dark-200">{dropoff.address.split(",")[0]}</span> to <span className="text-dark-200">{pickup.address.split(",")[0]}</span>. Saved as its own booking with its own reference, so it can go to a different chauffeur.</>
                        : "The journey above, reversed. Saved as its own booking with its own reference, so it can go to a different chauffeur."}
                    </span>
                  </span>
                </label>

                {returnOn && (
                  <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-[1fr_1fr_minmax(0,1fr)] gap-3 border-t border-white/[0.06] pt-3.5">
                    <div>
                      <label className={label}>Return date</label>
                      <input className={`${field} [color-scheme:dark]`} type="date" min={date || todayStr()} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Return time</label>
                      <input className={`${field} [color-scheme:dark]`} type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Return price (€)</label>
                      <input
                        className={field}
                        type="number" min={0} step="0.5"
                        value={returnPriceTouched ? returnPrice : (Number.isFinite(amount) ? String(amount) : "")}
                        onChange={(e) => { setReturnPrice(e.target.value); setReturnPriceTouched(true); }}
                        placeholder="Same as outbound"
                      />
                      {returnPriceTouched && (
                        <button type="button" onClick={() => { setReturnPriceTouched(false); setReturnPrice(""); }} className="text-[11px] text-gold-400 mt-1.5 hover:underline">
                          Same as outbound
                        </button>
                      )}
                    </div>
                    {returnDate && returnTime && !returnAfterOutbound && (
                      <p className="col-span-full text-[11px] text-red-400">The return has to be after the outbound journey.</p>
                    )}

                    {/* Guests move hotel mid-stay, and plenty fly into El Prat
                        and home out of Girona. Reversing the outbound then
                        sends a chauffeur to the wrong door. */}
                    <div className="col-span-full">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-[12px] text-dark-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={returnCustom}
                          onChange={(e) => {
                            setReturnCustom(e.target.checked);
                            // Start from the reversed route, so the office
                            // edits one end rather than retyping both.
                            if (e.target.checked) {
                              if (!returnFrom.address) setReturnFrom(dropoff);
                              if (!returnTo.address) setReturnTo(pickup);
                            }
                          }}
                          className="accent-[#c9a84c]"
                        />
                        Picking up or dropping off somewhere else on the way back
                      </label>

                      {returnCustom && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className={label}>Return pick-up</label>
                            <AddressAutocomplete
                              value={returnFrom.address}
                              onChange={setReturnFrom}
                              placeholder="Where we collect them on the way back"
                              icon={<MapPin size={14} className="text-gold-500" />}
                            />
                          </div>
                          <div>
                            <label className={label}>Return drop-off</label>
                            <AddressAutocomplete
                              value={returnTo.address}
                              onChange={setReturnTo}
                              placeholder="Where the return journey ends"
                              icon={<MapPin size={14} className="text-gold-500" />}
                            />
                          </div>
                          <p className="text-[11px] text-dark-500">Leave either empty to use the outbound journey reversed.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div id="more-rides" className="rounded-2xl transition-shadow">
            <ExtraRides rides={rides} onChange={setRides} defaultVehicle={vehicle} passengers={pax} />
          </div>
        </div>

        {/* Price & payment */}
        <aside className="glass-card rounded-2xl p-5 space-y-5 lg:sticky lg:top-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${label} mb-0`}>Price (€)</label>
              <span className="text-[11px] text-dark-400 inline-flex items-center gap-1">
                {quoting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-gold-500" />}
                {quote != null ? `Website price €${quote.toFixed(2)}` : "Website price appears once the route is set"}
              </span>
            </div>
            <input
              className={`${field} font-display text-2xl`}
              type="number" min={0} step="0.5" value={price}
              onChange={(e) => { setPrice(e.target.value); setPriceTouched(true); }}
              placeholder="0.00"
            />
            {quote != null && priceTouched && parseFloat(price) !== quote && (
              <button type="button" onClick={() => { setPrice(String(quote)); setPriceTouched(false); }} className="text-[11px] text-gold-400 mt-1.5 hover:underline">
                Use website price
              </button>
            )}
            {/* What the customer is actually being charged, once there are two
                legs. The field above is one of them, and a card link for the
                outbound alone would leave the way home unpaid. */}
            {legCount > 1 && Number.isFinite(tripTotal) && (
              <div className="mt-3 rounded-lg border border-gold-500/25 bg-gold-500/[0.06] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-dark-300">
                    {returnOn ? "Out" : "Ride 1"}{vehicleCount > 1 && <span className="text-dark-500"> × {vehicleCount}</span>}
                  </span>
                  <span className="text-white">€{((Number.isFinite(amount) ? amount : 0) * vehicleCount).toFixed(2)}</span>
                </div>
                {returnOn && (
                  <div className="flex items-baseline justify-between gap-2 text-sm mt-1">
                    <span className="text-dark-300">
                      Back{vehicleCount > 1 && <span className="text-dark-500"> × {vehicleCount}</span>}
                    </span>
                    <span className="text-white">€{((Number.isFinite(backAmount) ? backAmount : 0) * vehicleCount).toFixed(2)}</span>
                  </div>
                )}
                {rides.map((r, i) => {
                  const n = parseFloat(r.price);
                  return (
                    <div key={r.key} className="flex items-baseline justify-between gap-2 text-sm mt-1">
                      <span className="text-dark-300 truncate">
                        Ride {i + 2}{r.vehicleCount > 1 && <span className="text-dark-500"> × {r.vehicleCount}</span>}
                      </span>
                      <span className="text-white">€{((Number.isFinite(n) ? n : 0) * r.vehicleCount).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex items-baseline justify-between gap-2 mt-2 pt-2 border-t border-gold-500/20">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-gold-500/80 font-semibold">
                    {legCount} bookings
                  </span>
                  <span className="font-display text-xl text-gold-300">€{tripTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={label}>Driver sees (€, optional)</label>
            <input className={field} type="number" min={0} step="0.5" value={driverAmount} onChange={(e) => setDriverAmount(e.target.value)} placeholder="Leave empty for the usual share" />
          </div>

          <div>
            <label className={label}><Wallet size={11} className="inline mr-1 -mt-0.5" />Payment</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${method === m ? "border-gold-500 bg-gold-500/10 text-white" : "border-white/[0.08] text-dark-300 hover:border-white/20"}`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-dark-400 mt-2 leading-relaxed">{METHOD_HELP[method]}</p>
            <label className="flex items-center gap-2 mt-3 text-sm text-dark-200 cursor-pointer">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-[#c9a84c]" />
              Already paid
            </label>
            <label className="flex items-center gap-2 mt-2 text-sm text-dark-200 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-[#c9a84c]" />
              Email the confirmation to the customer
            </label>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ready || saving}
            className="btn-gold w-full py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {saving
              ? (source?.kind === "unpaid" ? "Completing…" : "Creating…")
              : (source?.kind === "unpaid" ? `Complete ${source.label}`
                : legCount > 1 ? `Create ${legCount} bookings`
                : "Create booking")}
          </button>
          {!ready && (
            <p className="text-[11px] text-dark-500 text-center">
              {returnOn && !returnReady
                ? "The return needs a date and a time, after the outbound journey."
                : !ridesReady
                  ? "Every extra ride needs both addresses, a date, a time and a price."
                  : "Name, email, phone, both addresses, date, time and a price are needed."}
            </p>
          )}
          {legCount > 1 && ready && (
            <p className="text-[11px] text-dark-500 text-center">
              {legCount} bookings, each with its own reference and its own confirmation. The fare is charged once, on the first.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
