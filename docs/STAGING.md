# Staging

How to create and run the staging environment, so the mobile platform can be built and broken without any chance of touching real customers, real bookings or real money.

**Status on 5 Oct 2026:** code, scripts, rules and this guide are ready and tested. The three accounts that create the infrastructure (GitHub settings, Neon, Vercel) need the owner's own login and hold secrets, so they are set up by hand using section 4. Nothing in this guide touches production.

## 1. The target architecture

```
GitHub repository crypto-botai/Barcelonatransfer
  main ───────────────> Vercel project "barcelonatransfer-gsj6"  ──> www.elitebcn.info ──> Neon PRODUCTION
  staging ────────────> Vercel project "elitebcn-staging"        ──> staging address    ──> Neon STAGING (elitebcn-staging)
  feature/* ── pull request ──> staging   (a Preview of the feature is built for review)

GitHub repository elitebcn-apps  (PRIVATE, mobile)
  main      protected, pull request required
  develop   active development
  both talk to the staging API (https://<staging address>/api/v1) until a release is approved
```

| | Production | Staging | Feature branches |
|---|---|---|---|
| Git branch | `main` | `staging` | `feature/*` |
| Vercel project | `barcelonatransfer-gsj6` (exists) | **`elitebcn-staging`** (new, separate) | Preview of the staging project |
| Production Branch setting | `main` | a branch that does not exist, e.g. `staging-unused`, so every push is a **Preview** | |
| Why Preview | | Vercel runs `vercel.json` crons only on production deployments. As a Preview, staging **never runs the abandoned-booking, payment-reconcile, WhatsApp, reminder, review or AI crons** | |
| Database | Neon production project | **Neon project `elitebcn-staging`**, database `elitebcn_staging`, synthetic data | the same staging database |
| `APP_ENV` | unset | `staging` | `staging` |
| SumUp, WhatsApp, Resend, Twilio | live | unset, or sandbox | unset |
| Search engines | indexed | `noindex` + Vercel authentication | `noindex` |

## 2. Hard rules

1. **Staging receives no production variable and no production secret.** Every secret is generated fresh for it.
2. **Third-party services are unset or sandboxed.** Unset means the feature reports "skipped" instead of acting on real people.
3. **The database is its own Neon project.** Not a branch of production, because a branch copies every real customer. It has its own role and password, never the production role name.
4. **The database name contains the word `staging`** (the documented name is `elitebcn_staging`). The application and the staging scripts refuse to start otherwise.
5. **The environment guard stays on.** If a non-production process names the production database host in any variable, it refuses to start (`lib/env-guard.ts`, `instrumentation.ts`). Do not look for a way around it. Fix the variable.
6. **Synthetic data only.** Customer data is never copied into staging, scrubbed or not.
7. **The live SumUp webhook secret never appears in staging**, nor does the live SumUp key or merchant code.

## 3. What the code already enforces

| Safeguard | What it stops |
|---|---|
| `lib/env-guard.ts`, `instrumentation.ts` | A staging, preview, test or local process starting against the production database (compared by host fingerprint, no host stored). In `staging` it additionally requires every database name to contain `staging` |
| `npm run db:push:staging` | `prisma db push` running unless `APP_ENV=staging` and every database variable, including values Prisma would read from `.env` files, is a marked staging database |
| `npm run db:seed:staging` | The seed running anywhere but a marked staging database. Refuses on production identifiers. Writes invented data only (`@staging.invalid` addresses) |
| `middleware.ts` (existing) | On any host other than the two production hostnames it adds `noindex, nofollow` |
| `.env.staging.example` | Placeholders and names only, with the rules above in comments |
| `scripts/check-secrets.mjs`, `scripts/check-history.mjs` | A tracked environment file or a credential-shaped string, now or anywhere in history |

## 4. Setup, step by step (you perform these)

Allow about 45 minutes. Do them in this order.

### 4.1 Neon: the staging database (10 minutes)

1. Neon Console → **New project**. Name `elitebcn-staging`. Region **eu-central-1 (Frankfurt)**, the same as production. Same Postgres major version as production.
2. In that project: database name **`elitebcn_staging`**, role **`staging_owner`** (never the production role name).
3. Copy two connection strings: the **pooled** one and the **direct** one. Treat them as secrets. Keep them in a password manager. They go only into the Vercel staging project (4.3) and, if you work locally, into your shell for the next step.
4. Create the tables and the invented data **from your own machine**, with the staging values set in that one terminal only (do not put them in a file in the repository):
   ```
   set APP_ENV=staging
   set POSTGRES_PRISMA_URL=<staging pooled URL>
   set POSTGRES_URL_NON_POOLING=<staging direct URL>
   npm run db:push:staging
   set STAGING_SEED_PASSWORD=<12+ characters you choose for the test accounts>
   npm run db:seed:staging
   ```
   Both commands first run `scripts/staging/assert-staging.ts`. It stops with a plain message if `APP_ENV` is not `staging`, if any database variable names the production database, or if a database name lacks `staging`.
