import { useState } from "react";

const VEHICLES = {
  1: ["Standard Sedan", "Economy Sedan", "Luxury Sedan – Mercedes E-Class"],
  2: ["Standard Sedan", "Economy Sedan", "Luxury Sedan – Mercedes E-Class"],
  3: ["Standard Sedan", "Economy Sedan", "Luxury Sedan – Mercedes E-Class"],
  4: ["Minivan 8-Seater", "Mercedes V-Class"],
  5: ["Minivan 8-Seater", "Mercedes V-Class"],
  6: ["Minivan 8-Seater", "Mercedes V-Class"],
  7: ["8-Seater Van", "Mercedes V-Class"],
  8: ["8-Seater Van", "Mercedes V-Class"],
};

export default function Hero() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [suggested, setSuggested] = useState([]);

  const handlePax = (val) => {
    setPax(val);
    if (val >= 9) setSuggested(["Minibus", "Two Minivans"]);
    else setSuggested(VEHICLES[val] || []);
  };

  const handleBook = (e) => {
    e.preventDefault();
    const msg = encodeURIComponent(
      `Hello, I'd like to book a luxury transfer.\n\nFrom: ${from}\nTo: ${to}\nPassengers: ${pax}\nDate: ${date}\nTime: ${time}\nSuggested vehicle: ${suggested[0] || "Any"}`
    );
    window.open(`https://wa.me/34600000000?text=${msg}`, "_blank");
  };

  return (
    <section className="hero" id="home">
      <div className="hero__bg">
        <div className="hero__overlay" />
        <div className="hero__particles">
          {[...Array(20)].map((_, i) => (
            <span key={i} className="particle" style={{ "--i": i }} />
          ))}
        </div>
      </div>

      <div className="hero__content">
        <div className="hero__badge">
          <span className="badge-dot" />
          <span>Barcelona's #1 Luxury Chauffeur Service</span>
        </div>

        <h1 className="hero__title">
          Luxury Private Transfers
          <span className="hero__title-line2"> in Barcelona</span>
        </h1>

        <p className="hero__sub">
          Premium chauffeur service with professional drivers, luxury vehicles,
          airport transfers, and executive transportation across Barcelona and Spain.
        </p>

        <div className="hero__trust">
          <span>✦ Meet &amp; Greet</span>
          <span>✦ Flight Monitoring</span>
          <span>✦ Free Waiting Time</span>
          <span>✦ 24/7 Concierge</span>
        </div>

        <form className="booking-form" onSubmit={handleBook} id="booking">
          <div className="booking-form__grid">
            <div className="booking-form__field">
              <label>Pick-up Location</label>
              <input
                type="text"
                placeholder="Airport, hotel, or address…"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div className="booking-form__field">
              <label>Drop-off Location</label>
              <input
                type="text"
                placeholder="Destination…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <div className="booking-form__field booking-form__field--sm">
              <label>Passengers</label>
              <select value={pax} onChange={(e) => handlePax(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? "passenger" : "passengers"}</option>
                ))}
              </select>
            </div>
            <div className="booking-form__field booking-form__field--sm">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="booking-form__field booking-form__field--sm">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          {suggested.length > 0 && (
            <div className="booking-form__suggest">
              <span className="suggest-label">Recommended for {pax} passengers:</span>
              {suggested.map((v) => (
                <span className="suggest-tag" key={v}>{v}</span>
              ))}
            </div>
          )}

          <div className="booking-form__actions">
            <button type="submit" className="btn-gold btn-gold--lg">
              <span>Book Your Transfer</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <a href="#fleet" className="btn-outline">View Luxury Fleet</a>
            <a
              href="https://wa.me/34600000000"
              target="_blank"
              rel="noreferrer"
              className="btn-outline btn-outline--wa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          </div>
        </form>

        <div className="hero__stats">
          <div className="stat"><span className="stat-num" data-target="5000">5,000+</span><span className="stat-label">Happy Clients</span></div>
          <div className="stat"><span className="stat-num">4.9★</span><span className="stat-label">Google Rating</span></div>
          <div className="stat"><span className="stat-num">24/7</span><span className="stat-label">Availability</span></div>
          <div className="stat"><span className="stat-num">100%</span><span className="stat-label">On-Time Rate</span></div>
        </div>
      </div>
    </section>
  );
}
