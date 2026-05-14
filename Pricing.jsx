import { useState } from "react";

const tabs = ["Airport & City", "Costa Dorada", "Costa Brava", "Hourly"];

const airport = [
  { route: "El Prat Airport ⇄ Barcelona City", p1: 50, p2: 65, p3: 70 },
  { route: "El Prat Airport ⇄ Cruise Terminal", p1: 50, p2: 65, p3: 70 },
  { route: "Cruise Terminal ⇄ Barcelona City", p1: 50, p2: 65, p3: 70 },
  { route: "El Prat Airport ⇄ Sants Station", p1: 55, p2: 65, p3: 75 },
  { route: "Barcelona ⇄ La Roca Village", p1: 80, p2: 100, p3: 120 },
  { route: "Barcelona ⇄ Montserrat", p1: 120, p2: 140, p3: 160 },
  { route: "Barcelona ⇄ Girona Airport", p1: 140, p2: 155, p3: 175 },
  { route: "Barcelona ⇄ Andorra", p1: 260, p2: 285, p3: 300 },
];

const dorada = [
  { route: "Barcelona ⇄ Castelldefels", p1: 50, p2: 60, p3: 70 },
  { route: "Barcelona ⇄ Sitges", p1: 80, p2: 100, p3: 120 },
  { route: "Barcelona ⇄ Cubelles", p1: 90, p2: 110, p3: 130 },
  { route: "Barcelona ⇄ Calafell", p1: 100, p2: 120, p3: 140 },
  { route: "Barcelona ⇄ Vendrell", p1: 110, p2: 130, p3: 150 },
  { route: "Barcelona ⇄ Tarragona", p1: 150, p2: 170, p3: 190 },
  { route: "Barcelona ⇄ La Pineda", p1: 155, p2: 175, p3: 195 },
  { route: "Barcelona ⇄ Salou", p1: 155, p2: 175, p3: 195 },
  { route: "Barcelona ⇄ PortAventura", p1: 155, p2: 175, p3: 195 },
  { route: "Barcelona ⇄ Cambrils", p1: 160, p2: 180, p3: 200 },
];

const brava = [
  { route: "Barcelona ⇄ Mataró", p1: 90, p2: 110, p3: 130 },
  { route: "Barcelona ⇄ Calella", p1: 110, p2: 130, p3: 150 },
  { route: "Barcelona ⇄ Pineda de Mar", p1: 115, p2: 135, p3: 155 },
  { route: "Barcelona ⇄ Santa Susanna", p1: 120, p2: 140, p3: 160 },
  { route: "Barcelona ⇄ Malgrat de Mar", p1: 125, p2: 145, p3: 165 },
  { route: "Barcelona ⇄ Blanes", p1: 135, p2: 155, p3: 175 },
  { route: "Barcelona ⇄ Lloret de Mar", p1: 145, p2: 165, p3: 185 },
  { route: "Barcelona ⇄ Girona Airport", p1: 140, p2: 160, p3: 180 },
  { route: "Barcelona ⇄ Tossa de Mar", p1: 155, p2: 175, p3: 195 },
  { route: "Barcelona ⇄ S'Agaró", p1: 155, p2: 175, p3: 195 },
  { route: "Barcelona ⇄ Platja d'Aro", p1: 160, p2: 180, p3: 200 },
  { route: "Barcelona ⇄ Palamós", p1: 185, p2: 205, p3: 225 },
  { route: "Barcelona ⇄ Roses", p1: 205, p2: 225, p3: 245 },
  { route: "Barcelona ⇄ Empuriabrava", p1: 210, p2: 230, p3: 250 },
  { route: "Barcelona ⇄ Figueres", p1: 200, p2: 220, p3: 240 },
  { route: "Barcelona ⇄ Cadaqués", p1: 240, p2: 260, p3: 280 },
];

const hourly = [
  { label: "Sedan (1–3 pax)", price: "€40 / hour", min: "Minimum 4 hours" },
  { label: "Minivan (4–6 pax)", price: "€50 / hour", min: "Minimum 4 hours" },
  { label: "Van / V-Class (7–8 pax)", price: "€60 / hour", min: "Minimum 4 hours" },
];

function PriceTable({ data, search }) {
  const filtered = data.filter((r) => r.route.toLowerCase().includes(search.toLowerCase()));
  return (
    <table className="price-table">
      <thead>
        <tr>
          <th>Route</th>
          <th>1–3 pax</th>
          <th>4–6 pax</th>
          <th>7–8 pax</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((r) => (
          <tr key={r.route}>
            <td className="price-table__route">{r.route}</td>
            <td className="price-table__val">€{r.p1}</td>
            <td className="price-table__val">€{r.p2}</td>
            <td className="price-table__val">€{r.p3}</td>
            <td>
              <a
                href={`https://wa.me/34600000000?text=${encodeURIComponent(`Hi, I'd like to book: ${r.route}`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-gold btn-gold--sm"
              >Book</a>
            </td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr><td colSpan={5} className="price-table__empty">No routes found. <a href="#booking">Request a custom quote</a></td></tr>
        )}
      </tbody>
    </table>
  );
}

export default function Pricing() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");

  return (
    <section className="pricing section" id="pricing">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Fixed Pricing</span>
          <h2 className="section-title">Transparent Luxury Pricing</h2>
          <p className="section-sub">
            All prices are fixed, all-inclusive. No hidden fees. No surge pricing. Ever.
          </p>
        </div>

        <div className="pricing__guarantees">
          <span>✦ No surge pricing</span>
          <span>✦ Fixed fare guaranteed</span>
          <span>✦ Free cancellation 24h</span>
          <span>✦ Instant confirmation</span>
        </div>

        <div className="pricing__controls">
          <div className="pricing__tabs">
            {tabs.map((t, i) => (
              <button
                key={t}
                className={`pricing__tab ${tab === i ? "active" : ""}`}
                onClick={() => { setTab(i); setSearch(""); }}
              >{t}</button>
            ))}
          </div>
          {tab !== 3 && (
            <input
              className="pricing__search"
              type="text"
              placeholder="Search destination…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>

        <div className="pricing__table-wrap">
          {tab === 0 && <PriceTable data={airport} search={search} />}
          {tab === 1 && <PriceTable data={dorada} search={search} />}
          {tab === 2 && <PriceTable data={brava} search={search} />}
          {tab === 3 && (
            <div className="hourly-grid">
              {hourly.map((h) => (
                <div className="hourly-card" key={h.label}>
                  <h3>{h.label}</h3>
                  <span className="hourly-card__price">{h.price}</span>
                  <span className="hourly-card__min">{h.min}</span>
                  <a href="#booking" className="btn-gold">Book Hourly</a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pricing__note">
          All prices include professional chauffeur, luxury vehicle, toll fees, and meet & greet service. Child seats available on request at no extra charge.
        </div>
      </div>
    </section>
  );
}
