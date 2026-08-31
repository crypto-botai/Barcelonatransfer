import Link from "next/link";
import type { HubChild } from "@/lib/hub-children";

/**
 * A hub's links down to the pages it covers.
 *
 * Each anchor is the place or line name itself, so no two links on the page
 * share text and none is a repeated exact-match phrase. Rendered as a list
 * because that is what it is — a reader scanning for their own destination.
 */
export default function HubChildLinks({
  heading,
  intro,
  children,
}: {
  heading: string;
  intro: string;
  children: HubChild[];
}) {
  if (children.length === 0) return null;
  return (
    <section className="py-14 bg-dark-950 border-t border-white/[0.06]">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="font-display text-2xl text-white mb-3">{heading}</h2>
        <p className="text-dark-300 mb-6">{intro}</p>
        <ul className="flex flex-wrap gap-x-2 gap-y-2.5">
          {children.map((c, i) => (
            <li key={c.href} className="flex items-center">
              <Link
                href={c.href}
                className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/30 transition-colors"
              >
                {c.label}
              </Link>
              {i < children.length - 1 && (
                <span aria-hidden="true" className="text-dark-500 ml-2">·</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
