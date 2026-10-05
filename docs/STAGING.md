# Staging

How to create and run the staging environment. It exists so the mobile platform can be built and broken without any chance of touching real customers, real bookings or real money.

**Status on 5 Oct 2026:** the code, scripts and documentation are ready. The three accounts below (GitHub settings, Vercel, Neon) have to be set up by you in their dashboards, because they need your logins, create billing-relevant resources and hold secrets. Steps are in section 3.

## 1. What staging is

| | |
|---|---|
| Code | branch `staging` of `crypto-botai/Barcelonatransfer` |
| Hosting | a **separate Vercel project** named `elitebcn-staging`, never the production project |
| Deployment type | **Preview** deployments. This matters: Vercel runs `vercel.json` crons only on production deployments, so staging never runs the abandoned-booking, payment-reconcile, WhatsApp follow-up, reminder, review or AI crons |
| Database | a **new, empty Neon project** named `elitebcn-staging`, filled with invented data. Not a branch of production: a branch copies every real customer |
| Identity | `APP_ENV=staging`, and the database is marked by an `activity_logs` row with action `STAGING_MARKER` |
| Search engines | `noindex` from the middleware on any host other than the two production hosts, plus Vercel deployment protection |

## 2. Hard rules

1. Staging uses **no production environment variable.** Every secret is generated fresh for it.
2. Third-party services are **unset or sandboxed**: no live SumUp key, no Resend key, no Twilio, no WhatsApp token for the real number. Unset means the feature reports "skipped".
3. If a staging process finds the production database in any variable, it **refuses to start** (`lib/env-guard.ts`). Do not look for a way around this. Fix the variable.
4. Customer data is never copied into staging. Synthetic data only.

## 3. Setup, step by step

### 3.1 GitHub (5 minutes)

1. Push the branch: `git push -u origin staging` (already done if you see it on GitHub).
2. Repository → Settings → Branches → **Add branch ruleset** (or a classic protection rule) for `main` **and** for `staging`:
   - Require a pull request before merging
   - Require status checks to pass: select **Typecheck, lint, tests, build**
   - Block force pushes, block deletions
   - For `main`, also require approval and do not allow bypass for administrators if you want the rule to bind you too
3. Settings → Actions → General → "Workflow permissions": **Read repository contents** only.

### 3.2 Neon (10 minutes)

1. Neon console → **New project** → name `elitebcn-staging`, region `eu-central-1` (Frankfurt, same as production), Postgres version the same as production.
2. Database `elitebcn_staging`, role `staging_owner`. Use a different role name from production.
3. Copy the **pooled** and **direct** connection strings. They go only into the Vercel staging project (next step) and, if you work locally, into a git-ignored `.env.staging.local`.
4. Create the tables and the synthetic data **from your machine**, with the staging variables set in that shell only:
   ```
   set APP_ENV=staging
   set POSTGRES_PRISMA_URL=<staging pooled URL>
   set POSTGRES_URL_NON_POOLING=<staging direct URL>
   npm run db:push:staging
   set STAGING_SEED_PASSWORD=<a 12+ character password you choose for test accounts>
   npm run db:seed:staging
   ```
   Both commands first run `scripts/staging/assert-staging.ts`, which stops unless `APP_ENV=staging` and no variable (including values Prisma would read from `.env` files) names the production database.
5. Test accounts created: `admin@`, `customer@`, `driver@`, `driver2@staging.invalid` (the `.invalid` domain cannot receive mail). Six bookings in six different states.

### 3.3 Vercel (15 minutes)

1. Vercel → **Add New → Project** → import `crypto-botai/Barcelonatransfer` → name it **`elitebcn-staging`**.
2. Settings → Git → **Production Branch**: set it to a branch that does not exist, for example `staging-unused`. This makes every push to `staging` a **Preview** deployment, which is what keeps crons off. Do not leave it as `main`.
3. Settings → Domains: give the `staging` branch a stable alias (Vercel shows "Branch URL"), or add `staging.elitebcn.info` if you want a custom name (needs a DNS record).
4. Settings → **Deployment Protection**: keep Vercel Authentication on. Staging is for you and testers only. (The mobile apps will need a protection-bypass token for automation, added in the next phase.)
5. Settings → Environment Variables. Scope: **Preview only** (and Development if you use `vercel dev`). Add from `.env.staging.example`:
   `APP_ENV=staging`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `MOBILE_JWT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
   Generate each secret fresh, for example `openssl rand -base64 48`, and VAPID with `npx web-push generate-vapid-keys`. **Never paste a value from the production project.** Do not add SumUp, Resend, Twilio, WhatsApp or AeroDataBox keys.
6. Redeploy. Open `/api/v1/health`. It must answer `{"ok":true,"data":{"status":"ok","environment":"staging",...}}`. If it says `production` or `preview`, `APP_ENV` is missing.

### 3.4 Prove it is isolated

- Remove `APP_ENV` temporarily and paste a production database URL into a Preview variable: the deployment must **fail to start** with "Refusing to start". Undo it.
- Check the Vercel project's Environment Variables page: nothing scoped to Production in this project.
- Check Neon: the staging project has no connection from the production Vercel project.

## 4. Day-to-day

```
git switch staging && git pull
git switch -c feature/my-change
...work...
git push -u origin feature/my-change      # open a pull request into staging
```

CI must pass. Merge into `staging`; Vercel deploys it to the staging URL. Production is untouched.

## 5. Promoting to production

Only with your approval, in small slices:

1. The slice has been on staging long enough to trust.
2. A pull request `staging → main`. CI passes.
3. Any schema addition is applied to production by hand first (see `docs/ARCHITECTURE.md`, section 5).
4. Merge. Vercel builds production.
5. Immediately test: home page, `/api/quote`, a booking up to the payment page, `/admin`, the SumUp webhook in the logs.
6. Roll back with Vercel's "Instant Rollback" if anything is wrong.

## 6. Pending for production, not done here

Outstanding security actions for production are tracked privately (see `docs/SECURITY.md`, rule 5). None has been applied to production.

## 7. Branch protection status

Branch protection is a GitHub setting. It was **not applied** from this environment (no GitHub CLI or API token was available, and changing repository permissions needs your own login). Apply section 3.1.
