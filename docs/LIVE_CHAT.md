# Live chat

Status: built locally, NOT deployed, NOT verified end to end against a real database or on a device.

## Who sees what

| Message | Customer | Driver | Office (ADMIN) | Fleet company (website only) |
|---|---|---|---|---|
| Shared | yes | yes | yes | yes |
| Private, office to customer | yes | no | yes | no |
| Private, office to driver | no | yes | yes | no |
| Private, customer to office | yes (own) | no | yes | no |
| Private, driver to office | no | yes (own) | yes | no |

The rule is written once, in `visibleTo()` / `canRead()` in `lib/chat.ts`. Every read (messages, unread counts, photos) goes through it.

Private is not end-to-end encryption. Messages are stored in the `trip_messages` table and every ADMIN can read all conversations. The apps say so on screen.

## Safety rules enforced on the server

- Customer and driver routes authorise against the ride first (`requireOwnedRide`, `requireDriverRide`). A ride that is not theirs answers NOT_FOUND, the same as a ride that does not exist.
- Admin routes (`/api/admin/chat/**`) are ADMIN only. There is no staff role below ADMIN yet, so "authorised admin" means ADMIN.
- Text: up to 1,000 characters, control characters removed. Photos: JPEG, PNG or WebP only, type read from the file's bytes, up to 1.5 MB, stored in the database and served only through an authorised route (never a public URL). A photo follows the privacy of its message.
- Duplicate sends: each message carries a `clientId`; the same one again returns the stored message (unique index on booking, sender, clientId).
- Rate limits (per user): sending and photo upload 20 per minute, reading and polling 60 per minute.
- Customers and drivers can write from the time a ride is confirmed until 24 hours after it ends; after that the chat is read-only for them. The office can always write.
- Push notifications (`CHAT_MESSAGE`) say who wrote and never contain the message. Private and shared look the same, so a notification does not reveal that a message is private.
- Audit (activity_logs): admin opens a conversation (`CHAT_VIEW`), sends shared (`CHAT_SEND_SHARED`) or private (`CHAT_SEND_PRIVATE`), opens a photo (`CHAT_PHOTO_VIEW`); customers and drivers sending a private message (`API_V1_CHAT_PRIVATE_SEND`). Message text is never written to the log.

## Retention

Chat messages and photos are deleted 180 days after the ride ended (`CHAT_RETENTION_DAYS` in `lib/chat.ts`). `purgeExpiredChats()` does it; nothing calls it yet. Wire it to the daily cron when the period is agreed. Bookings are never touched.

## Before it can go live

1. Schema: `npx prisma db push` (additive: `ChatScope` enum, columns `scope`, `toParty`, `clientId`, `attachmentId`, `adminUserId` and two indexes on `trip_messages`, tables `trip_chat_attachments` and `trip_chat_reads`). Existing rows become SHARED. Review the diff first; do not run it from this document.
2. No new environment variables.
3. Deploy the website, then build the apps (the apps need the new endpoints).
4. Verify with two real accounts and a real ride on staging: customer to driver, driver to customer, admin shared, admin private to each, photo, offline retry, push tap.
5. Wire `purgeExpiredChats()` to the cron.
