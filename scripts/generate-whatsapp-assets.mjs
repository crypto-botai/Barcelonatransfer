/**
 * Builds the images WhatsApp shows for the business: the profile photo and one
 * square product picture per service.
 *
 *   node scripts/generate-whatsapp-assets.mjs [path-to-logo]
 *
 * The product pictures are drawn, not photographed, on purpose. The destination
 * photographs on the site are Creative Commons and need their credit shown next
 * to them, which a catalogue tile cannot do. Line art in the brand's gold on
 * black has no licence to satisfy and stays recognisably ours.
 *
 * No price is drawn on any picture. Prices change in the admin, and a figure
 * baked into an image would keep advertising the old one.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "whatsapp");
const brandDir = join(root, "public", "brand");
mkdirSync(outDir, { recursive: true });
mkdirSync(brandDir, { recursive: true });

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e6cf86";
const BONE = "#f2ece0";

// ── Icons, drawn in a 240 x 240 box centred on the origin ───────────────────
const icons = {
  plane: `<path d="M-100 8 L-18 -8 L-62 -92 L-36 -98 L42 -22 L98 -44 C116 -50 128 -32 110 -20 L52 12 L92 92 L66 98 L10 26 L-50 48 L-60 26 Z" />`,
  car: `<path d="M-104 34 L-104 4 C-104 -6 -98 -12 -88 -14 L-60 -20 L-34 -58 C-30 -64 -24 -66 -18 -66 L40 -66 C48 -66 54 -62 58 -56 L80 -20 L92 -16 C100 -14 104 -8 104 2 L104 34 Z" />
         <path d="M-26 -52 L-46 -20 L-8 -20 L-8 -52 Z M4 -52 L4 -20 L66 -20 L46 -52 Z" />
         <circle cx="-56" cy="38" r="22" /><circle cx="60" cy="38" r="22" />`,
  clock: `<circle cx="0" cy="0" r="92" /><path d="M0 -58 L0 0 L44 26" /><path d="M0 -92 L0 -78 M92 0 L78 0 M0 92 L0 78 M-92 0 L-78 0" />`,
  waves: `<path d="M-110 -40 C-82 -64 -56 -16 -28 -40 C0 -64 26 -16 54 -40 C82 -64 108 -16 110 -40" />
          <path d="M-110 8 C-82 -16 -56 32 -28 8 C0 -16 26 32 54 8 C82 -16 108 32 110 8" />
          <path d="M-110 56 C-82 32 -56 80 -28 56 C0 32 26 80 54 56 C82 32 108 80 110 56" />`,
  pin: `<path d="M0 100 C-50 40 -74 8 -74 -28 C-74 -70 -42 -98 0 -98 C42 -98 74 -70 74 -28 C74 8 50 40 0 100 Z" /><circle cx="0" cy="-30" r="26" />`,
  city: `<path d="M-100 90 L100 90" /><path d="M-84 90 L-84 -10 L-44 -10 L-44 90" /><path d="M-24 90 L-24 -80 L30 -80 L30 90" /><path d="M50 90 L50 10 L92 10 L92 90" /><path d="M-8 -56 L14 -56 M-8 -30 L14 -30 M-8 -4 L14 -4 M-8 22 L14 22" />`,
};

const products = [
  { file: "airport-to-city",  l1: "Airport to",     l2: "Barcelona City", sub: "EL PRAT  ·  T1 & T2",        icon: "plane" },
  { file: "city-to-airport",  l1: "Barcelona City", l2: "to Airport",     sub: "DOOR TO DOOR  ·  ON TIME",    icon: "car"   },
  { file: "per-hour",         l1: "Chauffeur",      l2: "By the Hour",    sub: "YOUR CAR  ·  YOUR SCHEDULE",  icon: "clock" },
  { file: "tossa-de-mar",     l1: "Airport to",     l2: "Tossa de Mar",   sub: "COSTA BRAVA",                 icon: "waves" },
  { file: "girona",           l1: "Airport to",     l2: "Girona",         sub: "PRIVATE TRANSFER",            icon: "city"  },
  { file: "lloret-de-mar",    l1: "Airport to",     l2: "Lloret de Mar",  sub: "COSTA BRAVA",                 icon: "waves" },
  { file: "sitges",           l1: "Airport to",     l2: "Sitges",         sub: "PRIVATE TRANSFER",            icon: "pin"   },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function tile({ l1, l2, sub, icon }) {
  const size = 1080;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="30%" r="70%">
      <stop offset="0" stop-color="#2a2110"/><stop offset="0.55" stop-color="#0d0b07"/><stop offset="1" stop-color="#050505"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <rect x="36" y="36" width="${size - 72}" height="${size - 72}" rx="28" fill="none" stroke="url(#gold)" stroke-width="3"/>
  <rect x="54" y="54" width="${size - 108}" height="${size - 108}" rx="18" fill="none" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="1.5"/>

  <text x="540" y="150" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" letter-spacing="12" fill="${GOLD}">ELITE BCN TRANSFER</text>
  <path d="M440 182 L640 182" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="2"/>

  <circle cx="540" cy="420" r="168" fill="none" stroke="url(#gold)" stroke-width="3"/>
  <circle cx="540" cy="420" r="150" fill="none" stroke="${GOLD}" stroke-opacity="0.25" stroke-width="1.5"/>
  <g transform="translate(540 420)" fill="none" stroke="url(#gold)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</g>

  <text x="540" y="722" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="82" fill="${BONE}">${esc(l1)}</text>
  <text x="540" y="816" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" fill="url(#gold)">${esc(l2)}</text>
  <text x="540" y="896" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" letter-spacing="9" fill="${BONE}" fill-opacity="0.8">${esc(sub)}</text>

  <path d="M300 950 L780 950" stroke="${GOLD}" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="540" y="996" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" letter-spacing="3" fill="${GOLD}">Elitebcn.info</text>
</svg>`;
}

for (const p of products) {
  const svg = tile(p);
  await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toFile(join(outDir, `${p.file}.jpg`));
  console.log("wrote", `public/whatsapp/${p.file}.jpg`);
}

// ── Profile photo: the supplied logo, cropped square ────────────────────────
// WhatsApp wants a square, at least 192 px, ideally 640. The supplied file has
// a thin black band along the top; the circle itself sits inside a square.
const logo = process.argv[2];
if (logo) {
  const m = await sharp(logo).metadata();
  const side = Math.min(m.width, m.height - 40);
  await sharp(logo)
    .extract({ left: Math.round((m.width - side) / 2), top: m.height - side, width: side, height: side })
    .resize(640, 640)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(join(brandDir, "whatsapp-profile.jpg"));
  console.log("wrote public/brand/whatsapp-profile.jpg");
}
