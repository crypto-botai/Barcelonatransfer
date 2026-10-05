# Release process

How a change gets from a developer's branch to the live website, and how to take it back. Production safety outranks speed.

## 1. Environments and branches

```
feature/*  ── pull request ──>  staging  ── pull request, owner approval ──>  main
   │                              │                                           │
 Preview (staging project)   Staging (staging project)                 Production (live)
```

| Branch | Purpose | Deploys to | Who can change it |
|---|---|---|---|
| `main` | What customers see. The only branch the production Vercel project builds | Production | Pull request only, checks green, owner approval |
| `staging` | Integration. Everything is proven here first | the staging Vercel project, with the staging database | Pull request only, checks green |
| `feature/*`, `fix/*`, `chore/*` | One change each | a Preview of the staging project | the author |
| `elitebcn-apps` `main` / `develop` | Mobile releases / mobile development | App stores / test builds | `main`: pull request only |

Rules:

1. Nothing is pushed straight to `main` or `staging`.
2. A branch starts from `staging`, not from `main`.
3. Promotion `staging → main` is always a deliberate pull request, in small slices, never one large merge.
4. Hot-fix for an emergency: branch from `main`, fix, pull request into `main` with checks green, then merge `main` back into `staging`. Even in an emergency, CI runs.

## 2. Checks (CI)

Every pull request into `main` or `staging` runs `.github/workflows/ci.yml`:

| Step | Command | Fails when |
|---|---|---|
| Secrets are not tracked | `npm run check:secrets` | an environment file or credential-shaped string is tracked |
| Prisma schema valid | `npx prisma validate` | the schema is invalid |
| Prisma client generates | `npx prisma generate` | generation fails |
| TypeScript | `npm run typecheck` | any type error |
| Lint (safety and mobile-API code) | `npm run lint:safety` | any lint error in the scoped files |
| Tests | `npm test` | any test fails (3,200+ today, including the environment guard, route protection and secret scanners) |
| Build | `npm run build` | the production build fails |
| Dependency audit | `npm audit --omit=dev` | **advisory, does not block.** Read it |

CI uses throwaway values for every variable. It cannot reach a real database or a real third-party account.

## 3. GitHub protection (set up by the owner)

GitHub settings need the owner's own login. Ready-made rulesets are in `docs/github/`.

**Repository `crypto-botai/Barcelonatransfer`**

1. Settings → **Rules → Rulesets → New ruleset → Import a ruleset**.
2. Import `docs/github/ruleset-main.json`. Check it shows **Active**.
3. Import `docs/github/ruleset-staging.json`.
4. Settings → Actions → General → Workflow permissions: **Read repository contents**.
5. Settings → Code security: confirm **Secret scanning** and **Push protection** are on.

What the rulesets enforce:

| | `main` | `staging` |
|---|---|---|
| Pull request required | yes | yes |
| Direct push | blocked | blocked |
| Force push | **blocked** | blocked |
| Delete the branch | blocked | blocked |
| Status check `Typecheck, lint, tests, build` | required, branch must be up to date | required |
| Conversations resolved before merge | yes | no |
| Approvals | 0 now (you are the only person; raise to 1 when a second person joins) | 0 |
| Bypass | nobody | nobody |

**The one sanctioned exception.** A security history rewrite needs a force push. Do it only with the owner's explicit approval, by setting both rulesets to **Disabled** for the minutes it takes and **Active** again straight after (`docs/SECURITY.md`, rule 3; the procedure is in the private runbook). Do not weaken a rule to make development easier.

**Production deploys only after checks.** Because `main` can only change through a pull request with the required check green, every Production build comes from code that passed CI. In Vercel (production project) keep **Production Branch = `main`**.

**Repository `elitebcn-apps` (PRIVATE)**

1. Create it **private**: GitHub → New repository → Owner `crypto-botai` → Name `elitebcn-apps` → **Private** → do not add a README, `.gitignore` or licence.
2. From `C:\Users\boxin\elitebcn-apps`: `git remote add origin https://github.com/crypto-botai/elitebcn-apps.git`, `git push -u origin main develop`.
3. Settings → Rules → import `docs/github/ruleset-apps-main.json` (required check `Typecheck, lint, tests`; the name appears after the first CI run; push `develop` and open a pull request to see it).
4. Settings → Code security: turn on secret scanning and push protection.

