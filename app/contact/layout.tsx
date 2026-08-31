import ToastHost from "@/components/layout/ToastHost";
export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Toasts are raised in this segment, so the container lives here
          rather than in the root layout, where it shipped to all 110 pages. */}
      <ToastHost />
    </>
  );
}
