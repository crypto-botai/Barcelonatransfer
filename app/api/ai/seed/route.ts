import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ai/seed — one-time initialisation of KB entries, budget config, and agents
// Secured by CRON_SECRET or ADMIN_SEED_SECRET
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SEED_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  // 1. Budget config
  const budgetExists = await prisma.aiBudgetConfig.findFirst();
  if (!budgetExists) {
    await prisma.aiBudgetConfig.create({
      data: {
        globalMonthlyBudgetCents: 2000,
        globalKillSwitch: false,
        alertEmail: process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com",
      },
    });
    results.budgetConfig = 1;
  }

  // 2. Agent records
  const agentDefs = [
    { name: "support",      description: "Customer support chat — auto-replies to visitor questions using the knowledge base." },
    { name: "booking",      description: "Booking intelligence — scores leads, auto-confirms paid bookings, alerts admin." },
    { name: "orchestrator", description: "Master orchestrator — coordinates all agents on the daily cron schedule." },
    { name: "health",       description: "Website health — checks for broken links, SEO issues, and uptime daily." },
    { name: "seo",          description: "SEO monitor — weekly scan of all pages for metadata and content improvements." },
    { name: "analytics",    description: "Analytics agent — surfaces insights from traffic and conversion data." },
  ];

  let agentsCreated = 0;
  for (const def of agentDefs) {
    const existing = await prisma.aiAgent.findUnique({ where: { name: def.name } });
    if (!existing) {
      await prisma.aiAgent.create({ data: def });
      agentsCreated++;
    }
  }
  results.agents = agentsCreated;

  // 3. Knowledge base
  const kbEntries = [
    // Pricing
    { category: "pricing", question: "How much is a transfer from Barcelona Airport to the city centre?", answer: "Our fixed price for Barcelona Airport (T1 or T2) to the city centre starts from **€45** for an Economy sedan (up to 3 passengers). Business class starts from €55. No surge pricing — ever.", tags: ["airport", "price", "city"] },
    { category: "pricing", question: "What is the price to Sitges from Barcelona Airport?", answer: "A private transfer from Barcelona Airport (BCN) to Sitges costs from **€80** for an Economy sedan. MPV/minivan (4–6 pax) from €100. All prices are fixed and all-inclusive.", tags: ["sitges", "price"] },
    { category: "pricing", question: "How much is a transfer from the airport to Montserrat?", answer: "A private transfer from Barcelona Airport to Montserrat monastery is from **€85** (Economy sedan). The journey takes approximately 50 minutes.", tags: ["montserrat", "price"] },
    { category: "pricing", question: "What is the price to Andorra from Barcelona?", answer: "A private transfer from Barcelona or BCN Airport to Andorra costs from **€280** for an Economy sedan. For larger groups, an MPV starts from €340. Andorra is approximately 3 hours from Barcelona.", tags: ["andorra", "price"] },
    { category: "pricing", question: "Do you offer hourly hire?", answer: "Yes. Our hourly rate starts from **€40/hour** with a minimum of 4 hours. This is ideal for city tours, business meetings, or day trips. You can book hourly hire at elitebcn.info/hourly.", tags: ["hourly", "hire", "price"] },
    { category: "pricing", question: "Are there any extra charges or hidden fees?", answer: "No. Our prices are all-inclusive: chauffeur, luxury vehicle, tolls, meet & greet, and up to 60 minutes free waiting after landing. The only addition is VAT (10%) applied at checkout. No surge pricing, no surprises.", tags: ["fees", "hidden", "vat"] },
    { category: "pricing", question: "What is the price to Tarragona?", answer: "A transfer from Barcelona or the airport to Tarragona costs from **€150** for an Economy sedan. The journey takes approximately 1 hour.", tags: ["tarragona", "price"] },

    // Fleet
    { category: "fleet", question: "What vehicles do you have?", answer: "Our fleet includes:\n- **Economy** — Mercedes C-Class or similar (up to 3 pax)\n- **Business** — Mercedes E-Class or similar (up to 3 pax)\n- **Minivan** — Mercedes Viano or similar (up to 6 pax)\n- **V-Class** — Mercedes V-Class (up to 8 pax)\n- **Minibus** — (up to 14 pax)\n\nAll vehicles are immaculate and never older than 3 years.", tags: ["fleet", "vehicles", "car"] },
    { category: "fleet", question: "Do you have child seats?", answer: "Yes. Baby seats and child booster seats are available free of charge. Please mention this when booking under Special Requests.", tags: ["child seat", "baby", "kids"] },
    { category: "fleet", question: "Do you have wheelchair-accessible vehicles?", answer: "Please contact us directly via WhatsApp (+34 635 383 712) or email (vtcbcn2025@gmail.com) for accessibility requirements — we'll arrange the right vehicle for your needs.", tags: ["wheelchair", "accessibility"] },

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
    { category: "airport", question: "Which Barcelona airport do you serve?", answer: "We serve **Barcelona El Prat Airport (BCN)**, both Terminal 1 (T1) and Terminal 2 (T2). We also serve **Girona Airport (GRO)** and **Reus Airport (REU)** — please book those as a custom route.", tags: ["airport", "terminal", "BCN", "T1", "T2"] },

    // Service
    { category: "service", question: "Are you available 24/7?", answer: "Yes. We operate **24 hours a day, 7 days a week**, 365 days a year — including public holidays and Christmas.", tags: ["24/7", "hours", "available"] },
    { category: "service", question: "Do your drivers speak English?", answer: "Yes. All our drivers speak English. We also have drivers available in Spanish and Catalan.", tags: ["english", "language", "drivers"] },
    { category: "service", question: "Is Wi-Fi available in the vehicle?", answer: "Many of our vehicles offer complimentary Wi-Fi. Please mention this preference when booking and we'll do our best to assign you a vehicle with Wi-Fi.", tags: ["wifi", "internet"] },
    { category: "service", question: "Do you offer transfers from the cruise port?", answer: "Yes. We serve the Barcelona Cruise Terminal. A transfer to/from the city centre starts from **€45**. Meet & greet is included at the port gate.", tags: ["cruise", "port", "terminal"] },

    // Contact
    { category: "contact", question: "How can I contact you?", answer: "You can reach us via:\n- **WhatsApp / Phone:** +34 635 383 712\n- **Email:** vtcbcn2025@gmail.com\n- **Live chat:** Right here!\n\nFor urgent matters, WhatsApp is fastest.", tags: ["contact", "phone", "email", "whatsapp"] },
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
}
