import type { Metadata } from "next";
import WhatsAppSettingsPage from "@/components/admin/whatsapp/WhatsAppSettingsPage";

export const metadata: Metadata = { title: "WhatsApp settings | Elite BCN Admin" };

export default function Page() {
  return <WhatsAppSettingsPage />;
}
