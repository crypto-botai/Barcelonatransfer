# Mobile architecture

The customer and driver apps live in the separate repository **`elitebcn-apps`** (a copy of this document is kept there). They are React Native apps built with Expo, TypeScript throughout, for iOS and Android.

## 1. Principles

1. **The server is the source of truth.** The apps display what the server sends. They never calculate a price, a fee, a surcharge, a discount or a refund, and never decide who may see what. A test fails if pricing-like code appears in the shared packages.
2. **No second business engine.** Booking, pricing, payment and notification logic stays in the website's server code. The apps call `/api/v1`.
3. **Production is unreachable from staging.** A build knows its environment and refuses to start pointed at the wrong server.
4. **No secret in the app.** Everything in a shipped app can be read by anyone. Only public settings are in it.
5. **Calm by default.** Short motion, no loops, no background work the person did not choose.

## 2. Repository layout

```
elitebcn-apps/
  apps/
    customer/     Expo app: Welcome, Sign in, Home (empty state), Design check
    driver/       Expo app: same shell, driver theme, background-location config
  packages/
    types/        API envelope, error codes, roles, booking and ride vocabulary, push payloads, tracking shapes
    api-client/   the one HTTP client: bearer auth, refresh, retries, errors
    runtime/      secure token storage, session, version gate, offline, deep links, analytics contract, error boundary
    config/       brand constants, bundle ids, environment resolution and its safety checks
    maps/         tracking rules and contracts (no map SDK yet)
    i18n/         system strings, English and Spanish
    ui/           design tokens and every shared component
```

`runtime` is the one package added beyond the original plan. It holds the device plumbing both apps need (Keychain storage, session, network state, version gate) so it is written once.

Deliberately **not** created: `packages/pricing`, `booking`, `payments`, `notifications`. They would duplicate server logic.

Packages ship their TypeScript source and are consumed directly through npm workspaces. There is no build step for libraries.

## 3. Environments and builds

Each environment is a **different app on the phone**:

| | development | staging | production |
|---|---|---|---|
| Bundle id (iOS) / package (Android) | `info.elitebcn.customer.dev` | `info.elitebcn.customer.staging` | `info.elitebcn.customer` |
| App name | EliteBCN Dev | EliteBCN Staging | EliteBCN |
| Keychain items | own | own | own |
| Server | a local or staging address | staging | `www.elitebcn.info` |

`EXPO_PUBLIC_APP_ENV` and `EXPO_PUBLIC_API_URL` set them at build time. `resolveRuntimeConfig` throws on startup if a production build points at anything but the production site, or any other build points at it. The design-check screens are not reachable in a production build.

## 4. Authentication

```
sign in (email + password, later Apple/Google) ──> POST /api/v1/auth/login   [next phase]
        <── { accessToken (15 min), refreshToken (single use), expiresIn }
store both in the Keychain / Keystore
every call:  Authorization: Bearer <accessToken>
token near expiry, or server says TOKEN_EXPIRED:
        POST /api/v1/auth/refresh { refreshToken } ──> a NEW pair; the old refresh token is spent
refresh token reused or revoked ──> REFRESH_REUSED / TOKEN_INVALID ──> tokens wiped, back to Welcome
```

- One refresh at a time: parallel calls share a single refresh, because the refresh token is single use.
- A dropped network during a refresh keeps the tokens. Only the server saying the session is over signs the person out.
- Storage is `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Never AsyncStorage (lint blocks the import).
- Server side is built in `lib/api/v1/tokens.ts` (website repository). The table that stores refresh-token hashes arrives with the sign-in endpoints.
- Roles in the apps: `CUSTOMER` uses the customer app, `DRIVER` the driver app. Staff and partner roles are not issued mobile sessions. Admin roles need multi-factor sign-in first.

## 5. The API client

`@elitebcn/api-client` is the only code that makes HTTP calls.

- Every outcome is data or an `ApiClientError` with `code`, `status`, `retryable`, `requestId`.
- Reads retry twice with backoff when a retry can help (network, timeout, server error). **Writes are never repeated on their own**; a write that must be safe to repeat carries an `Idempotency-Key`.
- Sends `X-App-Name`, `X-App-Version`, `X-App-Platform` so the server can gate versions and support can see which build a problem came from.
- Refuses non-https addresses except local development hosts.
- Never logs a request, response or token.

## 6. Launch sequence

1. Fonts load and the secure store is read while the splash screen stays up.
2. The version gate asks `GET /api/v1/app-config`. `update_required` shows an update screen in place of the product. A failure to reach the server never blocks the app.
3. Signed out: Welcome. Signed in: Home.
4. An offline banner shows while there is no connection. Screens show their own empty, loading and error states.

## 7. Deep links

`elitebcn://ride/<id>` (customer) and `https://www.elitebcn.info/app/ride/<id>` open a ride. The driver app uses the scheme `elitebcn-driver`. The parser accepts an exact shape and a plain id only. The server re-checks that the signed-in person may see that booking.

