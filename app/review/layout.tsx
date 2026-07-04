import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rate Your Journey | Élite BCN",
  description: "Share your feedback about your Élite BCN private transfer experience.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.elitebcn.info/review" },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
