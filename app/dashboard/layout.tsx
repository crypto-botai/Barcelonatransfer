"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MobileDashboardNav from "@/components/dashboard/MobileDashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (status === "loading") {
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

  if (!session) {
    redirect("/auth/login");
  }

  const user = session.user as { id?: string; name?: string; email?: string; role?: string };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden">
      {/* Desktop sidebar */}
      <DashboardSidebar
        userName={user.name ?? user.email}
        memberTier="Gold"
        notificationCount={0}
      />

      {/* Mobile drawer */}
      <MobileDashboardNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        userName={user.name ?? user.email}
        memberTier="Gold"
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          userName={user.name ?? user.email}
          memberTier="Gold"
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
