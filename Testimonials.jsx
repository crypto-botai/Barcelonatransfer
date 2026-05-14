import { useState, useEffect } from "react";

const reviews = [
  { name: "James Thornton", location: "London, UK", rating: 5, text: "Absolutely impeccable service. The driver was waiting for us at arrivals with a name board, the Mercedes was spotless, and the journey to our hotel was smooth and relaxed. Will always use Élite BCN for Barcelona transfers.", avatar: "JT" },
  { name: "Margot Dubois", location: "Paris, France", rating: 5, text: "We had a group of 7 for a conference. The V-Class was perfect — luxurious, spacious, and the driver was professional and punctual. Corporate invoicing was handled effortlessly.", avatar: "MD" },
  { name: "Alexander Müller", location: "Munich, Germany", rating: 5, text: "Booked the hourly chauffeur service for a full day tour. Montserrat, La Roca Village, then back to the hotel. Outstanding. This is how luxury transfers should feel.", avatar: "AM" },
  { name: "Sofia Reyes", location: "Miami, USA", rating: 5, text: "Used Élite BCN for our cruise port transfer. They tracked our ship's arrival time and adjusted accordingly. No waiting, no stress — just pure comfort from ship to hotel.", avatar: "SR" },
  { name: "David Chen", location: "Singapore", rating: 5, text: "The booking was instant via WhatsApp, price was transparent and fair, driver was early and immaculately dressed. The Lexus was gorgeous. Highly recommend for business travel.", avatar: "DC" },
  { name: "Isabella Romano", location: "Milan, Italy", rating: 5, text: "Transferred from Barcelona to Sitges for our wedding anniversary. The driver brought flowers and champagne. An unforgettable start to a perfect weekend.", avatar: "IR" },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const go = (dir) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent((c) => (c + dir + reviews.length) % reviews.length);
      setAnimating(false);
    }, 300);
  };

  useEffect(() => {
    const timer = setInterval(() => go(1), 5000);
    return () => clearInterval(timer);
  }, []);

  const visible = [
    reviews[current % reviews.length],
    reviews[(current + 1) % reviews.length],
    reviews[(current + 2) % reviews.length],
  ];

  return (
    <section className="testimonials section" id="testimonials">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Client Reviews</span>
          <h2 className="section-title">What Our Clients Say</h2>
          <div className="testimonials__rating-bar">
            <span className="stars">★★★★★</span>
            <span className="rating-text">4.9 / 5 — Based on 200+ Google reviews</span>
          </div>
        </div>

        <div className={`testimonials__grid ${animating ? "fade-out" : "fade-in"}`}>
          {visible.map((r, i) => (
            <div className="review-card" key={i}>
              <div className="review-card__header">
                <div className="review-card__avatar">{r.avatar}</div>
                <div>
                  <strong>{r.name}</strong>
                  <span className="review-card__location">{r.location}</span>
                </div>
                <div className="review-card__stars">{"★".repeat(r.rating)}</div>
              </div>
              <p className="review-card__text">"{r.text}"</p>
              <div className="review-card__google">
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Verified Google Review
              </div>
            </div>
          ))}
        </div>

        <div className="testimonials__nav">
          <button onClick={() => go(-1)} className="nav-arrow">←</button>
          <div className="testimonials__dots">
            {reviews.map((_, i) => (
              <span key={i} className={`dot ${i === current ? "dot--active" : ""}`} onClick={() => setCurrent(i)} />
            ))}
          </div>
          <button onClick={() => go(1)} className="nav-arrow">→</button>
        </div>
      </div>
    </section>
  );
}
