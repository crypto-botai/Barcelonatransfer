# Admin manual bookings and fleet partner companies — design

Approved by the owner on 2026-09-16.

## Part 1 — Admin manual booking

- Page `/admin/bookings/new`, linked from a "New booking" button on `/admin/bookings`.
- Fields: customer name, email, phone; pickup; drop-off; date; time; passengers; luggage;
  vehicle class; flight number; notes. Price is quoted from the website's pricing
  (`/api/quote`) and may be overridden.
- Booking gains `paymentMethod`: `CARD_LINK | WHATSAPP | CASH | BANK_TRANSFER`, plus
  `paidAt` / `paidMarkedBy` when an admin marks it paid by hand.
- Bookings list shows the method and offers "Mark paid" for non-card methods.
- Customer receives the premium *Booking received* card. With `CARD_LINK` + pending it
  carries the pay link; with `CASH` it says to pay the chauffeur.

## Part 2 — Fleet partner companies

### Data
- `FleetPartner`: name, contactName, email, phone, taxId, bankHolder, bankIban, bizumPhone,
  active, userId (login, role `PARTNER`).
- `Driver.partnerId?` — a company driver is an ordinary Driver owned by a partner and uses
  the existing `/driver` portal. Withdrawals are hidden for partner drivers.
- `Booking.partnerId?`, `Booking.partnerPayout?`, `Booking.partnerAssignedAt?`,
  `Booking.partnerDispatchedAt?`. `Booking.driverAmount` is the price the company chose
  to show its driver.
- `PartnerWithdrawal`: partnerId, amount, method (BANK | BIZUM), bank fields, status
  (PENDING | COMPLETED | TRANSFERRED), notes.
- `Role` gains `PARTNER`; middleware routes `/partner/*` to that role only.

### Admin
- `/admin/partners`: create (temp-password email), list, suspend, view rides/payouts,
  settle withdrawals.
- Dispatch board and booking detail: "Send to fleet company" → partner + payout. Booking
  stays CONFIRMED until the company dispatches. Admin can take the job back.

### Partner panel `/partner`
- Today: rides today / week / month with earnings; next pick-ups.
- Jobs: incoming (shows payout), dispatch to a driver with a driver-facing price
  (defaults to payout), active, completed, cancelled. Mark completed.
- Drivers: add/edit (name, email, phone, licence, vehicle make/model/plate/class) →
  creates the driver's login and emails the temporary password; suspend.
- Payments: completed-ride ledger, available balance, withdrawal requests, history.
- Account: company details and bank account.
- Separate layout; no route into `/admin`.

### Dispatch effects
- Booking → DRIVER_ASSIGNED with `driverId` = company driver.
- Customer: *Chauffeur assigned* card — driver name, phone, vehicle, plate; no company name.
- Admin: alert with company, driver name/email/phone, vehicle make/model/plate, driver price.
- Driver: job sheet with the driver-facing price.
- Partner payout becomes available when the ride is marked completed.

### Emails
Every message is a card in `lib/email/premium.ts`.

## Out of scope
Multiple staff logins per company; partner panel translations; partner drivers
withdrawing from Elite BCN.
