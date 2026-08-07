import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";
import NotificationsList, { type NotificationItem } from "@/components/dashboard/NotificationsList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login");

  const rows = await listNotifications(userId);

  const initial: NotificationItem[] = rows.map((n) => ({
    id:        n.id,
    type:      n.type,
    title:     n.title,
    body:      n.body,
    read:      n.read,
    createdAt: n.createdAt.toISOString(),
    bookingId: (n.data as { bookingId?: string } | null)?.bookingId ?? null,
  }));

  return (
    <NotificationsList
      initial={initial}
      // Empty string when push is not configured; the toggle then renders
      // nothing rather than offering a button that cannot work.
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    />
  );
}
