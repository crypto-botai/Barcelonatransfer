"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MobileDashboardNav from "@/components/dashboard/MobileDashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [memberTier, setMemberTier] = useState("Standard");
  const router = useRouter();

  const user = session?.user as { id?: string; name?: string; email?: string; role?: string } | undefined;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    } else if (status === "authenticated" && user?.role === "ADMIN") {
      router.replace("/admin");
    } else if (status === "authenticated" && user?.role === "DRIVER") {
      router.replace("/driver");
    }
  }, [status, user?.role, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.memberTier) setMemberTier(d.memberTier); })
      .catch(() => {});
  }, [status]);

  if (status === "loading" || !user || status === "unauthenticated" || user.role === "ADMIN" || user.role === "DRIVER") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl border border-gold-500/30 bg-gold-500/10 flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 rounded bg-gold-500/40" />
          </div>
          <p className="text-dark-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden">
      {/* Desktop sidebar */}
      <DashboardSidebar
        userName={user.name ?? user.email}
        memberTier={memberTier}
        notificationCount={0}
      />

      {/* Mobile drawer */}
      <MobileDashboardNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        userName={user.name ?? user.email}
        memberTier={memberTier}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          userName={user.name ?? user.email}
          memberTier={memberTier}
          notifications={[]}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto bg-[#050505] pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
