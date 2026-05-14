import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="navbar__inner">
        <a href="#" className="navbar__logo">
          <span className="logo-icon">◆</span>
          <span className="logo-text">ÉLITE<span className="logo-accent">BCN</span></span>
        </a>
        <ul className={`navbar__links ${menuOpen ? "open" : ""}`}>
          <li><a href="#services" onClick={() => setMenuOpen(false)}>Services</a></li>
          <li><a href="#fleet" onClick={() => setMenuOpen(false)}>Fleet</a></li>
          <li><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a></li>
          <li><a href="#testimonials" onClick={() => setMenuOpen(false)}>Reviews</a></li>
          <li><a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a></li>
          <li><a href="tel:+34600000000" className="navbar__phone">+34 600 000 000</a></li>
          <li><a href="#booking" className="btn-gold" onClick={() => setMenuOpen(false)}>Book Now</a></li>
        </ul>
        <button className="navbar__burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
