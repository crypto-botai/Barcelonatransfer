import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company-facts";

// POST /api/ai/seed — one-time initialisation of KB entries, budget config, and agents
// Secured by CRON_SECRET or ADMIN_SEED_SECRET
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SEED_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  try {

  // 1. Budget config
  const budgetExists = await prisma.aiBudgetConfig.findFirst();
  if (!budgetExists) {
    await prisma.aiBudgetConfig.create({
      data: {
        globalMonthlyBudgetCents: 2000,
        globalKillSwitch: false,
        alertEmail: process.env.ADMIN_EMAIL ?? "${COMPANY.email}",
      },
    });
    results.budgetConfig = 1;
  }

  // 2. Agent records
  // Add new agents here to have them appear in the HQ dashboard.
  const agentDefs = [
    { name: "support",      description: "Customer support chat — auto-replies to visitor questions using the knowledge base." },
    { name: "booking",      description: "Booking intelligence — scores leads, auto-confirms paid bookings, alerts admin." },
    { name: "orchestrator", description: "Master orchestrator — coordinates all agents on the daily cron schedule." },
    { name: "health",       description: "Website health — checks all key pages for uptime and response time daily." },
    { name: "seo",          description: "SEO monitor — weekly scan of all pages for metadata and content improvements." },
    { name: "analytics",    description: "Analytics agent — surfaces revenue, conversion, and booking trend insights." },
    { name: "marketing",    description: "Marketing & Growth — drafts social posts, newsletters, and campaigns for admin approval." },
    { name: "knowledge",    description: "Knowledge Manager — mines chat logs to keep the AI knowledge base accurate and complete." },
  ];

  let agentsCreated = 0;
  for (const def of agentDefs) {
    await prisma.aiAgent.upsert({
      where:  { name: def.name },
      update: { description: def.description, status: "IDLE", isEnabled: true },
      create: { ...def, status: "IDLE", isEnabled: true },
    });
    agentsCreated++;
  }
  results.agents = agentsCreated;

  // 3. Knowledge base
  const kbEntries = [
    // Pricing
    { category: "pricing", question: "How much is a transfer from Barcelona Airport to the city centre?", answer: "Yes, this is our most common journey — Barcelona Airport, Terminal 1 or Terminal 2, to any city address. The price is fixed per vehicle with no surge pricing, and the current figures are in the live pricing list. Meet & greet in arrivals and 60 minutes of free waiting from landing are included.", tags: ["airport", "price", "city"] },
    { category: "pricing", question: "What is the price to Sitges from Barcelona?", answer: "Yes. Sitges is about 35 minutes from Barcelona Airport and the fare is fixed per vehicle, the same whether you travel from the airport or from the city. Larger vehicles cost more than a sedan; the current figures are in the live pricing list. Prices exclude VAT and tolls.", tags: ["sitges", "price"] },
    { category: "pricing", question: "How much is a transfer from the airport to Montserrat?", answer: "Yes. A private transfer from Barcelona Airport to the monastery at Montserrat takes approximately 50 minutes, and the price is fixed per vehicle. The current fare is in the live pricing list.", tags: ["montserrat", "price"] },
    { category: "pricing", question: "What is the price to Andorra from Barcelona?", answer: "Yes, we drive Barcelona and BCN Airport to Andorra la Vella, Encamp and the other parishes, all at the same fixed fare. The journey is around three hours. The ski stations — Grandvalira, Pas de la Casa, Vallnord — sit further up the valley and are quoted by distance rather than at the Andorra fare. Current prices are in the live pricing list.", tags: ["andorra", "price"] },
    { category: "pricing", question: "Do you offer hourly hire?", answer: "Yes. Hourly hire books the car and driver for a block of time rather than a single journey, with a four-hour minimum. It suits city tours, a day of meetings, or shopping trips where you want the same driver waiting between stops. Rates depend on the vehicle and are shown live on elitebcn.info/hourly. A 20% night surcharge applies to hourly hire between 22:00 and 06:00; fixed-price transfers have none.", tags: ["hourly", "hire", "price"] },
    { category: "pricing", question: "Are there any extra charges or hidden fees?", answer: "Our fixed fare covers the professional chauffeur, luxury vehicle, fuel, meet & greet, and up to 60 minutes free waiting after landing. Two things are NOT included: VAT and motorway tolls. Spanish VAT at 10% is added only if you request an invoice, and tolls are charged separately on routes that use toll motorways. Beyond that there is no surge pricing and no hidden fees.", tags: ["fees", "hidden", "vat"] },
    { category: "pricing", question: "What is the price to Tarragona?", answer: "Yes. Tarragona is about an hour from Barcelona or the airport, and the fare is fixed per vehicle. The same journey covers Salou, La Pineda and PortAventura. Current prices are in the live pricing list.", tags: ["tarragona", "price"] },

    // Fleet
    { category: "fleet", question: "What vehicles do you have?", answer: "Our fleet includes:\n- **EQE 300 Electric** — Mercedes EQE 300 (up to 4 pax, 100% electric)\n- **Tesla Model 3** — electric VIP sedan (up to 4 pax)\n- **V-Class VIP** — Mercedes V-Class (up to 7 pax)\n- **Vito** — Mercedes Vito (up to 8 pax)\n- **Minibus** — Mercedes Sprinter (up to 16 pax)\n\nAll vehicles are immaculate and never older than 3 years.", tags: ["fleet", "vehicles", "car"] },
    { category: "fleet", question: "Do you have child seats?", answer: "Yes. Baby seats and child booster seats are available free of charge. Please mention this when booking under Special Requests.", tags: ["child seat", "baby", "kids"] },
    { category: "fleet", question: "Do you have wheelchair-accessible vehicles?", answer: "Please contact us directly via WhatsApp (+34 635 383 712) or email (${COMPANY.email}) for accessibility requirements — we'll arrange the right vehicle for your needs.", tags: ["wheelchair", "accessibility"] },

    // Booking
    { category: "booking", question: "How do I book a transfer?", answer: "You can book instantly at **elitebcn.info/book** — takes about 2 minutes. Choose your route, date, time, and vehicle. You'll receive a confirmation email immediately.", tags: ["book", "how", "reservation"] },
    { category: "booking", question: "How far in advance should I book?", answer: "We recommend booking at least **4 hours** before your pickup to get the standard price. Bookings made with less than 4 hours notice carry a 15% last-minute surcharge. We cannot accept bookings with less than 1 hour notice.", tags: ["advance", "booking time", "last minute"] },
    { category: "booking", question: "Can I cancel my booking?", answer: "Yes. Free cancellation is available if you cancel more than **24 hours before pickup**. Cancellations within 24 hours of pickup are non-refundable. You can cancel from your dashboard or contact us via WhatsApp.", tags: ["cancel", "refund", "policy"] },
    { category: "booking", question: "Can I change my pickup address?", answer: "Yes. Pickup address changes are free if made more than **8 hours before pickup**. Changes within 8 hours must be arranged via WhatsApp at +34 635 383 712.", tags: ["change", "pickup", "address", "edit"] },
    { category: "booking", question: "What payment methods do you accept?", answer: "We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely through SumUp. Payment is taken at the time of booking.", tags: ["payment", "card", "visa", "mastercard"] },
    { category: "booking", question: "Do I get a confirmation?", answer: "Yes. You'll receive a booking confirmation email immediately with your booking code, route details, and pickup instructions.", tags: ["confirmation", "email", "code"] },

    // Airport
    { category: "airport", question: "Where do you pick up at Barcelona Airport?", answer: "We meet you at the **Arrivals hall** of your terminal (T1 or T2) with a name board. Your driver will be there waiting when you land — no need to call or look for us.", tags: ["airport", "pickup", "arrivals", "meet greet"] },
    { category: "airport", question: "What if my flight is delayed?", answer: "We monitor all flights in real-time. Your driver will automatically adjust to your actual landing time at no extra cost. The first **60 minutes of waiting** after landing are always free.", tags: ["flight delay", "monitoring", "wait"] },
    { category: "airport", question: "Which Barcelona airport do you serve?", answer: "We serve **Barcelona El Prat Airport (BCN)**, both Terminal 1 (T1) and Terminal 2 (T2), plus **Girona Airport (GRO)** and **Reus Airport (REU)**. Every destination is priced instantly on the website: listed routes use our fixed table, and anywhere else is quoted automatically by distance. You never have to wait for a quote.", tags: ["airport", "terminal", "BCN", "T1", "T2", "GRO", "REU"] },

    // Service
    { category: "service", question: "Are you available 24/7?", answer: "Yes. We operate **24 hours a day, 7 days a week**, 365 days a year — including public holidays and Christmas.", tags: ["24/7", "hours", "available"] },
    { category: "service", question: "Do your drivers speak English?", answer: "Yes. All our drivers speak English. We also have drivers available in Spanish and Catalan.", tags: ["english", "language", "drivers"] },
    { category: "service", question: "Is Wi-Fi available in the vehicle?", answer: "Many of our vehicles offer complimentary Wi-Fi. Please mention this preference when booking and we'll do our best to assign you a vehicle with Wi-Fi.", tags: ["wifi", "internet"] },
    { category: "service", question: "Do you offer transfers from the cruise port?", answer: "Yes. We serve every Barcelona cruise terminal — the World Trade Centre quays and Moll Adossat. Tell us the ship and terminal when booking and the driver meets you at that quay. Fares are fixed per vehicle and differ slightly between an airport pickup and a city hotel; both are in the live pricing list.", tags: ["cruise", "port", "terminal"] },

    // Contact
    { category: "contact", question: "How can I contact you?", answer: "You can reach us via:\n- **WhatsApp / Phone:** +34 635 383 712\n- **Email:** ${COMPANY.email}\n- **Live chat:** Right here!\n\nFor urgent matters, WhatsApp is fastest.", tags: ["contact", "phone", "email", "whatsapp"] },
    { category: "contact", question: "What is your WhatsApp number?", answer: "Our WhatsApp number is **+34 635 383 712**. You can also click this link to start a chat: https://wa.me/34635383712", tags: ["whatsapp", "number", "phone"] },
  ];

  let kbCreated = 0;
  for (const entry of kbEntries) {
    const exists = await prisma.knowledgeBase.findFirst({ where: { question: entry.question } });
    if (!exists) {
      await prisma.knowledgeBase.create({ data: { ...entry, isActive: true, language: "en" } });
      kbCreated++;
    }
  }
  results.knowledgeBase = kbCreated;

  return NextResponse.json({ ok: true, results });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seed] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