## 8. Push notifications (prepared, not built)

- Providers: FCM for Android, APNs for iOS, through `expo-notifications`. The plugin and permission strings are configured.
- Registration will `POST` a device token to `/api/v1/notifications/devices` and remove it at sign-out.
- A push is a **nudge to fetch fresh data**, never the data itself. Payload type: `PushPayload` in `packages/types`.
- `notify()` on the server stays the single fan-out and gains a mobile-push channel. Events: customer (confirmed, assigned, accepted, on the way, nearby, arrived, completed, cancelled, changed), driver (new ride, changed, cancelled, reminder, dispatcher message), admin (new booking, unassigned, driver rejected, driver cancelled, payment issue).
- Android channels and iOS categories are defined when it is built. Permission is requested in context, never at first launch.

## 9. Live tracking (contracts only, nothing runs)

```
Driver app --(HTTPS, batched fixes)--> secure ingest endpoint --> managed realtime provider
                                                                     |--> customer, signed per-booking channel
                                                                     '--> admin live map, role-gated channel
```

Rules, encoded in `packages/maps` and tested:

- **Only an active ride.** `trackingAllowed` is true only while the booking is `DRIVER_ASSIGNED` or `IN_PROGRESS`, the driver is online, and (before they set off) the pickup is within 45 minutes. It is false the moment the ride is completed, cancelled or refunded.
- **Distance filtering.** A fix that moved under 25 m is dropped. Fixes less accurate than 100 m or older than 60 s are dropped.
- **Battery.** Sampling every 45 s while stationary, 15 s en route, 7 s when within 2 km of the pickup, 5 s on the trip.
- **Stops by itself.** The app stops on completion, cancellation, going offline and sign-out. The server independently rejects a fix for a ride that is not active, and the customer's channel grant expires with the ride.
- **Signed per-booking channels.** The server issues each listener a short-lived token for one channel.
- **Privacy.** Raw positions are deleted after 30 days; only a distance summary stays. The driver sees the system's location indicator. The privacy policy and store listings must describe this.
- **Permissions.** Customer app: location while in use only. Driver app: while in use, plus background location, requested only when the driver first accepts a ride, with a plain explanation.

Realtime provider is not chosen yet (Ably, Supabase Realtime or Pusher are candidates). A managed provider is needed because the website runs on serverless functions that cannot hold WebSocket connections.

## 10. Payments

The apps open the **existing hosted SumUp checkout** in a secure in-app browser and never see card data. The server confirms every payment with SumUp. The app then fetches the booking to show the confirmed state. A service ride is not in-app-purchase goods, so the stores allow web checkout.

## 11. Analytics and errors

`Analytics` is a contract with a no-op default: a closed list of event names, identifiers and counts only, never names, emails, phone numbers, addresses, flight numbers or positions. A vendor SDK plugs in behind it later, and only after the person has seen the privacy notice. Crashes in a screen are caught by `AppErrorBoundary`, which shows a calm recovery state and reports the class of error, not its message.

## 12. Quality gates

`npm run typecheck`, `npm run lint`, `npm test` (83 tests today), and a secret scan, in CI on every pull request. A web build of the design check is used to review visuals before a device build.

## 13. What is not built yet

Sign-up, forgot password, booking, payment, ride tracking, notifications, driver onboarding, documents, ride lifecycle, earnings, the app icon and store assets. Phase 2 starts with the auth endpoints and the refresh-token table.
