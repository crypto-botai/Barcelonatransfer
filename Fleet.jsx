import { useState } from "react";

const fleet = [
  {
    id: "standard",
    category: "Standard Sedan",
    model: "Toyota Corolla or similar",
    badge: "Best Value",
    pax: "1–3",
    luggage: "2",
    features: ["Air Conditioning", "USB Charging", "Wi-Fi", "Water Bottle"],
    price: "From €50",
    img: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&q=80",
    color: "#c8a96e",
  },
  {
    id: "economy",
    category: "Economy Executive",
    model: "Toyota Camry",
    badge: null,
    pax: "1–3",
    luggage: "3",
    features: ["Leather Seats", "Climate Control", "USB/Lightning", "Privacy Glass"],
    price: "From €55",
    img: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=600&q=80",
    color: "#a8956a",
  },
  {
    id: "luxury",
    category: "Luxury Sedan",
    model: "Mercedes E-Class / Lexus ES",
    badge: "Most Popular",
    pax: "1–3",
    luggage: "3",
    features: ["Premium Leather", "Massage Seats", "Ambient Lighting", "Champagne Service"],
    price: "From €65",
    img: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=600&q=80",
    color: "#c8a96e",
  },
  {
    id: "minivan",
    category: "Minivan 8-Seater",
    model: "Volkswagen Caravelle",
    badge: null,
    pax: "4–8",
    luggage: "6",
    features: ["Individual Seats", "Panoramic Roof", "USB Charging", "Extra Luggage"],
    price: "From €65",
    img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80",
    color: "#a8956a",
  },
  {
    id: "vclass",
    category: "Mercedes V-Class",
    model: "Mercedes-Benz V-Class",
    badge: "VIP Choice",
    pax: "6–7",
    luggage: "7",
    features: ["Business Lounge Interior", "Leather Seats", "Wi-Fi", "Drinks Cabinet", "Privacy Glass"],
    price: "From €80",
    img: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=600&q=80",
    color: "#c8a96e",
  },
  {
    id: "minibus",
    category: "Minibus",
    model: "Mercedes Sprinter 16–19 pax",
    badge: "Groups",
    pax: "9–19",
    luggage: "12",
    features: ["Reclining Seats", "Air Conditioning", "Luggage Hold", "USB Charging"],
    price: "From €120",
    img: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&q=80",
    color: "#a8956a",
  },
];

export default function Fleet() {
  const [active, setActive] = useState(null);

  return (
    <section className="fleet section" id="fleet">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Our Fleet</span>
          <h2 className="section-title">Luxury Vehicle Collection</h2>
          <p className="section-sub">
            Every vehicle meticulously maintained, professionally presented, and driven by certified chauffeurs.
          </p>
        </div>

        <div className="fleet__grid">
          {fleet.map((v) => (
            <div className={`fleet-card ${active === v.id ? "fleet-card--active" : ""}`} key={v.id}>
              {v.badge && <span className="fleet-card__badge">{v.badge}</span>}
              <div className="fleet-card__img-wrap">
                <img src={v.img} alt={v.model} className="fleet-card__img" loading="lazy" />
                <div className="fleet-card__img-overlay" />
              </div>
              <div className="fleet-card__body">
                <span className="fleet-card__category">{v.category}</span>
                <h3 className="fleet-card__model">{v.model}</h3>
                <div className="fleet-card__specs">
                  <span>👤 {v.pax} pax</span>
                  <span>🧳 {v.luggage} bags</span>
                </div>
                <ul className="fleet-card__features">
                  {v.features.map((f) => (
                    <li key={f}><span className="feat-check">✦</span>{f}</li>
                  ))}
                </ul>
                <div className="fleet-card__footer">
                  <span className="fleet-card__price">{v.price}</span>
                  <div className="fleet-card__btns">
                    <a href="#booking" className="btn-gold">Book Now</a>
                    <a
                      href={`https://wa.me/34600000000?text=${encodeURIComponent(`I'd like to book the ${v.category} – ${v.model}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-wa"
                    >WhatsApp</a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="fleet__note">
          <span className="fleet-note-icon">⚡</span>
          <p>Travelling with <strong>9+ passengers?</strong> We'll automatically suggest a minibus or two luxury minivans — just enter your passenger count in the booking form above.</p>
        </div>
      </div>
    </section>
  );
}
