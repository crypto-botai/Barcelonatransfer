"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Inbox, Loader2, MapPin, Send, Sparkles, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type BookingPaymentMethod } from "@/lib/payment-method";
import ImportPanel, { type ImportSource, type Prefill } from "./ImportPanel";

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
  const [flight, setFlight]   = useState("");
  const [notes, setNotes]     = useState("");

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
  const ready = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 6
    && pickup.address && dropoff.address && date && time && amount >= 0 && !Number.isNaN(amount);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the booking");
      toast.success(
        `Booking ${data.confirmationCode} ${source?.kind === "unpaid" ? "completed" : "created"}${sendEmail ? " — confirmation sent" : ""}`,
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
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">New booking</h1>
        <p className="text-dark-400 mt-1">For a customer booking by phone or WhatsApp, or finishing one they started online. Priced the same as the website; the customer receives the confirmation email.</p>
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
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-3">
                <div><label className={label}>Flight number</label><input className={field} value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="VY8301" /></div>
                <div><label className={label}>Notes for the chauffeur</label><input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Child seat, name board text, meeting point…" /></div>
              </div>
            </div>
          </section>
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
              : (source?.kind === "unpaid" ? `Complete ${source.label}` : "Create booking")}
          </button>
          {!ready && <p className="text-[11px] text-dark-500 text-center">Name, email, phone, both addresses, date, time and a price are needed.</p>}
        </aside>
      </div>
    </div>
  );
}
