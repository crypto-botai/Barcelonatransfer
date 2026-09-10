import Image from "next/image";
import { destinationPhoto } from "@/lib/destination-photos";

/**
 * A destination photograph with the credit its licence requires.
 *
 * Deliberately one component rather than an <Image> plus a caption someone
 * remembers to add. These are CC BY and CC BY-SA photographs: showing one
 * without naming the author and the licence is a breach, so the two are not
 * separable here. Nothing renders at all for a slug with no photograph.
 *
 * `priority` is off by default. These sit below the fold on every page that
 * uses them, and the hero's LCP is the one thing on this site that has been
 * fought for hardest.
 */
export default function DestinationPhoto({
  slug,
  className = "",
  priority = false,
}: {
  slug: string;
  className?: string;
  priority?: boolean;
}) {
  const photo = destinationPhoto(slug);
  if (!photo) return null;

  return (
    <figure className={`relative overflow-hidden rounded-2xl border border-white/[0.08] ${className}`}>
      <div className="relative aspect-[16/9]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 900px"
          className="object-cover"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
        {/* The credit sits on the image rather than under it so it cannot be
            separated from the photograph by a later layout change. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-8 pb-2 px-3">
          <figcaption className="text-[10px] leading-snug text-white/70">
            {photo.alt}
            {" · "}
            <span className="text-white/45">
              {photo.author}
              {", "}
              <a
                href={photo.source}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-white/25 hover:text-white/70 transition-colors"
              >
                {photo.license}
              </a>
            </span>
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
