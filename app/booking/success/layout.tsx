import type { Metadata } from "next";
import ToastHost from "@/components/layout/ToastHost";

export const metadata: Metadata = {
  title: "Booking Confirmed | Elite BCN",
  robots: { index: false, follow: false },
};

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}
