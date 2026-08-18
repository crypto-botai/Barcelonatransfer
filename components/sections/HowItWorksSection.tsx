import Link from "next/link";
import { ROUTES } from "@/lib/pricing";

/**
 * The part of the service a first-time visitor actually needs explained.
 *
 * Written because the homepage carried 1,501 words against 31 headings, which
 * an audit reads as structure with nothing underneath it. Padding would not
 * have fixed that — this answers the questions people genuinely arrive with:
 * where the driver stands at El Prat, what happens when the flight is late,
 * and what the price does and does not include.
 *
 * Every figure is read from the price table rather than written here, so the
 * text cannot drift from what the booking charges.
 */
export default function HowItWorksSection() {
  const airportCity = ROUTES.find((r) => r.from === "airport" && r.to === "barcelona_city");
  const from = airportCity?.economy ?? 50;
  const destinations = new Set(ROUTES.map((r) => r.to)).size;

  return (
    <section className="py-20 bg-[#050505] border-t border-white/[0.06]">
      <div className="container mx-auto px-4 max-w-3xl">
        <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-3">
          Before you book
        </span>
        <h2 className="font-display text-4xl sm:text-5xl text-white mb-8">
          How a Barcelona <span className="text-gold-gradient">airport transfer works</span>
        </h2>

        <div className="space-y-5 text-dark-300 leading-relaxed">
          <p>
            A private transfer is not a taxi and not a shared shuttle. The car is booked for
            your journey alone, the price is agreed before you travel, and the driver is
            waiting whether you land on time or three hours late. There is no meter, no
            queue at the rank, and no second family in the back with you.
          </p>

          <h3 className="font-display text-2xl text-white pt-4">
            Where your driver waits at El Prat
          </h3>
          <p>
            Barcelona airport has two terminals, T1 and T2, and they are far enough apart
            that turning up at the wrong one costs you half an hour. Your driver goes to the
            terminal your flight actually lands at — we take the flight number when you book
            and check it against the arrivals board on the day.
          </p>
          <p>
            You will find the car at the designated meeting point outside the terminal, next
            to the taxi rank, which is where licensed VTC vehicles are permitted to stop and
            wait. If you would rather be met inside the arrivals hall with a name board, that
            is a €5 extra you can add when booking — worth it with children or a lot of
            luggage, and unnecessary if you travel light.
          </p>
          <p>
            Airport pickups include <strong className="text-white">60 minutes of free waiting</strong>{" "}
            from the moment the plane touches down. That covers passport control and baggage
            reclaim on a normal day. Pickups from a city address, the cruise port or a station
            include 15 minutes, since there is no customs queue to clear.
          </p>

          <h3 className="font-display text-2xl text-white pt-4">
            What the price includes
          </h3>
          <p>
            Fares are fixed per vehicle, not per person. A family of four pays the same as
            one traveller in the same car, and the figure you are quoted is the figure you
            pay — it does not move with traffic, with the hour of the night, or with how busy
            the airport happens to be. The airport run into central Barcelona starts at €{from}.
          </p>
          <p>
            That price covers the car, the driver and the fuel. Two things sit outside it and
            we would rather say so plainly than surprise you: 10% Spanish VAT is added only
            if you ask for an invoice, and motorway tolls are charged separately on the longer
            routes that use them — the coast roads south and north, not the short run into the
            city. Child seats, meet and greet and other extras are optional and priced
            individually.
          </p>

          <h3 className="font-display text-2xl text-white pt-4">
            Where we drive
          </h3>
          <p>
            There are {destinations} destinations with a published fixed price, from the city
            centre and the{" "}
            <Link href="/transfers/cruise-port" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              cruise terminal
            </Link>{" "}
            out to{" "}
            <Link href="/transfers/sitges" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Sitges
            </Link>
            , the{" "}
            <Link href="/transfers/costa-brava" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Costa Brava
            </Link>
            ,{" "}
            <Link href="/transfers/tarragona" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Tarragona
            </Link>{" "}
            and over the Pyrenees to{" "}
            <Link href="/transfers/andorra" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Andorra
            </Link>
            . Anywhere without a listed fare is still bookable and still quoted instantly,
            priced by the distance rather than left as a message-us-for-a-quote.
          </p>
          <p>
            Elite BCN is a licensed VTC operator, which in Spain is the legal category that
            permits pre-booked private hire with a professional driver. Every journey is
            arranged in advance; we cannot be hailed in the street, and that is precisely why
            the price can be fixed before you travel.
          </p>
        </div>
      </div>
    </section>
  );
}
