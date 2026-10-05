# Security

How the EliteBCN platform protects the live business. This file describes the rules and the safeguards. It holds no secret and no finding that would help an attacker.

## 1. Rules

1. **No secret in Git, ever.** Not in code, comments, tests, documents, commit messages or logs. Real values live only in each environment's own settings (Vercel for the website, the server only). `.env` files are git-ignored; the only tracked environment files are `.env.example` and `.env.staging.example`, which hold placeholders.
2. **Environments never share secrets.** Staging has its own database, its own signing secrets and no live third-party keys.
3. **Production is changed on purpose.** Nothing reaches `main` without a reviewed pull request and your approval. Schema changes are additive and applied by hand.
4. **Anything that might have been exposed is treated as compromised** and rotated, in a planned window, after its effect on production has been explained and approved.
5. **Findings are not published until fixed.** The remediation plan from the 5 Oct 2026 audit is held privately, outside the repositories, and is removed once its actions are done.

## 2. Safeguards

| Safeguard | What it prevents | Where |
|---|---|---|
| Environment guard | A staging, preview, test or local process starting against the production database. It compares the database host by SHA-256 fingerprint, so no host is stored in the repository. It does nothing on production | `lib/env-guard.ts`, `instrumentation.ts`, `lib/__tests__/env-guard.test.ts` |
| Secret scan | A tracked environment file, or a credential-shaped string, entering the repository. Prints paths, never the match | `scripts/check-secrets.mjs`, runs in CI |
| Staging-only database commands | `prisma db push` and the seed script running against production from a laptop | `npm run db:push:staging`, `npm run db:seed:staging` |
| Staging templates with no secrets | Copying production values into staging | `.env.staging.example` |

## 3. Mobile API security model (`/api/v1`)

- **Authentication:** `Authorization: Bearer <access token>`. The web's cookie session is not accepted, so cross-site request forgery does not apply.
- **Access token:** signed JWT (HS256), 15 minutes, carries user id, role and device-session id. Signed with `MOBILE_JWT_SECRET`, which must be at least 32 characters and must differ from `NEXTAUTH_SECRET`.
- **Refresh token:** random 256 bits, single use, stored only as a SHA-256 hash. Each refresh returns a new pair. Reusing a spent token revokes the whole sign-in and ends the session. A session also ends 90 days after sign-in however often it was refreshed.
- **Device storage:** iOS Keychain or Android Keystore through `expo-secure-store`, available only while the phone is unlocked and never synced to another device. The environment name is part of the storage key.
- **Authorisation:** every route declares its roles. Routes that move money, change roles or expose personal data also re-check the user and session in the database, because an access token cannot be revoked inside its 15 minutes.
- **Roles:** `CUSTOMER`, `DRIVER`, `ADMIN`, `PARTNER` exist today. `DISPATCHER` and `SUPER_ADMIN` are defined in the API types and are **not yet in the database enum**. Adding values to a Postgres enum is a production schema change and every existing `role === "ADMIN"` check would need review, so it waits for Phase 2 and its own approval. Admin-level roles are not issued mobile sessions until multi-factor sign-in exists.
- **Validation:** every body and query is parsed with a zod schema. Errors name the field and never echo the value.
- **Errors:** one envelope, stable codes. Unexpected errors return a generic message and are logged with a request id.
- **Rate limits:** per route class (see `lib/api/v1/rate-limit.ts`). The in-memory limiter is only a floor on serverless. Sign-in, refresh and password reset need a shared store (Redis or Vercel KV) before launch.
- **Logging:** one JSON line per call with ids, route, status and timing. Keys that look like secrets are redacted at any depth. No request or response body is logged.
- **Audit:** state changes, assignments, refunds, role changes, document approvals and reads of another person's location write to `activity_logs` through `lib/api/v1/audit.ts`.
- **Payments:** the apps never receive card data. They open the existing hosted SumUp checkout. The server confirms every payment through SumUp's API.
- **Prices:** the apps display a number the server sent. They never calculate it. A test fails if pricing-like code appears in the shared packages.

## 4. Reporting a problem

Security issues go to the owner directly (booking@elitebcn.info), not to a public issue.
