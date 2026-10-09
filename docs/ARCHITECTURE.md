# Architecture

How the EliteBCN platform is put together, and the rules that keep the live business safe while it grows.

## 1. The three parts

```
                        PRODUCTION (live business)
 GitHub: crypto-botai/Barcelonatransfer, branch main
        |  auto-deploy
        v
 Vercel project (production) ──> www.elitebcn.info ──> Neon production database
        |                                   |
        |                                   '── SumUp, WhatsApp, Resend, Twilio, AeroDataBox (live accounts)
        '── 7 cron jobs

                        STAGING (safe to break)
 GitHub: same repository, branch staging
        |  auto-deploy as a Preview deployment
        v
 Vercel project "elitebcn-staging" ──> staging hostname ──> Neon STAGING project (synthetic data)
                                                |
                                                '── sandbox or unset third-party accounts, no crons

                        MOBILE APPS
 GitHub: elitebcn-apps (new PRIVATE repository, monorepo)
        apps/customer   apps/driver   packages/*
        |  HTTPS, bearer tokens
        v
 /api/v1/*  on staging first, production only after approval
```

## 2. What stays exactly as it is

The existing website is one Next.js 16 application: public pages and SEO, the booking flow, the customer portal, the driver and fleet-partner panels, the admin, 135 API routes and 7 crons. It keeps its repository, its `main` branch and its Vercel project. **It is not moved into a monorepo**, because changing its root directory, build and paths on a live site is the riskiest step available and gives nothing the apps need.

Business logic that already exists is the only copy, and the mobile platform calls it:

| Concern | Where it lives | Rule |
|---|---|---|
| Pricing | `lib/pricing-service.ts` (`getQuote`), `lib/fixed-prices.ts`, database overlay | One engine. The apps never calculate a price |
| Booking creation | `app/api/bookings/route.ts` | Reused through `/api/v1`, not copied |
| Payments | `lib/sumup.ts`, `lib/payment-completion.ts`, `app/api/payments/*` | SumUp only. No second provider |
| Notifications | `lib/notifications/service.ts` (`notify`) | Remains the single fan-out. A mobile push becomes one more channel in it |
| Ride stages | `lib/ride-stages.ts`, `app/api/driver/ride/route.ts` | Extended additively in a later phase |
| Live position | `app/api/tracking/route.ts`, `RideTracking` table | Extended in a later phase |

## 3. Environments

| | Production | Staging | Local |
|---|---|---|---|
| Branch | `main` | `staging` | feature branches |
| Hosting | Vercel production project | Vercel project `elitebcn-staging`, Preview deployments | your machine |
| Database | Neon production | Neon staging project, synthetic data | staging database only |
| `APP_ENV` | unset | `staging` | `development` |
| Crons | run | **never run** (Preview deployments do not run crons) | do not run |
| SumUp, WhatsApp, Resend, Twilio | live | sandbox, a test number, or unset | unset |
| Indexed by search engines | yes | no (`X-Robots-Tag: noindex`, Vercel protection) | no |

The environment is identified by `APP_ENV`, then by Vercel's `VERCEL_ENV`. See `lib/env-guard.ts`. Anything unidentified counts as not production.

## 4. Git flow

```
feature/*  ──pull request──>  staging  ──manual approval──>  main  ──>  Vercel production
                               │
                               └─ staging Vercel project
```

- `main` is protected: pull requests only, CI must pass, no direct pushes, no force pushes.
- `staging` is protected the same way, with CI required.
- Nothing reaches `main` without your approval. Promote in small slices, not as one large merge.
- Both branches run the same CI (`.github/workflows/ci.yml`): secret scan, Prisma validate, TypeScript, lint, tests, build, dependency audit.

## 5. Database changes

The project applies its schema with `prisma db push` and has no `prisma/migrations` folder. `db push` compares the schema file to the live database and applies the difference, **including dropping columns**.

Rules until a migration history exists:

1. A schema change is only ever **additive**: a new table, or a new nullable column. Never rename, retype or drop a production model, column or enum value.
2. It is made on `staging` first, with `npm run db:push:staging` (refuses to run unless the shell says staging and no variable names the production database).
3. For production, the same change is applied by hand, once, by you or with you watching, after `staging` has been used with it for some time. `db push` is not part of any build or deploy.
4. Before a production change: a Neon point-in-time restore point is noted (Neon keeps history), and the exact SQL that `prisma migrate diff --from-url ... --to-schema-datamodel` produces is read first.

Planned strategy: baseline the current production schema into a first migration (`prisma migrate diff` then `migrate resolve --applied`), then move to `prisma migrate deploy` for production. That is a separate approved task.

## 6. API conventions (`/api/v1`)

- **Version:** the path carries it. `/api/v1` never changes shape incompatibly. A breaking change becomes `/api/v2` and `/api/v1` keeps working until old apps are gone. Add fields, never remove or rename.
- **Success:** `{ ok: true, data, meta: { requestId, apiVersion } }`.
- **Failure:** `{ ok: false, error: { code, message, details?, retryable, retryAfterSeconds? }, meta }`. Codes and their HTTP statuses are in `lib/api/v1/types.ts` and are append-only.
- **Auth:** bearer access token (15 minutes) plus a rotating refresh token. See `docs/SECURITY.md`.
- **Validation:** zod on every body and query; field-level problems, never the rejected value.
- **Idempotency:** writes that create a booking or take a payment accept an `Idempotency-Key` header so a retry cannot book or charge twice (implemented with those endpoints).
- **Rate limits:** per route class. 429 with `Retry-After`.
- **Headers on every response:** `Cache-Control: no-store`, `X-Request-Id`, `X-Api-Version`, `X-Robots-Tag: noindex`.
- **Built in this phase:** `GET /api/v1/health`, `GET /api/v1/app-config`, and the shared helpers in `lib/api/v1/`. Everything else is later.

Planned areas: `/auth/*`, `/quote`, `/bookings/*`, `/customer/*`, `/driver/*`, `/tracking/*`, `/notifications/*`, `/payments/*`, `/profile/*`.

## 7. Dependencies

```
Browser/App ──> Vercel (Next.js) ──> Neon Postgres (Prisma)
                     |──> SumUp (checkout, webhook, refunds)
                     |──> Resend (email)         |──> Twilio (SMS)
                     |──> Meta WhatsApp Cloud API (messages, webhook)
                     |──> AeroDataBox (flights) |──> OpenStreetMap services (geocoding, routing)
                     |──> Vercel Blob (uploads) |──> web-push (browser push)
                     '──> Vercel cron (7 jobs)
GitHub main ──> Vercel production build        GitHub staging ──> staging build
```

## 8. Where things are

| You want | Look in |
|---|---|
| Environments, branches, deployment rules, rollback | `docs/RELEASE.md` |
| Creating staging (Neon, Vercel, GitHub) | `docs/STAGING.md` |
| Secrets, rotation, safeguards, database safety | `docs/SECURITY.md` |
| The mobile API contract | `docs/API-V1.md`, `lib/api/v1/`, `app/api/v1/` |
| The mobile apps, their structure and rules | `docs/MOBILE.md`, `docs/DESIGN-SYSTEM.md`, repository `elitebcn-apps` |
| The planned role model | `docs/ROLES.md` |
| The staging safety guard | `lib/env-guard.ts`, `instrumentation.ts`, `scripts/staging/` |
| CI and secret scanners | `.github/workflows/ci.yml`, `scripts/check-secrets.mjs`, `scripts/check-history.mjs` |
| GitHub branch rulesets (importable) | `docs/github/` |
