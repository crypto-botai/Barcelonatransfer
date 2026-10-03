import type { Metadata } from "next";
import WhatsAppInbox from "@/components/admin/whatsapp/WhatsAppInbox";

export const metadata: Metadata = { title: "WhatsApp inbox | Elite BCN Admin" };

export default function WhatsAppInboxPage() {
  return <WhatsAppInbox />;
}
