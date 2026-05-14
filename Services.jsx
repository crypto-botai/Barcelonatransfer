const services = [
  { icon: "✈", title: "Airport Transfers", desc: "Meet & greet service with flight monitoring. Your chauffeur waits free of charge for up to 60 minutes." },
  { icon: "⚓", title: "Cruise Port Transfers", desc: "Seamless transfers to and from Barcelona Cruise Terminal in ultimate comfort." },
  { icon: "💼", title: "Executive Chauffeur", desc: "Dedicated chauffeur hire for business meetings, corporate events, and executive travel." },
  { icon: "🏢", title: "Corporate Transfers", desc: "Premium corporate accounts with invoicing, dedicated fleet, and priority service." },
  { icon: "🎭", title: "Event Transportation", desc: "VIP transportation for weddings, galas, private events, and special occasions." },
  { icon: "⏱", title: "Hourly Chauffeur Hire", desc: "Flexible hourly hire from 4 hours minimum. Your private chauffeur at your disposal." },
  { icon: "🏖", title: "Costa Brava Transfers", desc: "Luxury private transfers to all Costa Brava resorts — Lloret, Platja d'Aro, Cadaqués." },
  { icon: "🌅", title: "Costa Dorada Transfers", desc: "Private transfers to Sitges, Salou, PortAventura, Tarragona and all Costa Dorada." },
  { icon: "🏔", title: "Andorra Transfers", desc: "Premium private transfer from Barcelona to Andorra — the most comfortable way to travel." },
  { icon: "🛎", title: "Hotel Transfers", desc: "Door-to-door luxury transfers to all Barcelona hotels and resorts." },
  { icon: "👑", title: "VIP Transportation", desc: "Discreet, exclusive VIP transfers for high-profile clients requiring maximum privacy." },
  { icon: "🗺", title: "Private Day Tours", desc: "Custom private tours: Montserrat, La Roca Village, Girona, wine regions and beyond." },
];

export default function Services() {
  return (
    <section className="services section" id="services">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Our Services</span>
          <h2 className="section-title">Premium Chauffeur Services</h2>
          <p className="section-sub">
            Every journey crafted to perfection — from airport arrivals to private tours across Catalonia.
          </p>
        </div>
        <div className="services__grid">
          {services.map((s) => (
            <div className="service-card" key={s.title}>
              <span className="service-card__icon">{s.icon}</span>
              <h3 className="service-card__title">{s.title}</h3>
              <p className="service-card__desc">{s.desc}</p>
              <a href="#booking" className="service-card__link">Book Now →</a>
            </div>
          ))}
        </div>

        <div className="features-row">
          <div className="feature-pill">
            <span className="feature-pill__icon">🛫</span>
            <div>
              <strong>Flight Monitoring</strong>
              <p>We track your flight in real-time</p>
            </div>
          </div>
          <div className="feature-pill">
            <span className="feature-pill__icon">⏳</span>
            <div>
              <strong>Free Waiting Time</strong>
              <p>60 min airport · 15 min elsewhere</p>
            </div>
          </div>
          <div className="feature-pill">
            <span className="feature-pill__icon">🪧</span>
            <div>
              <strong>Meet &amp; Greet</strong>
              <p>Name board in arrivals hall</p>
            </div>
          </div>
          <div className="feature-pill">
            <span className="feature-pill__icon">💳</span>
            <div>
              <strong>Fixed Prices</strong>
              <p>No surge pricing, ever</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
