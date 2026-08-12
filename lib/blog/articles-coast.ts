import type { BlogArticle } from "./types";

export const COAST_ARTICLES: BlogArticle[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "things-to-do-in-sitges",
    photo: "/blog/things-to-do-in-sitges.jpg",
    credit: { author: "Werner Lang (Wela49)", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Sitges_-_Ansicht_4.jpg" },
    title: "Sitges: Beaches, Carnival and the Garraf Coast",
    excerpt:
      "Seventeen beaches, a whitewashed old town built around a sea-facing church, and the most theatrical carnival in Catalonia — all 35 km from Barcelona.",
    metaTitle: "Things to Do in Sitges — Beaches & Old Town | Elite BCN",
    metaDescription:
      "What to see and do in Sitges: the old town, 17 beaches, Cau Ferrat museum, Carnival and the Film Festival. Plus how to get there from Barcelona.",
    keywords: ["things to do in sitges", "sitges beaches", "sitges carnival", "sitges day trip from barcelona", "sitges old town"],
    category: "Destination",
    season: "Summer",
    publishedAt: "2026-07-27",
    updatedAt: "2026-07-27",
    accent: ["#2E86AB", "#F5C518"],
    motif: "coast",
    bookDestination: "Sitges",
    transferHref: "/transfers/sitges",
    priceZone: "sitges",
    distanceKm: 35,
    durationMin: 35,
    body: [
      { type: "p", text: "Sitges sits on the Garraf coast about 35 kilometres southwest of Barcelona, close enough for a morning departure and far enough that the city drops away completely. The approach is part of the appeal: the road runs between the Garraf massif and the Mediterranean, limestone hills on one side and open water on the other, before the town appears as a cluster of white buildings around a church on a rocky promontory." },
      { type: "p", text: "It is a small town with an outsized personality. Sitges has been an artists' colony, a fishing port, a Bacardí family hometown, and for decades one of the most openly welcoming resorts in southern Europe. All of those layers are still visible if you walk it properly." },

      { type: "h2", text: "Why Sitges is worth the trip" },
      { type: "p", text: "Plenty of towns along this coast have good beaches. What Sitges has that most do not is a genuine old quarter that was never flattened and rebuilt during the tourism boom. The narrow streets behind the seafront are still the original street plan, and the buildings around them belonged to *americanos* — Catalans who made money in Cuba and the Americas in the nineteenth century and came home to build extravagant houses with it." },
      { type: "p", text: "The result is a town where you can spend the morning in a museum full of wrought iron and modernist painting, the afternoon on sand, and the evening at a restaurant table twenty metres from the water. Very few places compress that range into a walkable centre." },

      { type: "h2", text: "What to do in Sitges" },

      { type: "h3", text: "The old town and the church of Sant Bartomeu" },
      { type: "p", text: "Start at the church. Sant Bartomeu i Santa Tecla stands on a rock above the sea and is the image that appears on every postcard of the town, but the reason to climb up to it is the view back down: the curve of the beaches on one side, the marina on the other, and the terracotta roofs of the old quarter behind. It takes ten minutes and orients you for everything else." },
      { type: "p", text: "From there, walk down into the lanes behind. They are narrow, whitewashed, hung with bougainvillea, and almost entirely free of traffic. This is where the town feels least like a resort and most like an ordinary Catalan coastal settlement that happens to be extremely good looking." },

      { type: "h3", text: "The beaches" },
      { type: "p", text: "Sitges has seventeen beaches spread over roughly four kilometres of coast, which means the character changes considerably depending on where you stop." },

      { type: "h4", text: "Platja de la Ribera and Platja de Sant Sebastià" },
      { type: "p", text: "These are the central beaches, immediately below the promenade. Ribera is the wide, busy one with the full run of loungers and beach bars behind it. Sant Sebastià, tucked on the other side of the church headland, is smaller, quieter and more popular with local families. If you are visiting with children, Sant Sebastià is the better choice." },

      { type: "h4", text: "The quieter beaches further out" },
      { type: "p", text: "Walk southwest along the promenade and the crowds thin quickly. Beaches like Terramar and Les Anquines are longer, less developed and considerably calmer even in August. It is a fifteen to twenty-five minute walk from the centre, which is enough to deter most day visitors." },

      { type: "h3", text: "Museums worth an hour" },
      { type: "p", text: "Cau Ferrat was the home and studio of the painter Santiago Rusiñol, a central figure in Catalan modernism, and he filled it with ironwork, ceramics, glass and paintings — including work by El Greco. Next door, Palau Maricel is a sequence of rooms and terraces built into the cliff with sea views through the arches. The two connect, and together they take about ninety minutes." },
      { type: "p", text: "There is also Casa Bacardí, in the old market building, which traces the story of Facundo Bacardí — born in Sitges, emigrated to Cuba, founded the rum company. It is more entertaining than it sounds and ends with a cocktail." },

      { type: "h2", text: "When to visit" },

      { type: "h3", text: "Carnival, in February" },
      { type: "p", text: "Sitges Carnival is one of the largest and most flamboyant in Spain. It runs for about a week before Lent and centres on two enormous night parades, with elaborate floats, choreographed groups and a town that does not sleep. If you want the spectacle, this is the week. If you want a quiet weekend by the sea, choose almost any other week of the year." },

      { type: "h3", text: "High summer" },
      { type: "p", text: "July and August bring the reliable Mediterranean pattern: hot, dry days, warm sea, and a town operating at full capacity. Book restaurants and accommodation well ahead. Arrive in the morning if you want a good spot on the central beaches." },

      { type: "h3", text: "October and the Film Festival" },
      { type: "p", text: "The Sitges Film Festival specialises in fantasy and horror cinema and has become one of the most respected genre festivals anywhere. It fills the town in October, when the weather is still mild and the sea is still swimmable. For many people this is the best compromise between atmosphere and comfort." },

      { type: "h4", text: "The quietest months" },
      { type: "p", text: "May, June and late September are the sweet spot. The sea is warm enough, the terraces are open, and you can walk the old town without queueing." },

      { type: "h2", text: "Eating and drinking" },
      { type: "p", text: "Sitges is a seafood town. *Xató* is the local dish worth seeking out — a salad of endive, salt cod, tuna and anchovies dressed with a rich almond and hazelnut sauce, closer to romesco than to anything you would call a salad elsewhere. It is a winter dish traditionally, but many restaurants serve it year round." },
      { type: "p", text: "The Garraf region also produces Malvasia, a sweet white wine with a long history in the town. It is not widely exported, so this is the place to try it." },

      { type: "h5", text: "Practical tip" },
      { type: "p", text: "The restaurants directly on the seafront promenade charge a premium for the view. Walk two streets back into the old town and both the prices and, generally, the cooking improve." },

      { type: "h2", text: "Getting to Sitges from Barcelona" },
      { type: "p", text: "Sitges is roughly 35 kilometres from Barcelona city and around the same from El Prat Airport. By car the journey is about 35 minutes on the C-32, which runs through a series of tunnels under the Garraf hills." },
      { type: "p", text: "Trains run from Barcelona Sants and Passeig de Gràcia and take between 40 and 50 minutes, but you need to get to the station first, and the walk from Sitges station down to the seafront is about ten minutes. With luggage, beach equipment or small children, a door-to-door private transfer removes three separate transitions from the day." },

      { type: "callout", title: "Planning a day trip?", text: "A private transfer takes you from your Barcelona hotel or the airport directly to the address you name in Sitges, with a fixed price agreed before you travel and no meter running while you sit in summer traffic on the C-32." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "tossa-de-mar-guide",
    photo: "/blog/tossa-de-mar-guide.jpg",
    credit: { author: "Unknown", licence: "CC BY-SA 2.5", source: "https://commons.wikimedia.org/wiki/File:Tossa_de_Mar_Torre%C3%B3n_JMM.JPG" },
    title: "Tossa de Mar: The Walled Town on the Costa Brava",
    excerpt:
      "A twelfth-century fortress standing directly in the sea, three beaches inside the town, and the cleanest water within easy reach of Barcelona.",
    metaTitle: "Tossa de Mar Guide — Castle, Beaches & Coves | Elite BCN",
    metaDescription:
      "A guide to Tossa de Mar: the walled Vila Vella, the main beach and hidden coves, coastal walks, and how to reach it from Barcelona.",
    keywords: ["things to do in tossa de mar", "tossa de mar", "tossa de mar beaches", "vila vella tossa", "costa brava towns", "barcelona to tossa de mar"],
    category: "Destination",
    season: "Summer",
    publishedAt: "2026-07-27",
    updatedAt: "2026-07-27",
    accent: ["#1B998B", "#E4B363"],
    motif: "coast",
    bookDestination: "Tossa de Mar",
    transferHref: "/transfers/costa-brava",
    priceZone: "tossa",
    distanceKm: 90,
    durationMin: 75,
    body: [
      { type: "p", text: "Most of the Costa Brava's medieval architecture sits inland, safely back from a coast that spent centuries being raided. Tossa de Mar is the exception. Its fortified old town, the Vila Vella, was built on a headland that drops straight into the water, and it is the only fully walled medieval settlement still standing on the entire Catalan coast." },
      { type: "p", text: "That single fact is why Tossa looks different from every other resort on this stretch. You approach along the coast road, come around a bend, and there are stone towers rising out of the sea above a curved beach." },

      { type: "h2", text: "Things to do in Tossa de Mar" },
      { type: "ul", items: [
        "Climb through the walled Vila Vella to the lighthouse",
        "Swim at Platja Gran beneath the medieval towers",
        "Snorkel the rocks off Mar Menuda",
        "Walk a stretch of the GR 92 coast path toward Sant Feliu",
        "Take a glass-bottomed boat to the roadless coves",
        "Eat cim i tomba, the local fishermen's stew, in the old town",
      ]},
      { type: "p", text: "Each of these is covered in detail below." },

      { type: "h2", text: "The Vila Vella" },
      { type: "p", text: "The walls date from the twelfth century and were built against pirate raids from North Africa, which were a genuine and recurring threat on this coast well into the sixteenth century. Three of the original towers survive, along with most of the curtain wall." },
      { type: "p", text: "Inside, the old town is a small grid of cobbled lanes, mostly given over now to restaurants and small shops but still recognisably medieval in scale. Walk up through it to the lighthouse at the top of the headland." },

      { type: "h3", text: "The view from the top" },
      { type: "p", text: "From the lighthouse terrace you get the whole geography at once: the main beach curving away to the north, the rocky coves to the south, and on a clear day a long stretch of the Costa Brava disappearing into haze. It is a fifteen-minute climb from the beach and it is the reason most people remember Tossa." },

      { type: "h4", text: "Go early or late" },
      { type: "p", text: "The Vila Vella is compact, and between about 11am and 5pm in August it is genuinely crowded. Early morning and the hour before sunset are dramatically better, and the light on the stone is much better too." },

      { type: "h2", text: "The beaches" },

      { type: "h3", text: "Platja Gran" },
      { type: "p", text: "The main beach sits directly below the walls — a wide arc of coarse golden sand about 400 metres long, with the old town at one end and the modern town behind. It is the busiest beach and the most photographed, because of what is standing above it." },

      { type: "h3", text: "Es Codolar and Mar Menuda" },
      { type: "p", text: "Es Codolar is the small pebble cove on the far side of the headland, reached by walking through the old town and down. It is quieter, more sheltered, and the water is noticeably clearer. Mar Menuda, at the northern end, is the local favourite — a calm bay popular with families and, because of the rock formations just offshore, one of the better snorkelling spots on this part of the coast." },

      { type: "h4", text: "The coves further out" },
      { type: "p", text: "The coastline either side of Tossa is a sequence of small rocky inlets, most of them reachable only on foot along the coastal path or by boat. Cala Bona and Cala Pola, both a short drive north, are the easiest of these to reach and are considerably quieter than anything in town." },

      { type: "h2", text: "Walking the coast path" },
      { type: "p", text: "The GR 92 long-distance path runs along this coast, and the section between Tossa and Sant Feliu de Guíxols is one of the most spectacular stretches of it. You do not need to do the whole thing: even an hour out and back along the cliffs north of Mar Menuda gets you into pine woods above empty coves." },
      { type: "p", text: "Wear proper shoes. The path is well marked but genuinely rocky in places, and there is very little shade in the middle of the day." },

      { type: "h2", text: "When to go" },
      { type: "p", text: "Tossa is a summer town, and a large proportion of its restaurants and hotels close between roughly November and March. That makes June and September the best months to visit: the sea is warm, everything is open, and the streets are not full." },

      { type: "h5", text: "A note on August" },
      { type: "p", text: "August is the busiest month by a wide margin, and parking in Tossa is genuinely difficult — the town sits in a bowl with limited access roads. If you are visiting in August, being dropped off and collected is worth considerably more than it costs." },

      { type: "h2", text: "Eating in Tossa" },
      { type: "p", text: "The local speciality is *cim i tomba*, a fisherman's stew of white fish and potatoes in a garlic and saffron broth, traditionally made with whatever came up in the nets. Several restaurants in the old town make it properly. Beyond that, expect grilled fish, rice dishes and reasonable prices by Costa Brava standards." },

      { type: "h2", text: "Tossa and the artists" },
      { type: "p", text: "In the 1930s Tossa attracted a colony of European painters — Marc Chagall came and called it a *blue paradise* — and the municipal museum in the old town holds work from that period, including a Chagall. It was the first museum of contemporary art in Catalonia when it opened in 1935." },
      { type: "p", text: "Two decades later the town got its second dose of fame when *Pandora and the Flying Dutchman* was filmed here with Ava Gardner. There is a bronze statue of her on the walls looking out to sea, which is either charming or slightly odd depending on your view of statues of film stars on medieval fortifications." },

      { type: "h3", text: "Boat trips" },
      { type: "p", text: "Glass-bottomed boats run along the coast from the main beach in season, linking Tossa with Lloret, Sant Feliu and Blanes. They are the easiest way to see the coves that have no road access, and the hour-long round trip toward Sant Feliu passes some of the most dramatic cliff scenery on the coast." },

      { type: "h2", text: "Getting to Tossa de Mar from Barcelona" },
      { type: "p", text: "Tossa is about 90 kilometres north of Barcelona. The fast route follows the AP-7 motorway and then cuts across to the coast — roughly 75 minutes door to door." },
      { type: "p", text: "There is a slower alternative worth knowing about: the coast road from Lloret de Mar, the GI-682, is one of the great drives in Catalonia, a genuinely twisting corniche that hangs above the sea for its entire length. It adds about twenty minutes and it is worth every one of them if the weather is clear." },
      { type: "p", text: "There is no train to Tossa — the railway does not reach this part of the coast. The options are a bus connection via Lloret or Blanes, driving, or a private transfer." },

      { type: "callout", title: "Ask for the coast road", text: "If you book a private transfer to Tossa, tell your driver you would like to come in along the coast from Lloret rather than the direct road. It costs nothing extra and the last twenty minutes of the journey become part of the trip rather than a means of getting there." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "lloret-de-mar-beyond-the-nightlife",
    photo: "/blog/lloret-de-mar-beyond-the-nightlife.jpg",
    credit: { author: "Victor Gleim", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lloret_de_Mar_-_Panorama_of_main_beach.jpg" },
    title: "Lloret de Mar Beyond the Nightlife",
    excerpt:
      "The Costa Brava's best-known resort has a cliffside modernist garden, a medieval castle and a string of quiet coves that most visitors never find.",
    metaTitle: "Lloret de Mar Guide — Gardens, Beaches & Coves | Elite BCN",
    metaDescription:
      "What to do in Lloret de Mar besides the nightlife: Santa Clotilde gardens, Sant Joan castle, the quieter coves, and how to get there from Barcelona.",
    keywords: ["things to do in lloret de mar", "lloret de mar", "santa clotilde gardens", "lloret beaches", "barcelona to lloret de mar"],
    category: "Destination",
    season: "Summer",
    publishedAt: "2026-07-27",
    updatedAt: "2026-07-27",
    accent: ["#4A7C59", "#F2A65A"],
    motif: "coast",
    bookDestination: "Lloret de Mar",
    transferHref: "/transfers/lloret-de-mar",
    priceZone: "lloret",
    distanceKm: 75,
    durationMin: 65,
    body: [
      { type: "p", text: "Lloret de Mar has a reputation, and the reputation is not entirely unearned — the town has one of the densest concentrations of clubs and late bars anywhere on the Spanish coast, and in July and August a specific kind of visitor comes specifically for that." },
      { type: "p", text: "What gets lost is that Lloret was a serious maritime town long before it was a resort, that it has one of the finest gardens in Catalonia, and that within a twenty-minute walk of the main beach there are coves where you can swim more or less alone. The nightlife is concentrated in a few streets. Everything else is somewhere else." },

      { type: "h2", text: "Things to do in Lloret de Mar" },
      { type: "ul", items: [
        "Walk the clifftop Santa Clotilde Gardens in the morning light",
        "Follow the Camí de Ronda coast path to Cala Banys",
        "Climb to the Castell de Sant Joan between the two bays",
        "Spend the beach day at Fenals or Santa Cristina rather than the main strip",
        "Visit the Museu del Mar for the town's Cuba-trade history",
        "Kayak south along the cliffs from the main beach",
      ]},
      { type: "p", text: "The sections below take each of these in turn." },

      { type: "h2", text: "The Santa Clotilde Gardens" },
      { type: "p", text: "This is the single best reason to come to Lloret. The Jardins de Santa Clotilde were laid out in 1919 in the Italian Renaissance style, on a cliff about sixty metres above the sea, and they are one of the most complete examples of *noucentista* landscape design in Catalonia." },
      { type: "p", text: "The design is deliberate: staircases, cypress avenues and stone balustrades all funnel your view toward framed openings onto the Mediterranean. It is a garden built around the sea rather than merely overlooking it. Allow an hour, and go in the morning when the light comes off the water." },

      { type: "h3", text: "Getting there" },
      { type: "p", text: "The gardens sit between Lloret and Fenals, about a twenty-five minute walk from the centre along the coast, or a very short drive. There is limited parking at the entrance." },

      { type: "h2", text: "The castle and the coastal path" },

      { type: "h3", text: "Castell de Sant Joan" },
      { type: "p", text: "The eleventh-century watchtower on the headland between Lloret and Fenals beaches was built as part of the same anti-piracy defensive network that produced Tossa's walls. What survives is partly restored, but the position is the point — it looks down over both bays at once." },

      { type: "h3", text: "The Camí de Ronda" },
      { type: "p", text: "The old coastguard path runs along the cliffs and links the beaches. The section from Lloret's main beach south to Cala Banys and on toward Fenals takes under an hour and delivers you to a handful of small rocky coves along the way. This is where the town stops feeling like a resort." },

      { type: "h4", text: "Cala Banys" },
      { type: "p", text: "A rocky inlet about ten minutes from the main beach, with a terrace bar built into the cliff above it. Not a sand beach — you swim off rocks — but the water is clear and the setting is much better than anything on the main strip." },

      { type: "h2", text: "The beaches" },
      { type: "p", text: "Platja de Lloret is the long central beach, about 1.6 kilometres of coarse sand backed by the promenade. It is well equipped and, in season, extremely busy." },
      { type: "p", text: "Platja de Fenals, the next bay south, is shorter, backed by pine woods and consistently calmer — the better option for a full day on the sand. Beyond that, Santa Cristina and Cala Treumal are smaller, prettier, and require either a walk or a short drive." },

      { type: "h5", text: "For families" },
      { type: "p", text: "Fenals and Santa Cristina are the two to aim for. Both shelve gently, both are sheltered from the prevailing wind, and neither has the through-traffic of the main beach." },

      { type: "h2", text: "The maritime history" },
      { type: "p", text: "In the nineteenth century Lloret sent a substantial share of its male population to Cuba and the Americas, and the ones who came back rich built the cemetery, the gardens and several of the grander houses. The Museu del Mar, in a restored *americano* house on the seafront, tells this story and is a genuinely good small museum — an hour well spent on an overcast day." },

      { type: "h2", text: "The modernist cemetery" },
      { type: "p", text: "An unlikely highlight, and one almost no visitor sees. When the *americanos* came home from Cuba they commissioned mausoleums from the leading modernist architects of the day, including Puig i Cadafalch, who worked alongside Gaudí on some of Barcelona's best-known buildings." },
      { type: "p", text: "The result is a hillside cemetery full of art nouveau funerary architecture — angels, mosaics, wrought iron and sinuous stone — that would be a major attraction anywhere else. It sits above the town and is open to visitors." },

      { type: "h2", text: "For families and active days" },
      { type: "p", text: "Water World, on the edge of town, is one of the larger water parks on this coast and a reliable option on a day when the beach is too windy. The bay itself is well set up for paddleboarding and kayaking, with rental operators on the main beach, and kayaking south along the cliffs toward Cala Banys is a genuinely good way to see the coves." },

      { type: "h5", text: "About the nightlife" },
      { type: "p", text: "It is worth being straightforward: the club district is concentrated around a few streets inland from the main beach, and in July and August it is loud until roughly six in the morning. If you are staying overnight and that is not what you came for, choose accommodation in Fenals or at the southern end of the seafront rather than in the centre." },

      { type: "h2", text: "When to visit" },
      { type: "p", text: "The character of Lloret changes more between seasons than almost any other town on this coast." },
      { type: "p", text: "June and September are the best months: warm sea, everything open, and a fraction of the crowds. July and August are peak season in every sense. From November to March a large part of the town closes down, though the gardens and the coastal paths remain, and the coast in winter has a stark quality that is worth seeing." },

      { type: "h2", text: "Getting to Lloret de Mar from Barcelona" },
      { type: "p", text: "Lloret is about 75 kilometres northeast of Barcelona, roughly 65 minutes by road on the AP-7 and C-32. Like Tossa, it has no railway station — the nearest is Blanes, and you would need a connecting bus from there." },
      { type: "p", text: "Coaches run from Barcelona Nord bus station and take around 80 to 90 minutes plus the time to reach the station. For a group, or with luggage, a direct transfer is usually both faster and simpler." },

      { type: "callout", title: "Combine two towns in one day", text: "Lloret and Tossa are twenty minutes apart along one of the best coastal roads in Catalonia. A private transfer with a wait makes it straightforward to see the Santa Clotilde gardens in the morning and Tossa's walled town in the late afternoon." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "cadaques-and-dali",
    photo: "/blog/cadaques-and-dali.jpg",
    credit: { author: "Anthiro 57", licence: "CC BY-SA 3.0 es", source: "https://commons.wikimedia.org/wiki/File:Cadaques_Pueblo_Marinero.JPG" },
    title: "Cadaqués and the Dalí Coast",
    excerpt:
      "A whitewashed village at the end of a mountain road, the surrealist's house at Portlligat, and the raw geology of Cap de Creus.",
    metaTitle: "Cadaqués & Dalí Guide — Portlligat, Cap de Creus | Elite BCN",
    metaDescription:
      "Visiting Cadaqués: Dalí's house at Portlligat, the old town, Cap de Creus natural park, and how to reach this remote Costa Brava village.",
    keywords: ["things to do in cadaques", "cadaques", "dali house portlligat", "cap de creus", "cadaques from barcelona", "costa brava dali"],
    category: "Destination",
    season: "All year",
    publishedAt: "2026-07-27",
    updatedAt: "2026-07-27",
    accent: ["#3D5A80", "#EE9B00"],
    motif: "coast",
    bookDestination: "Cadaques",
    transferHref: "/transfers/cadaques",
    priceZone: "cadaques",
    distanceKm: 170,
    durationMin: 135,
    body: [
      { type: "p", text: "Cadaqués is difficult to reach, and that is the whole reason it survived. The only road in crosses the Serra de Rodes on a series of switchbacks that discourage coaches and casual traffic, and the village on the other side was never developed the way the rest of the Costa Brava was. What you get is a bay ringed by white houses, black slate streets, and a light that a long line of painters came here specifically to work in." },

      { type: "h2", text: "Dalí's house at Portlligat" },
      { type: "p", text: "Salvador Dalí lived and worked in the neighbouring cove of Portlligat for most of his adult life, expanding a single fisherman's hut into a rambling connected house over four decades. It is now a museum, and it is the most revealing of the three Dalí sites in the region." },
      { type: "p", text: "Unlike the theatrical museum at Figueres, Portlligat is domestic. You see the studio with the easel he could raise and lower through a slot in the floor, the library, the oval room built for his wife Gala, and the garden with its swimming pool and improbable ornaments. It explains the paintings better than the paintings do." },

      { type: "h3", text: "Booking ahead is essential" },
      { type: "p", text: "Entry is by timed slot with a strict limit on numbers, because the rooms are small. In summer, slots go weeks in advance. This is not a place you can turn up to and hope." },

      { type: "h4", text: "How long you need" },
      { type: "p", text: "The guided route through the house takes about fifty minutes, plus time in the garden. Portlligat itself is a fifteen-minute walk over the hill from Cadaqués, or a two-minute drive." },

      { type: "h2", text: "The village itself" },
      { type: "p", text: "Cadaqués rewards aimless walking more than a checklist. The old town rises from the waterfront in a tangle of stepped lanes paved with *rastell* — dark slate set on edge — up to the church of Santa Maria at the top." },

      { type: "h3", text: "The church of Santa Maria" },
      { type: "p", text: "Plain from the outside, and then you go in and find an enormous gilded baroque altarpiece filling the entire east end, wildly out of proportion to the modest building around it. It is one of the more surprising interiors on the Catalan coast." },

      { type: "h3", text: "The waterfront" },
      { type: "p", text: "The bay is lined with cafés and there is a statue of Dalí looking out over it. Swimming in the bay is possible but the beaches are small and pebbly; most people swim from the rocks or take a boat out to the coves." },

      { type: "h2", text: "Cap de Creus" },
      { type: "p", text: "The headland east of the village is the easternmost point of mainland Spain and the first natural park in Catalonia to protect both land and sea. It is geologically strange country — folded, twisted schist that has been worked by the tramuntana wind into forms that look deliberately sculpted." },
      { type: "p", text: "Dalí said the landscape here was the direct source of the melting shapes in his work, and standing on it, that is entirely believable." },

      { type: "h3", text: "What to do there" },
      { type: "p", text: "There is a lighthouse at the tip with a restaurant beside it and parking nearby, so the headland is accessible without a serious hike. Marked trails run from the lighthouse in several directions, and even a short one gets you into landscape that feels genuinely remote." },

      { type: "h4", text: "The tramuntana" },
      { type: "p", text: "The north wind that funnels down from the Pyrenees onto this coast can be extremely strong, particularly in winter and spring. It is not dangerous but it will define your day. Check the forecast, and take a windproof layer even in warm weather." },

      { type: "h5", text: "Best light" },
      { type: "p", text: "Late afternoon, when the low sun rakes across the folded rock and the whole headland turns copper. Photographers plan whole trips around this." },

      { type: "h2", text: "Swimming and boat trips" },
      { type: "p", text: "The bay in front of the village is small and pebbly, and most swimming happens either off the rocks or at Platja Gran, the main town beach. The better water is out along the coast: a string of coves north and south of the village, most of them accessible only from the sea." },
      { type: "p", text: "Boat operators run from the harbour in season, including trips around the Cap de Creus headland to the Cova de s'Infern and the sea caves on the far side. The kayak rental in the bay is the other good option — the coastline immediately north of Portlligat is protected, shallow and exceptionally clear." },

      { type: "h2", text: "Eating in Cadaqués" },
      { type: "p", text: "This is anchovy country. The nearby town of L'Escala is the centre of the Catalan salted-anchovy trade and the quality on menus here is a considerable step up from what the word usually implies. Order them plainly, on bread with tomato, and you will understand why they have their own designation of origin." },
      { type: "p", text: "Beyond that: *suquet de peix*, the local fish and potato stew, and sea urchins in winter, which are a genuine delicacy on this stretch of coast and appear on menus from roughly December to March." },

      { type: "h5", text: "Booking a table" },
      { type: "p", text: "The village has a limited number of restaurants and a large number of summer visitors. In July and August, reserve. On the terraces overlooking the bay, reserve well ahead." },

      { type: "h2", text: "When to visit" },
      { type: "p", text: "May, June, September and early October are ideal — warm, clear, and without the August congestion on a road that genuinely cannot handle it." },
      { type: "p", text: "Winter is a real option here in a way it is not in most Costa Brava towns. Cadaqués has a permanent population and stays open, and the combination of empty streets, hard winter light and an angry sea is memorable. Bring warm clothes for the wind." },

      { type: "h2", text: "Getting to Cadaqués from Barcelona" },
      { type: "p", text: "Cadaqués is about 170 kilometres from Barcelona: roughly two hours on the AP-7 towards Figueres, then a final thirty to forty minutes over the mountain road. There is no railway and the bus connections require a change at Figueres." },
      { type: "p", text: "The final stretch is the reason many people choose to be driven. It is narrow, steeply banked and busy with oncoming traffic in summer, and it is far more enjoyable as a passenger than behind the wheel." },

      { type: "callout", title: "Make it a full day", text: "Cadaqués pairs naturally with the Dalí Theatre-Museum in Figueres, which is directly on the route back. A private transfer with waiting time lets you do the house at Portlligat in the morning and Figueres in the afternoon without watching the clock for a return bus." },
    ],
  },
];
