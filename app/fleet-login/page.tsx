import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SwitchAccountButton from "@/app/fleet-login/SwitchAccountButton";

export const metadata: Metadata = { title: "Fleet company login", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Where /partner sends anyone who is signed in but not as a company.
 *
 * A customer who tapped "Fleet Company Login" in the footer used to land on
 * their own dashboard with no word of why, and read it as the company panel
 * being the wrong thing. This says which account they are in and what the
 * panel needs.
 */
export default async function FleetLoginPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { role?: string; email?: string; name?: string } | undefined;
  if (!session) redirect("/auth/login?callbackUrl=/partner");
  if (u?.role === "PARTNER") redirect("/partner");

  const kind = u?.role === "DRIVER" ? "a driver" : u?.role === "ADMIN" ? "the Elite BCN office" : "a customer";
  const back = u?.role === "DRIVER" ? "/driver" : u?.role === "ADMIN" ? "/admin" : "/dashboard";

  return (
    <main className="min-h-[100dvh] bg-[#0b0a08] px-4 py-16 text-white">
      <div className="mx-auto max-w-md">
        <p className="font-display text-[22px] tracking-[0.28em]">ELITE<span className="text-gold-500">BCN</span></p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-dark-500">Fleet partner panel</p>

        <h1 className="mt-10 font-display text-3xl leading-tight">This account is {kind}, not a fleet company.</h1>
        <p className="mt-4 text-sm leading-relaxed text-dark-300">
          You are signed in as <span className="text-white">{u?.email}</span>. The fleet company panel, where a company
          adds its drivers and dispatches the jobs Elite BCN sends it, opens only with a company login.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-dark-300">
          A company gets its login from Elite BCN by email when the office creates it. Sign out here and sign in with that email.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <SwitchAccountButton />
          <Link href={back} className="inline-flex h-11 items-center rounded-lg border border-white/[0.1] px-4 text-sm text-dark-200 hover:text-white">
            Back to my {u?.role === "DRIVER" ? "driver portal" : u?.role === "ADMIN" ? "admin panel" : "dashboard"}
          </Link>
        </div>
      </div>
    </main>
  );
}