## 4. Deploying a change to production

Only with the owner's approval of that slice.

1. The change has been on `staging` and used. Smoke tests below passed there.
2. Open a pull request `staging → main`. Read the file list. Note any schema addition (section 6).
3. CI green. Merge.
4. Vercel builds Production automatically.
5. Immediately run the production smoke tests.
6. Watch Vercel Logs for 10 minutes.

**Smoke tests** (about 5 minutes):

1. Home, `/pricing` and one `/transfers/...` page load.
2. The booking form returns a quote. A booking reaches the payment page (do not pay).
3. Sign in to `/admin`. Bookings and Customers show data.
4. Signed out, `/admin` redirects to the sign-in page.
5. `/sitemap.xml` and `/robots.txt` load.
6. `/api/v1/health` answers, and says `production`.
7. In Vercel, **Logs** show no new 500s and **Cron Jobs** show recent successful runs.

## 5. Emergency rollback

Pick the smallest tool that works. Nothing here needs a code change.

| Situation | Action | Time |
|---|---|---|
| A bad deploy broke the site | Vercel → the production project → **Deployments** → the last good Production deployment → **⋯ → Promote to Production** (Instant Rollback). The code is back at once. The bad code stays in `main` until reverted | under a minute |
| Fix the repository after a rollback | Open a pull request that **reverts** the bad merge (`git revert <merge commit>`). Never reset or force-push `main` | minutes |
| A bad environment variable | Vercel → Settings → Environment Variables → correct it → **Redeploy** the latest Production deployment (a variable only takes effect on a new deployment) | 2 to 3 minutes |
| A bad cron or webhook change | Roll back as above. Cron schedules live in `vercel.json` and follow the deployment. Check **Cron Jobs** afterwards | 1 to 3 minutes |
| A bad database change | See section 6. **A code rollback does not undo a schema change** | depends |
| A secret has leaked | `docs/SECURITY.md`, section 8. Rotate first | |
| A payment problem | Payments are confirmed three ways (webhook, the success page, the 15-minute reconcile cron). Check SumUp's dashboard and the admin. Do not hand-edit the database | |

After any rollback: run the smoke tests, write down what happened, and add a test that would have caught it.

## 6. Database changes

The project applies its schema with `prisma db push` and has no migration history yet. `db push` can drop columns.

1. **Production changes are additive only:** a new table or a new nullable column. Never rename, retype or drop a model, column or enum value.
2. The change is made on `staging` first, with `npm run db:push:staging`, and used there.
3. For production, read the exact SQL first (`prisma migrate diff --from-url <production, read-only> --to-schema-datamodel prisma/schema.prisma --script`), apply it **by hand**, once, with the owner watching, in a quiet hour.
4. Before: note the time and confirm a Neon restore point exists (Neon keeps history for point-in-time restore).
5. `db push` is never part of a build or deploy and never run from a script against production.
6. **Rollback of a schema change** is a restore: in Neon, restore to a point before the change **as a new branch**, check it, then repoint production at it (a production change, with approval). Adding a nullable column or table rarely needs this, because the old code ignores them.
7. Planned: baseline the current schema into a first migration (`prisma migrate diff`, then `migrate resolve --applied`) and switch to `prisma migrate deploy`. A separate approved task.

## 7. Dependency changes

Upgrading a production dependency (Next.js, next-auth, Prisma, React) is its own change: one package per pull request, on `staging` first, full test suite plus the route-protection tests, smoke tests on staging, then promoted. Never bundled with a feature.

## 8. Mobile releases

`elitebcn-apps` builds are pointed at **staging** until a release is approved. A production build is only made for a tagged release, with `EXPO_PUBLIC_APP_ENV=production` and the production address (the app refuses to start on any other combination). Store submission, review and phased rollout are described in `docs/MOBILE.md`.
