# Mobile API, version 1

The contract between the EliteBCN apps and the server. The source of truth for the types is `lib/api/v1/types.ts`; the apps keep a copy in `packages/types` (repository `elitebcn-apps`). Change the server file first, additively, then mirror it.

## 1. Principles

1. **The server is the source of truth.** Prices, availability, status and permission are decided here. The apps display them.
2. **Additive evolution.** Add fields and endpoints. Never remove, rename or retype one in v1. A breaking change becomes `/api/v2`, and v1 keeps working until old apps are gone.
3. **Reuse, do not duplicate.** Endpoints call the existing booking, pricing and payment code (`getQuote`, the booking and SumUp logic). They do not copy it.
4. **Boring and predictable.** One envelope, one error shape, stable codes.

## 2. What exists today

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/v1/health` | none | Is the API up, and which environment is it (`production`, `staging`, ...). No database call |
| `GET /api/v1/app-config?app=&platform=&version=` | none | Version gate: `ok`, `update_available`, `update_required`, plus store link. Add `&strict=1` to receive `UPGRADE_REQUIRED` (426) instead |

Everything else below is planned and **not built**.

| Area | Planned endpoints |
|---|---|
| `/api/v1/auth/*` | `login`, `register`, `refresh`, `logout`, `forgot-password`, `reset-password` |
| `/api/v1/quote` | quote for one-way, return, hourly (calls `getQuote`) |
| `/api/v1/bookings/*` | create, list, detail, cancel, rate |
| `/api/v1/customer/*` | upcoming and past rides, active ride |
| `/api/v1/driver/*` | profile, documents, online/offline, assigned rides, accept/reject, stage changes |
| `/api/v1/tracking/*` | secure ingest (driver), channel grant (customer, staff) |
| `/api/v1/notifications/*` | device registration, preferences |
| `/api/v1/payments/*` | create hosted SumUp checkout, status |
| `/api/v1/profile/*` | profile, language, delete account |

## 3. Envelope

```json
{ "ok": true,  "data": { },  "meta": { "requestId": "…", "apiVersion": "v1" } }
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "…", "details": [{ "path": "email", "message": "…" }], "retryable": false, "retryAfterSeconds": 30 }, "meta": { … } }
```

Every response carries `Cache-Control: no-store`, `X-Request-Id` (the same as `meta.requestId`), `X-Api-Version`, `X-Robots-Tag: noindex` and `X-Content-Type-Options: nosniff`. A rate-limited response also carries `Retry-After`. No CORS headers are sent: the apps are not browsers.

## 4. Error codes (append only)

| Code | HTTP | Retry? | Meaning for the app |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | no | Show the field problems in `details` |
| `UNAUTHENTICATED` | 401 | no | Not signed in |
| `TOKEN_EXPIRED` | 401 | no | Refresh the access token, repeat the call once |
| `TOKEN_INVALID` | 401 | no | Sign in again |
| `REFRESH_REUSED` | 401 | no | The session was ended for safety. Sign in again |
| `FORBIDDEN` | 403 | no | This role may not do this |
| `NOT_FOUND` | 404 | no | |
| `METHOD_NOT_ALLOWED` | 405 | no | |
| `CONFLICT` | 409 | no | The state changed. Reload |
| `UPGRADE_REQUIRED` | 426 | no | Show the update screen |
| `RATE_LIMITED` | 429 | yes | Wait `retryAfterSeconds` |
| `INTERNAL` | 500 | no | Generic message. Quote `requestId` to support |
| `NOT_IMPLEMENTED` | 501 | no | |
| `UPSTREAM_FAILED` | 502 | yes | A service the server depends on failed |
| `UNAVAILABLE` | 503 | yes | |

`message` is safe to show a person. It never contains a secret, a query or a stack trace. The client adds `NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE`, `SESSION_LOST` and `ABORTED` for failures that never reached the server.

## 5. Authentication

```
POST /api/v1/auth/login   { email, password } ──> { accessToken, refreshToken, expiresIn }       [next phase]
every call:               Authorization: Bearer <accessToken>
near expiry or TOKEN_EXPIRED:
POST /api/v1/auth/refresh { refreshToken }    ──> a NEW pair; the old refresh token is spent       [next phase]
```

- Access token: JWT HS256, 15 minutes, claims `sub`, `role`, `sid` (device session), `iss`, `aud`, `iat`, `exp`, `jti`. Signed with `MOBILE_JWT_SECRET`.
- Refresh token: 256 random bits, single use, only its SHA-256 hash is stored. A replayed token revokes the whole sign-in family. A session ends 90 days after sign-in.
- Built and tested now: `lib/api/v1/tokens.ts`. The storage table arrives with the sign-in endpoints.
- The web's cookie session is **not** accepted on `/api/v1`.

## 6. Authorisation

Each route is declared with `apiHandler(route, handler, { auth: { roles: [...] } })`. A route that is public says `auth: false` explicitly. Sensitive routes add `recheck` to confirm the user and session still exist and still hold the role (an access token cannot be revoked inside its 15 minutes). A customer reaches only their own bookings, a driver only rides assigned to them and the permitted driver data, staff according to `docs/ROLES.md`. Ownership is checked on every object, not only on the route.

## 7. Request validation

Every body and query is parsed with a zod schema (`lib/api/v1/validate.ts`). Bodies larger than 64 KB are refused. Failures list the field `path` and a message and **never echo the value**.

## 8. Idempotency

A write that creates a booking or takes a payment accepts an `Idempotency-Key` header. The server keeps the result for 24 hours and returns it for a repeat, so a retry after a dropped connection cannot book or charge twice. The client never retries a write by itself.

## 9. Rate limiting

**Today:** a per-instance limiter behind an interface (`lib/api/v1/rate-limit.ts`). On serverless this is a floor that stops a runaway loop on one instance, not a control against a determined caller. It is not replaced in this phase.

**Required before any public mobile launch:** a shared store (managed Redis or Vercel KV) implementing the same interface, plus a Vercel Firewall rate-limit rule as an outer layer. Route classes and starting limits:

| Class | Key | Starting limit |
|---|---|---|
| Sign-in | IP **and** account, both must pass | 5 per minute, 20 per hour per account |
| Register | IP | 5 per hour |
| Forgot / reset password | email and IP | 3 per hour per email, 10 per hour per IP |
| Token refresh | session id | 30 per minute |
| Quote and place search | user, or IP when guest | 60 per minute |
| Create booking / create payment | user | 10 per hour / 5 per minute |
| Driver GPS ingest | session id | 60 per minute |
| Other public reads | IP | 120 per minute |
| Other authenticated | user | 240 per minute |

Also required with the shared store: temporary lockout after repeated sign-in failures, and a bot challenge on register and forgot-password. All of the sign-in, register, password and refresh routes of the future `/api/v1/auth/*` need the shared store from the day they exist. The existing website's own public endpoints are reviewed separately.

## 10. Logging and audit

- **Logs:** one JSON line per call: request id, method, route, status, duration, user id and role when known, error code. Keys that look like secrets (`authorization`, `token`, `password`, `refresh`, `card`, `iban`, `apiKey`, ...) are redacted at any depth. No request or response body is logged.
- **Audit:** state changes, driver assignment and rejection, refunds and payment changes, document approvals, role changes, sign-in, sign-out and refresh reuse, and every read of another person's location are written to the existing `activity_logs` table through `lib/api/v1/audit.ts`. A failure to write an audit entry is logged loudly but never fails the request.

## 11. Versioning and app support

- The path carries the version. `GET /api/v1/app-config` tells each app at launch whether its version is supported. Minimum and latest versions per app and platform are environment variables (`MOBILE_CUSTOMER_IOS_MIN_VERSION`, ...), changeable without a deploy.
- The apps send `X-App-Name`, `X-App-Version`, `X-App-Platform` with every request.
- A removed or incompatible behaviour is announced one release ahead through `update_available`, then enforced with `update_required`.

## 12. Environments

The same API runs in staging (`APP_ENV=staging`, synthetic data) and production. A production app build refuses to start against any address but the production site, and every other build refuses to start against it. `GET /api/v1/health` names the environment so a build and a person can confirm which one they are talking to.

## 13. Prices

No `/api/v1` response lets a client compute a price. The server returns the final amount in cents plus a display breakdown. The apps display it. The mobile packages contain no pricing code, and a test fails if any appears.

## Endpoints built (phases 3 to 5)

All answer in the standard envelope. Bearer token unless marked public.

| Method and path | Who | What |
|---|---|---|
| POST /auth/login | public | email, password, app (customer or driver). Returns access token (15 min), refresh token (single use), user, mustChangePassword |
| POST /auth/register | public | Creates a CUSTOMER and signs them in. Drivers apply through the office |
| POST /auth/refresh | public | Spends a refresh token for a new pair. Re-reads the account: a suspended driver loses the session here |
| POST /auth/logout | public | Revokes the session family. Same answer for unknown tokens |
| GET /me | any | Fresh account state, re-applies the sign-in rules |
| POST /devices, DELETE /devices | any | Register or remove an Expo push token |
| POST /quotes | public | The website's own quote function, unchanged |
| POST /bookings | CUSTOMER | The website's own booking handler, as the caller. Returns bookingId, checkoutUrl (hosted SumUp page) or ARRANGED |
| GET /rides?scope= | CUSTOMER | Own rides (upcoming, past, all) |
| GET /rides/:id | CUSTOMER | One own ride, with the assigned driver once there is one. Anyone else's: NOT_FOUND |
| POST /rides/:id/cancel | CUSTOMER | The website's cancellation and refund policy, unchanged |
| POST /rides/:id/pay | CUSTOMER | A SumUp checkout for an unpaid ride |
| POST /rides/:id/rating | CUSTOMER | Once, when completed |
| GET /rides/:id/track | CUSTOMER | Latest driver position, only while the driver is on the way or the trip is under way |
| GET /driver/rides?scope= | DRIVER | pending, today, upcoming, past; only the caller's own |
| GET /driver/rides/:id | DRIVER | One own ride. No customer price, no office notes |
| POST /driver/rides/:id/respond | DRIVER | ACCEPT or REJECT (a rejection returns the ride to the dispatcher and tells the office) |
| POST /driver/rides/:id/stage | DRIVER | The one-tap stages, through the website's ride handler. Needs an accepted ride |
| POST /driver/location | DRIVER | One position fix, accepted only for an accepted, live ride |
| GET and POST /driver/status | DRIVER | Availability |
| GET /driver/earnings | DRIVER | Own payout today, this week, this month |

### How the website's rules are reused

`lib/request-session.ts` gives the website's handlers one line, `getRequestSession()`, in place of `getServerSession`. On the website it returns the cookie session exactly as before. A /api/v1 route verifies the bearer token, then runs the handler inside `runAsActor`, and the handler sees that person. Only `app/api/v1` and `lib/api/v1` may import `runAsActor`; a test enforces it. Five handlers were changed by that one line: booking creation, cancellation, the driver ride stage, driver status and the driver position ping.

### Database additions (additive, applied to staging only)

- `mobile_refresh_tokens`, `mobile_devices`: new tables.
- `bookings.driverResponse`, `driverRespondedAt`, `driverResponseBy`: three nullable columns. An answer counts only while `driverResponseBy` is the booking's current driver, so reassigning a ride needs no reset.

Neither is applied to production. `prisma db push` on production needs its own approval.

### More endpoints (later in phases 3 to 11)

| Method and path | Who | What |
|---|---|---|
| POST /auth/forgot-password | public | The website's reset email. Same answer for any address |
| POST /auth/change-password | CUSTOMER, DRIVER | Signs every other phone out and returns a fresh session |
| DELETE /me | CUSTOMER, DRIVER | Delete the account (password asked again) |
| GET /catalog | public | Fleet and extras, from the same lists as the website |
| GET /places?q= | public | The website's address search |
| POST /quotes/checkout | CUSTOMER | The exact total of this booking: the website's booking handler in dry-run mode |

Push: `notify()` also reaches the apps (Expo push service) for the customer and driver moments that push on the web. Payloads carry only the event and the booking id.

`POST /bookings` honours an `Idempotency-Key` header: the same key from the same account returns the booking already made.

## Release order for the mobile work (important)

The additive schema (two new tables and three nullable columns on bookings) must be applied to the production database BEFORE the code that reads it is deployed. Prisma selects every column of a model unless told otherwise, so a deployment that knows the new `bookings` columns, running against a database that does not have them yet, fails on pages that read bookings. The order is therefore:

1. Back up. Apply the additive change (`prisma db push`, additive only, no data touched) in a quiet hour.
2. Deploy the code.
3. Verify (sign in from a test account, read a ride, the admin dispatch board).

None of this is applied. Each step needs its own approval.
