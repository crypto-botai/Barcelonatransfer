"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/** Signs out and returns to the login page pointed at the company panel. */
export default function SwitchAccountButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/auth/login?callbackUrl=/partner" })}
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-gold-500 px-5 text-sm font-semibold text-black hover:bg-gold-400"
    >
      <LogOut size={15} /> Sign out and use company login
    </button>
  );
}
