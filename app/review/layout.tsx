import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rate Your Journey | Elite BCN",
  description: "Share your feedback about your Elite BCN private transfer experience.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.elitebcn.info/review" },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
