export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="navbar__logo footer__logo">
              <span className="logo-icon">◆</span>
              <span className="logo-text">ÉLITE<span className="logo-accent">BCN</span></span>
            </div>
            <p className="footer__tagline">Luxury Private Transfers & Chauffeur Service in Barcelona</p>
            <div className="footer__contact">
              <a href="tel:+34600000000">+34 600 000 000</a>
              <a href="mailto:info@elitebcn.com">info@elitebcn.com</a>
              <a href="https://wa.me/34600000000" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>

          <div className="footer__col">
            <h4>Services</h4>
            <ul>
              <li><a href="#services">Airport Transfers</a></li>
              <li><a href="#services">Cruise Port Transfers</a></li>
              <li><a href="#services">Executive Chauffeur</a></li>
              <li><a href="#services">Corporate Travel</a></li>
              <li><a href="#services">Hourly Hire</a></li>
              <li><a href="#services">VIP Transportation</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Destinations</h4>
            <ul>
              <li><a href="#pricing">Barcelona Airport</a></li>
              <li><a href="#pricing">Sitges</a></li>
              <li><a href="#pricing">Lloret de Mar</a></li>
              <li><a href="#pricing">Salou & PortAventura</a></li>
              <li><a href="#pricing">Andorra</a></li>
              <li><a href="#pricing">Girona Airport</a></li>
              <li><a href="#pricing">Tarragona</a></li>
              <li><a href="#pricing">Cadaqués</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Fleet</h4>
            <ul>
              <li><a href="#fleet">Standard Sedan</a></li>
              <li><a href="#fleet">Economy – Toyota Camry</a></li>
              <li><a href="#fleet">Luxury – Mercedes E-Class</a></li>
              <li><a href="#fleet">Minivan 8-Seater</a></li>
              <li><a href="#fleet">Mercedes V-Class</a></li>
              <li><a href="#fleet">Minibus Groups</a></li>
            </ul>
          </div>
        </div>

        <div className="footer__divider" />

        <div className="footer__bottom">
          <p>© 2025 Élite BCN. All rights reserved. Luxury Private Transfers in Barcelona.</p>
          <div className="footer__legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms & Conditions</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>

        <div className="footer__seo">
          <p>
            <a href="#">Barcelona Airport Transfer</a> ·{" "}
            <a href="#">Barcelona Chauffeur Service</a> ·{" "}
            <a href="#">Luxury Transfer Barcelona</a> ·{" "}
            <a href="#">Private Driver Barcelona</a> ·{" "}
            <a href="#">Barcelona to Sitges Transfer</a> ·{" "}
            <a href="#">Barcelona to Andorra</a> ·{" "}
            <a href="#">Barcelona Cruise Port Transfer</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
