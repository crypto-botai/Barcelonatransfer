# Role model (proposal, nothing implemented)

The plan for adding `DISPATCHER` and `SUPER_ADMIN`, and for admin multi-factor sign-in. **No database or production change is made by this document.** Production schema is untouched until a dedicated database and authentication phase, after staging has proven the design.

## 1. Today

The `Role` enum has `CUSTOMER`, `DRIVER`, `ADMIN`, `PARTNER`. Access is decided by:

- `middleware.ts`: the area each role may open (`/admin`, `/driver`, `/partner`, `/dashboard`), on the production hosts.
- About 117 role comparisons (`role === "ADMIN"` and similar) in about 80 files: roughly 60 in `app/api`, 8 in `app/admin`, and a few in `lib/` (`whatsapp-admin`, `trip-chat`, `partner`, `corporate`) and the layout. 35 route files use the `requireAdmin` helper.
- The session carries the role in the JWT. The JWT callback re-reads the role from the database for OAuth sign-ins.

`ADMIN` is one big role: it can price, refund, assign, message customers and read everything.

## 2. Proposed roles

| Role | Who | Summary |
|---|---|---|
| `CUSTOMER` | a passenger | own bookings and profile |
| `DRIVER` | a chauffeur | rides assigned to them |
| `PARTNER` | a fleet company | its own drivers and the jobs sent to it |
| `DISPATCHER` (new) | operations staff | run the day: bookings, assignment, messaging, live map. **No pricing, refunds, payouts or role changes** |
| `ADMIN` | the office | everything a dispatcher can do, plus pricing, refunds, coupons, customers, reports, drivers' approval. Unchanged meaning |
| `SUPER_ADMIN` (new) | the owner | everything, plus role changes, security settings, integrations and API keys |

`ADMIN` keeps exactly its present meaning, so no existing check changes behaviour.

## 3. Permission matrix

Y = allowed, own = only their own records, - = no.

| Capability | CUSTOMER | DRIVER | PARTNER | DISPATCHER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|
| Create / view own booking | Y | - | - | - | - | - |
| Create a booking for someone | - | - | - | Y | Y | Y |
| View all bookings | - | - | own jobs | Y | Y | Y |
| Edit / cancel any booking | own, within policy | - | - | Y | Y | Y |
| Assign or reassign a driver | - | - | own drivers | Y | Y | Y |
| See driver status and live location | own active ride | self | own drivers | Y | Y | Y |
| Accept / reject an assigned ride, change ride stage | - | own | own | - | Y | Y |
| View a customer's contact details | - | active ride only | active job only | Y | Y | Y |
| Message customers and drivers | - | - | - | Y | Y | Y |
| View payments | own | - | - | view | Y | Y |
| Issue a refund, change a payment | - | - | - | **-** | Y | Y |
| Edit prices, extras, coupons | - | - | - | **-** | Y | Y |
| Approve a driver, verify documents | - | - | - | view | Y | Y |
| Driver payouts, withdrawals | - | own | own | **-** | Y | Y |
| Reports, revenue | - | own earnings | own | limited | Y | Y |
| Manage staff accounts and roles | - | - | - | - | **-** | Y |
| Integrations, API keys, security settings | - | - | - | - | **-** | Y |
| Read the audit log | - | - | - | - | Y | Y |

## 4. Multi-factor sign-in

- **Who:** `ADMIN` and `SUPER_ADMIN` first, then `DISPATCHER`.
- **How:** TOTP authenticator app plus one-time recovery codes, enrolled at next sign-in, with a grace period of 14 days before it is mandatory.
- **Where it applies:** the web admin sign-in and any mobile sign-in for these roles. Until it exists, admin-level roles are **not issued mobile sessions**.
- **Storage:** an encrypted TOTP secret and hashed recovery codes in new tables. No SMS.
- **Re-authentication:** refunds, role changes and API-key changes ask for a fresh code even inside a session.

## 5. Where it touches the code (affected authorisation checks)

| Area | What changes |
|---|---|
| `middleware.ts` | `/admin` must admit `ADMIN`, `SUPER_ADMIN` and `DISPATCHER` (the last with a reduced menu). The role redirects for the other areas must treat the new roles like `ADMIN` where they are staff |
| `lib/whatsapp-admin.ts` (`requireAdmin`), used by 35 route files | Becomes `requirePermission("whatsapp.reply")`. Keep `requireAdmin` as a thin alias for `ADMIN` or `SUPER_ADMIN` during the transition |
| `app/api/admin/**` (50 routes) | Each route names the permission it needs. Pricing, refunds, coupons, withdrawals, API keys and settings routes are `ADMIN`+ only. Booking, dispatch, driver view and messaging routes admit `DISPATCHER` |
| `app/admin/**` pages and layout | Menu items and buttons hide by permission, the server still refuses by permission |
| `lib/trip-chat.ts`, `lib/partner.ts`, `lib/corporate.ts` | Sender and visibility rules that name `ADMIN` |
| `lib/auth.ts` | The JWT carries the new roles. The OAuth re-read of the role from the database already exists |
| `lib/api/v1/*` | Already defines all six roles. Admin-level roles stay blocked from mobile sessions until MFA |
| Tests | `lib/__tests__/route-protection.test.ts` gains the new roles. Its list of admin routes without a check must reach empty first |

A single module, `lib/authz.ts`, will hold `can(role, permission)` and the matrix above, so the 117 scattered comparisons can be replaced gradually by one source of truth.

## 6. Migration plan (database and auth phase, staging first)

1. **Prepare the code, no schema change.** Add `lib/authz.ts` and `requirePermission`. Teach `middleware.ts` and the helpers to treat an unknown role as "no access" (fail closed). Replace the literal checks route by route, each behind the existing tests. Deploy this to production on its own. Behaviour is identical because only `ADMIN` exists.
2. **Prove it on staging.** `ALTER TYPE "Role" ADD VALUE 'DISPATCHER'` and `... 'SUPER_ADMIN'` on the staging database. Create test accounts, walk the matrix by hand, run the route tests for all six roles.
3. **Add the values to production.** `ALTER TYPE ... ADD VALUE` is additive and does not touch existing rows or rewrite tables. It cannot run inside a transaction block together with statements that use the new value. Take a Neon restore point first, apply by hand in a quiet hour, then `prisma generate` through the normal deploy. Existing code that has never seen the new values keeps working because step 1 already fails closed.
4. **Promote people.** Change the owner's role to `SUPER_ADMIN` first, check sign-in, then create or convert dispatchers.
5. **MFA.** New tables, enrolment screen, grace period, then enforcement.
6. **Remove the aliases** only after a release with no remaining literal checks.

## 7. Backwards compatibility

- `ADMIN` is never renamed, split or narrowed. Every account that is `ADMIN` today behaves exactly as now.
- Enum values are never removed or renamed. Rollback of the new values is not needed: an unused enum value is harmless, and the code treats unknown roles as no access.
- Old sessions keep working: the JWT role is read as before.
- The mobile API already accepts all six roles in its types, so an app never has to change for the roles to arrive.
- If anything goes wrong in step 4, the owner's account can be set back to `ADMIN` by hand in the database. That is why the first account to change is the owner's own, with a second admin able to restore it.

## 8. Open questions for the owner

1. Should a dispatcher see customer phone numbers and email, or only the booking contact? (The matrix assumes yes.)
2. Should a dispatcher be able to give a free upgrade or add an extra without a price change? (Assumed no.)
3. Do you want a read-only `ACCOUNTANT` role for reports and invoices later? Easy to add the same way.
