# Security

How the EliteBCN platform protects the live business. This file describes rules and safeguards. It holds no secret, and it deliberately does not list unfixed weaknesses: those are tracked privately until they are closed (rule 6).

## 1. Rules

1. **No secret in Git, ever.** Not in code, comments, tests, documents, commit messages or logs. Real values live only in each environment's own settings. `.env` files are git-ignored. The only tracked environment files are `.env.example` and `.env.staging.example`, which hold placeholders.
2. **Environments never share secrets.** Production, staging and local each have their own database, signing secrets and third-party keys.
3. **Production is changed on purpose.** Nothing reaches `main` except through a pull request with passing checks and the owner's approval. Schema changes are additive and applied by hand.
4. **Anything that might have been exposed is treated as compromised** and rotated in a planned window, after its effect on production has been written down and approved. Rotating comes before cleaning history.
5. **A leak is not fixed by deleting the file.** Git history, forks, caches and clones keep it. Rotation is the fix, history clean-up is hygiene.
6. **Findings are not published until fixed.** The remediation plan from the 5 Oct 2026 audit is held privately, outside the repositories, and removed when its actions are complete.
7. **No placeholder looks real.** Examples use `<REDACTED>`, `PASSWORD`, `XXXX` or `your_...`, never a plausible token.

## 2. Secrets strategy

| Where a secret may live | Where it may not |
|---|---|
| Vercel environment variables (type **Sensitive**), scoped to the one environment that needs it | The repository, any `.env*` file other than the two examples, documentation, CI logs, issues, chat |
| A password manager, for the owner's copy | A screenshot, a terminal that is recorded, a shared document |
| The server only | A mobile app, a browser bundle, any `NEXT_PUBLIC_` / `EXPO_PUBLIC_` variable |

- `NEXT_PUBLIC_` and `EXPO_PUBLIC_` variables end up in shipped code. They hold public settings only (a contact number, a public key, an address).
- Each secret has one purpose. The mobile token secret (`MOBILE_JWT_SECRET`) is never the web's `NEXTAUTH_SECRET`.
- Generate with at least 48 random bytes: `openssl rand -base64 48`.
- The secret scanner (`npm run check:secrets`) fails CI if an environment file or a credential-shaped string is tracked. `npm run check:history` does the same across all of Git history and is run after any history rewrite. Both print paths and kinds only, never values. GitHub push protection is a second layer and does block pushes that contain recognised tokens.

## 3. Vercel environment scopes (rule)

Vercel has three scopes: **Production**, **Preview** and **Development**. Every branch push creates a Preview, so anything in Preview scope is visible to every Preview build.

- **Production scope** holds the live values and nothing else holds them.
- **Preview scope** holds no live credential: no database URL, no payment key or webhook secret, no messaging or email key, no OAuth client secret of a live app. A Preview needs only what a build and a smoke test need. Missing keys make integrations report "skipped", which is the desired behaviour.
- **Development scope** is what `vercel env pull` writes onto a laptop. It holds staging or sandbox values, never production ones.
- Staging is a **separate Vercel project** (`docs/STAGING.md`), so it never inherits the production project's variables.
- A change to the scope of a production variable is a production configuration change and needs the owner's approval.

## 4. Rotation policy

- **Scheduled:** database role passwords and signing secrets yearly, API keys when staff or tools change.
- **Immediate:** when a value appeared anywhere it should not have (a repository, a log, a chat, a screenshot), or a device or account was lost.
- **Order:** rotate, update Vercel, redeploy, test, only then clean up traces.
- **Each rotation is written down first:** what is rotated, which service owns it, whether it can affect production, which Vercel variables change, what is tested afterwards.
- A database password reset invalidates every connection string at once, so it is done in a quiet hour with the database console and Vercel open together.

## 5. Safeguards in the code

| Safeguard | What it prevents | Where |
|---|---|---|
| Environment guard | A staging, preview, test or local process starting against the production database. Compared by SHA-256 host fingerprint, so no host is stored. In `staging` it also requires every database name to contain `staging`. Does nothing on production | `lib/env-guard.ts`, `instrumentation.ts`, `lib/__tests__/env-guard.test.ts` |
| Staging-only database commands | `prisma db push` and the seed running against a non-staging database | `npm run db:push:staging`, `npm run db:seed:staging`, `scripts/staging/` |
| Secret scan (tree) | A tracked environment file or credential-shaped string | `scripts/check-secrets.mjs`, in CI |
| Secret scan (history) | A credential that was committed and later deleted | `scripts/check-history.mjs` |
| Route protection baseline | A change to Next.js, next-auth or the middleware silently changing who can open what | `lib/__tests__/route-protection.test.ts` |
| Staging templates with no secrets | Copying production values into staging | `.env.staging.example` |
| GitHub rulesets | Direct pushes, force pushes and untested merges to `main` and `staging` | `docs/github/`, `docs/RELEASE.md` |

## 6. Mobile API security model (`/api/v1`)

- **Authentication:** `Authorization: Bearer <access token>`. The web's cookie session is not accepted, so cross-site request forgery does not apply.
- **Access token:** signed JWT (HS256), 15 minutes, carries user id, role and device-session id. Signed with `MOBILE_JWT_SECRET` (32+ characters, never `NEXTAUTH_SECRET`).
- **Refresh token:** random 256 bits, single use, stored only as a SHA-256 hash. Each refresh returns a new pair. Reusing a spent token revokes the whole sign-in and ends the session. A session ends 90 days after sign-in however often it was refreshed.
- **Device storage:** iOS Keychain or Android Keystore (`expo-secure-store`), available only while the phone is unlocked, never synced to another device. The environment name is part of the key. Lint blocks AsyncStorage.
- **Authorisation:** every route declares its roles. Routes that move money, change roles or expose personal data also re-check the user and session in the database, because an access token cannot be revoked inside its 15 minutes.
- **Roles:** see `docs/ROLES.md`. Admin-level roles are not issued mobile sessions until multi-factor sign-in exists.
- **Validation, errors, logging, audit, rate limits:** see `docs/API-V1.md`.
- **Payments:** the apps never receive card data. They open the existing hosted SumUp checkout. The server confirms every payment through SumUp's API.
- **Prices:** the apps display a number the server sent and never calculate one. A test fails if pricing-like code appears in the shared packages.

## 7. Database safety rules

1. Never run `prisma db push`, `prisma migrate` or any destructive command against production from a laptop or a script. Production schema changes are additive, written out as SQL first, and applied by the owner.
2. Staging commands (`db:push:staging`, `db:seed:staging`) refuse to run unless the shell says staging and the database name contains `staging`.
3. No customer data is copied out of production. Staging uses invented data.
4. A production schema change is preceded by noting a Neon restore point (Neon keeps history) and followed by the smoke tests in `docs/RELEASE.md`.
5. Roles and enum values are never renamed or removed. See `docs/ROLES.md` for how new ones are added safely.

## 8. Incident response (short form)

1. **Contain:** if a secret is exposed, treat it as compromised now. Do not wait to understand it.
2. **Rotate** following section 4, in the right order, and update Vercel.
3. **Check for abuse:** look at the service's own logs (database console, payment dashboard, Search Console, email and messaging dashboards) for the period of exposure.
4. **Clean up:** history rewrite and cache removal, only after rotation, following the private runbook.
5. **Learn:** add a check that would have caught it (a scanner pattern, a test) and update this document.

## 9. Reporting a problem

Security issues go to the owner directly (booking@elitebcn.info), not to a public issue.
