# The price-reading rule

**Every customer-facing price is read from the route table. None is typed by hand.**

This is enforced by `lib/__tests__/price-surface.test.ts`, which fails the build
if a fare literal appears on a public page or in its structured data.

## Why the rule exists

Prices used to be written into each page. They were correct on the day they
were written, and then they drifted, silently, because nothing connected a page
to the table the checkout quotes from:

| Surface | Advertised | Actually charged |
| --- | --- | --- |
| Barcelona hotel → cruise port | €35 | €60 |
| Costa Brava "from" | €90 | €135 |
| Lloret de Mar, sitewide JSON-LD | €100 | €145 |
| Roses, sitewide JSON-LD | €155 | €205 |
| 43 hotel and cruise pages | €45 / €35 | €50 |

Nobody made a mistake writing those numbers. They were right at the time. The
mistake was having two places where a price could live.

## The source of truth

```
lib/fixed-prices.ts  FIXED_ROUTES        the table
        ↓
lib/pricing.ts       ROUTES              derived view
        ↓
DB Route / RoutePrice                    admin-editable overlay
```

Everything customer-facing reads through one of these:

| You need | Use | Where |
| --- | --- | --- |
| A booking quote | `getQuote()` | `lib/pricing-service.ts` |
| A public price list | `getPublicRoutes()` | `lib/pricing-service.ts` |
| One route's five fares on a static page | `ladderFor(zone, origin)` | `lib/destination-pricing.ts` |
| The cheapest of several destinations | `cheapestOf(zones)` | `lib/destination-pricing.ts` |
| A place known only by coordinates | `getPlacePrices(lat, lng, km)` | `lib/destination-pricing.ts` |
| The sitewide JSON-LD catalogue | `buildOfferCatalog()` | `lib/offer-catalog.ts` |
| An hourly rate | `HOURLY_RATES[class]` | `lib/pricing.ts` |

## Rules

1. **Never type a fare into a component, a page, a description or a schema
   block.** Read it.
2. **A "from €X" headline is computed**, not chosen — `cheapestOf()` over the
   destinations the page actually names.
3. **No published fare means no price.** If a route has no table row it is
   quoted by distance; say that, or omit the figure. Structured data cannot
   express "it depends", so leave the price out rather than publish a guess.
4. **`data/destinations.json` prices are dead.** The file is still read for
   slugs, names, coordinates and copy, but its `prices` field must never reach
   a customer. It is retained only because other fields are in use.
5. **Origin matters on two routes.** Girona is €165 from the airport and €140
   from the city; the cruise port is €50 and €60. Everywhere else the two match,
   which means a page quoting the wrong origin looks correct until it isn't.

## Adding a destination page

```ts
import { ladderFor } from "@/lib/destination-pricing";

const LADDER = ladderFor("sitges", "airport")!;
// …
{ vehicle: "Economy sedan", price: `€${LADDER.economy}` }
offers: { "@type": "Offer", price: String(LADDER.economy), priceCurrency: "EUR" }
```