5. What you get: `admin@`, `customer@`, `driver@`, `driver2@staging.invalid` (that domain cannot receive mail) and six bookings in six different states (`STG-0001` to `STG-0006`). The database is marked by an `activity_logs` row with action `STAGING_MARKER`.

### 4.2 GitHub: protect the branches (10 minutes)

See `docs/RELEASE.md`, section 3, which has ready-to-import rulesets (`docs/github/`). In short: Settings → Rules → Rulesets → New → **Import a ruleset**, import `ruleset-main.json`, then `ruleset-staging.json`.

### 4.3 Vercel: the staging project (15 minutes)

1. Vercel → **Add New → Project** → import `crypto-botai/Barcelonatransfer`. Name it exactly **`elitebcn-staging`**. Team: the same team.
2. **Before the first deploy**, open **Environment Variables** in the import screen and add `APP_ENV` = `staging` (all environments). This guarantees the first build already knows it is staging. Then deploy.
3. **Settings → Git → Production Branch:** change it to `staging-unused` (a branch that does not exist). From now on every push, including to `staging`, is a Preview, so no cron ever runs.
4. **Settings → Domains:** use the stable branch address Vercel shows for the `staging` branch, or add `staging.elitebcn.info` if you want a custom name (needs a DNS record).
5. **Settings → Deployment Protection:** leave **Vercel Authentication** on for Preview. Staging is for you and testers only. (The mobile apps will need a protection-bypass token for automation. That is added in the mobile phase, not now.)
6. **Settings → Environment Variables.** Scope **Preview only** (add Development only if you use `vercel dev` locally, with staging values). Add these names. Generate each secret fresh (`openssl rand -base64 48`; VAPID with `npx web-push generate-vapid-keys`):

   | Variable | Value |
   |---|---|
   | `APP_ENV` | `staging` |
   | `POSTGRES_PRISMA_URL` | staging **pooled** URL (database `elitebcn_staging`) |
   | `POSTGRES_URL_NON_POOLING` | staging **direct** URL |
   | `NEXTAUTH_SECRET` | new, staging only |
   | `NEXTAUTH_URL` | the staging address, with `https://` |
   | `MOBILE_JWT_SECRET` | new, 32+ characters, different from `NEXTAUTH_SECRET` |
   | `CRON_SECRET` | new (no cron runs on Preview, this stops a manual call using a real one) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | a new pair |

   **Do not add:** `SUMUP_*`, `RESEND_API_KEY`, `TWILIO_*`, `WA_*`, `AERODATABOX_KEY`, `GOOGLE_*`, any AI key. If a feature must be tried, use that service's **sandbox or test** account and a different key. A file with freshly generated values for the first group can be prepared locally for you to paste (never committed).
7. **Redeploy** the latest `staging` deployment so it picks the variables up.

### 4.4 Prove the isolation (5 minutes)

1. Open `https://<staging address>/api/v1/health`. It must say `"environment":"staging"`. `production` or `preview` means `APP_ENV` is missing.
2. In the staging project's Environment Variables page, confirm nothing is scoped to **Production** and none of the "Do not add" names exists.
3. Temporarily change one of the two database URLs to a name without `staging` and redeploy: the deployment must **fail to start** with "Refusing to start". Put it back.
4. In Neon, confirm the production project has no connections from the staging project's addresses.
5. In the production Vercel project, confirm its Preview scope no longer holds SumUp values (`docs/SECURITY.md`, section 3).

## 5. Day-to-day

```
git switch staging && git pull
git switch -c feature/my-change
...work...
git push -u origin feature/my-change      # open a pull request into staging
```

CI must pass. Merge into `staging`; Vercel deploys it to the staging address. Production is untouched. Promotion is described in `docs/RELEASE.md`.

## 6. Local development

Local runs use staging values or no database. Never put production variables in a local file. The environment guard refuses a local run that names the production database.

## 7. Resetting staging

Staging is disposable. To reset: in Neon, delete and recreate the database `elitebcn_staging`, then repeat 4.1 step 4. Nothing else holds state.
