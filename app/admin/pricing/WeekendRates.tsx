import { upcomingWeekends } from "@/lib/weekend-pricing";

/**
 * The weekend uplift, for the office only.
 *
 * Customers are shown a price and never a percentage, so this is the one place
 * the percentage is written down. A weekend runs from Friday 12:00 to Monday
 * 12:00, Barcelona time, and every route is raised by that weekend's percentage
 * (15 to 22, picked once per weekend and never changing for it). The prices in
 * the editor below are the weekday prices.
 */
export default function WeekendRates() {
  const weekends = upcomingWeekends(new Date(), 10);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const example = (p: number) => Math.round(50 * (1 + p / 100));

  return (
    <section className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6" aria-label="Weekend prices">
      <h2 className="font-display text-xl text-white">Weekend prices</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-dark-400">
        From Friday 12:00 to Monday 12:00 (Barcelona), every transfer costs a little more, by one percentage that is the same for every route that weekend. The percentage is chosen once for each weekend and never changes for it, so a quote given today is the price charged later. Customers see the price only, never the percentage. The prices in the editor below are the weekday prices; hourly hire is not affected.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {weekends.map((w) => (
          <li key={w.friday} className={`rounded-xl border px-3.5 py-3 ${w.current ? "border-gold-500/40 bg-gold-500/[0.07]" : "border-white/[0.08]"}`}>
            <p className="text-xs text-dark-400">{fmt(w.friday)} to {fmt(w.monday)}{w.current ? " · now" : ""}</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">+{w.percent}%</p>
            <p className="mt-0.5 text-[11px] text-dark-500">a €50 fare is €{example(w.percent)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
