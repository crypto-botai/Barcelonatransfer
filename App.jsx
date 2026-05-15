import Hero from "./components/Hero";
import Fleet from "./components/Fleet";
import Pricing from "./components/Pricing";
import Services from "./components/Services";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <Hero />
      <Services />
      <Fleet />
      <Pricing />
      <Testimonials />
      <FAQ />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
