import type { Metadata } from "next";
import ToastHost from "@/components/layout/ToastHost";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Toasts are raised in this segment, so the container lives here
          rather than in the root layout, where it shipped to all 110 pages. */}
      <ToastHost />
    </>
  );
}
