import { useState } from "react";

const faqs = [
  { q: "How do I book a transfer?", a: "You can book instantly via our booking form above, WhatsApp (+34 600 000 000), or email. We'll confirm your booking within 15 minutes with a full itinerary and driver details." },
  { q: "Do you track my flight?", a: "Yes. We monitor all flight arrivals in real-time. If your flight is delayed, we automatically adjust your pickup time at no extra charge. Your driver will always be there when you land." },
  { q: "How long do you wait at the airport?", a: "We provide 60 minutes of free waiting time from your flight's actual landing time. This gives you time to collect luggage, clear customs, and find your driver in the arrivals hall." },
  { q: "Will my driver have a name board?", a: "Absolutely. Your professional chauffeur will be waiting in the arrivals hall with a personalized name board, dressed in smart attire. This is our standard Meet & Greet service, included in every airport booking." },
  { q: "What if I need to cancel?", a: "Free cancellation up to 24 hours before your pickup time. Cancellations within 24 hours may be subject to a cancellation fee. Please contact us directly for any changes." },
  { q: "Are prices fixed or do they surge?", a: "All our prices are 100% fixed and transparent. You'll see the exact price before booking. We never apply surge pricing, regardless of time of day, weather, or demand." },
  { q: "Do you offer child seats?", a: "Yes. Baby seats, toddler seats, and booster seats are available at no extra charge. Please mention your requirement when booking and we'll have the appropriate seat installed." },
  { q: "Can I book for a group larger than 8 people?", a: "Absolutely. For groups of 9–19 passengers, we offer luxury minibus service. For larger groups, we can arrange multiple vehicles. Contact us for a custom quote." },
  { q: "Do you serve the Cruise Terminal?", a: "Yes. We specialize in cruise port transfers to and from Barcelona Cruise Terminal. We monitor vessel arrivals and can coordinate pickups directly dockside." },
  { q: "Can I book a driver for the full day?", a: "Yes. Our hourly chauffeur service starts from 4 hours minimum. Your dedicated driver will be at your disposal for the entire duration — meetings, shopping, sightseeing, or multiple transfers." },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="faq section" id="faq">
      <div className="container faq__inner">
        <div className="section-header">
          <span className="section-tag">FAQ</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-sub">Everything you need to know about our luxury transfer service.</p>
        </div>
        <div className="faq__list">
          {faqs.map((f, i) => (
            <div className={`faq-item ${open === i ? "faq-item--open" : ""}`} key={i}>
              <button className="faq-item__q" onClick={() => setOpen(open === i ? null : i)}>
                <span>{f.q}</span>
                <span className="faq-item__icon">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <div className="faq-item__a">{f.a}</div>}
            </div>
          ))}
        </div>

        <div className="faq__cta">
          <p>Still have questions?</p>
          <div className="faq__cta-btns">
            <a href="tel:+34600000000" className="btn-gold">Call Us Now</a>
            <a href="https://wa.me/34600000000" target="_blank" rel="noreferrer" className="btn-outline">WhatsApp Us</a>
            <a href="mailto:info@elitebcn.com" className="btn-outline">Send Email</a>
          </div>
        </div>
      </div>
    </section>
  );
}
