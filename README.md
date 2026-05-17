# Élite BCN — Luxury Transfer Platform

A full-stack luxury private transfer booking platform built with Next.js 15, TypeScript, Tailwind CSS, Framer Motion, Stripe, Supabase, and Google Maps.

## Features

- **Live price calculator** — Google Maps Distance Matrix + real-time fare engine
- **10 vehicle classes** — Economy to Minibus, all with accurate descriptions
- **4-step booking flow** — Route → Vehicle → Details → Stripe Checkout
- **Apple Pay & Google Pay** — via Stripe Payment Element
- **Booking confirmation emails** — Resend with luxury HTML templates
- **Admin dashboard** — Bookings, drivers, fleet, pricing rules
- **Driver portal** — Ride management, status toggle, location tracking
- **Customer dashboard** — Booking history
- **Real-time tracking** — GPS polling API
- **SEO optimized** — Sitemap, robots.txt, Schema.org, Open Graph
- **Mobile-first** — Luxury app-grade mobile UX

## Quick Start

### 1. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Set up environment variables
\`\`\`bash
cp .env.example .env.local
# Fill in all values
\`\`\`

### 3. Set up database
\`\`\`bash
npx prisma db push
\`\`\`

### 4. Run development server
\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

See `.env.example` for a complete list. Key services required:

| Service | Purpose |
|---------|---------|
| **Supabase** | PostgreSQL database |
| **Google Maps** | Places autocomplete + Distance Matrix |
| **Stripe** | Payments (card, Apple Pay, Google Pay) |
| **Resend** | Transactional emails |
| **Google OAuth** | Social sign-in (optional) |

## Deploy to Vercel

1. Push to GitHub (already done)
2. Connect repo in Vercel dashboard
3. Add all environment variables in Vercel settings
4. Deploy — auto-deploys on every push to main

## Contact

- **WhatsApp**: +34 635 383 712
- **Email**: vtcbcn2025@gmail.com
- **Location**: Barcelona, Spain
