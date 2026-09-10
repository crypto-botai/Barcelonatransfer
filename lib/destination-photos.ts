/**
 * Destination photographs, and the credit each one legally requires.
 *
 * Every /transfers page rendered without a single image until now. These come
 * from Wikimedia Commons, and the licences are the reason this file exists
 * rather than a bare list of paths: CC BY and CC BY-SA both require the author
 * and the licence to be shown wherever the photograph is used. Displaying one
 * without its credit is a licence breach, so the credit travels with the
 * image — a component cannot render one without the other.
 *
 * Public-domain entries carry no obligation; the photographer is named anyway,
 * which costs nothing and is the decent thing to do.
 *
 * Self-hosted rather than hotlinked, in public/destinations, because Wikimedia
 * asks not to be used as a CDN. Each was resized to 1600px and recompressed
 * (9.9 MB of originals down to 3.1 MB).
 *
 * A slug with no entry here simply renders no photograph.
 */
export interface DestinationPhoto {
  src:     string;
  /** Describes the place, not the page — this is alt text, not a keyword slot. */
  alt:     string;
  author:  string;
  license: string;
  /** The Commons file page, which the licence requires be reachable. */
  source:  string;
}

export const DESTINATION_PHOTOS: Record<string, DestinationPhoto> = {
  "andorra": {
    src:     "/destinations/andorra.jpg",
    alt:     "Andorra la Vella in the Pyrenees, where the transfer from Barcelona ends",
    author:  "Tiia Monto",
    license: "CC BY-SA 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Andorra_la_Vella_-_footpath.jpg",
  },
  "begur": {
    src:     "/destinations/begur.jpg",
    alt:     "The cove at Aiguablava, Begur, on the Costa Brava",
    author:  "Joergsam",
    license: "CC BY-SA 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:ParadorDeAiguablava.jpg",
  },
  "cadaques": {
    src:     "/destinations/cadaques.jpg",
    alt:     "Whitewashed Cadaques on the Cap de Creus coast",
    author:  "Jaume Llorens",
    license: "CC BY 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Platja_Port_Lligat_Cadaques.jpg",
  },
  "castelldefels": {
    src:     "/destinations/castelldefels.jpg",
    alt:     "The beach at Castelldefels, twenty minutes from El Prat airport",
    author:  "Eva11975",
    license: "Public domain",
    source:  "https://commons.wikimedia.org/wiki/File:Castelldefels_September.JPG",
  },
  "figueres": {
    src:     "/destinations/figueres.jpg",
    alt:     "The Dali Theatre-Museum in Figueres",
    author:  "Olivier2000 (fr-wp) - Building by Salvador Dali",
    license: "CC BY-SA 2.5",
    source:  "https://commons.wikimedia.org/wiki/File:Museu_Dali_2.jpg",
  },
  "girona": {
    src:     "/destinations/girona.jpg",
    alt:     "The painted houses along the Onyar in Girona",
    author:  "Luidger (talk · contribs)",
    license: "CC BY-SA 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:20061227-Girona_MQ.jpg",
  },
  "lloret-de-mar": {
    src:     "/destinations/lloret-de-mar.jpg",
    alt:     "The main beach at Lloret de Mar on the Costa Brava",
    author:  "Alberto-g-rovi",
    license: "CC BY 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Playa_de_Lloret_de_Mar_(3).jpg",
  },
  "montserrat": {
    src:     "/destinations/montserrat.jpg",
    alt:     "The monastery of Montserrat below its serrated peaks",
    author:  "Tabalot",
    license: "Public domain",
    source:  "https://commons.wikimedia.org/wiki/File:StaCeciliaMontserrat.jpg",
  },
  "salou": {
    src:     "/destinations/salou.jpg",
    alt:     "The seafront at Salou on the Costa Daurada",
    author:  "Mickey Løgitmark",
    license: "CC BY 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Salou_7_-_panoramio.jpg",
  },
  "sitges": {
    src:     "/destinations/sitges.jpg",
    alt:     "Sitges seen from the water, the church of Sant Bartomeu above the shore",
    author:  "Laura Hadden from Olympia, WA",
    license: "CC BY 2.0",
    source:  "https://commons.wikimedia.org/wiki/File:Sitges_from_the_water.jpg",
  },
  "tarragona": {
    src:     "/destinations/tarragona.jpg",
    alt:     "The Roman amphitheatre at Tarragona above the Mediterranean",
    author:  "Bernard Gagnon",
    license: "CC BY-SA 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Amphitheatre_of_Tarragona_01.jpg",
  },
  "tossa-de-mar": {
    src:     "/destinations/tossa-de-mar.jpg",
    alt:     "The walled old town and castle at Tossa de Mar",
    author:  "МаратД",
    license: "CC BY-SA 3.0",
    source:  "https://commons.wikimedia.org/wiki/File:Tossa_de_Mar_castle_sea_view.JPG",
  },
};

export function destinationPhoto(slug: string): DestinationPhoto | null {
  return DESTINATION_PHOTOS[slug] ?? null;
}
