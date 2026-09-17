import type { Metadata } from "next";
import ToastHost from "@/components/layout/ToastHost";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The company sign-up sits outside the panel's layout, so it mounts its own toasts. */
export default function PartnerRegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}
