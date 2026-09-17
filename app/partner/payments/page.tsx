"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Empty, PageTitle, Sheet, Skeleton, euro, field, label, primary, whenParts } from "@/components/partner/ui";

type Data = {
  balance: { totalEarned: number; totalWithdrawn: number; available: number; completedRides: number };
  withdrawals: { id: string; amount: number; method: string; bankIban: string | null; bizumPhone: string | null; status: string; createdAt: string; notes: string | null }[];
  ledger: { id: string; confirmationCode: string; pickupAddress: string; dropoffAddress: string; pickupDatetime: string; rideEndedAt: string | null; partnerPayout: number | null; driverAmount: number | null; driver: { user: { name: string | null } } | null }[];
};
type Me = { bankIban: string | null; bankHolder: string | null; bizumPhone: string | null };

export default function PartnerPaymentsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [asking, setAsking] = useState(false);
  const [tab, setTab] = useState<"ledger" | "withdrawals">("ledger");

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/partner/withdrawals"), fetch("/api/partner/me")]);
    if (a.ok) setD(await a.json());
    if (b.ok) setMe(await b.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageTitle title="Payments" sub="A ride earns its payout when it is completed. Withdraw whenever you like." />

      {!d ? <Skeleton rows={1} h={140} /> : (
        <section className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="bg-[#0f0e0b] px-6 py-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-dark-500">Available to withdraw</p>
            <p className="mt-2 font-display text-[52px] leading-none text-gold-400 tabular-nums">{euro(d.balance.available)}</p>
            <p className="mt-3 text-sm text-dark-400">{d.balance.completedRides} completed ride{d.balance.completedRides === 1 ? "" : "s"} · {euro(d.balance.totalEarned)} earned in total</p>
            <button type="button" onClick={() => setAsking(true)} disabled={d.balance.available <= 0} className={`${primary} mt-6`}>
              <ArrowUpRight size={16} /> Request withdrawal
            </button>
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/[0.06] bg-[#0b0a08]">
            <div className="px-5 py-7">
              <p className="text-[10px] uppercase tracking-[0.2em] text-dark-500">Withdrawn</p>
              <p className="mt-2 font-display text-2xl text-white tabular-nums">{euro(d.balance.totalWithdrawn)}</p>
            </div>
            <div className="px-5 py-7">
              <p className="text-[10px] uppercase tracking-[0.2em] text-dark-500">Requested</p>
              <p className="mt-2 font-display text-2xl text-white tabular-nums">{euro(d.withdrawals.filter((w) => w.status === "PENDING").reduce((s, w) => s + w.amount, 0))}</p>
              <p className="mt-1 text-[11px] text-dark-500">waiting for Elite BCN</p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-8 mb-4 flex gap-1 border-b border-white/[0.08]" role="tablist">
        {(["ledger", "withdrawals"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 px-4 text-sm capitalize ${tab === t ? "border-b-2 border-gold-500 text-white" : "text-dark-400 hover:text-white"}`}>
            {t === "ledger" ? "Completed rides" : "Withdrawals"}
          </button>
        ))}
      </div>

      {!d ? <Skeleton rows={4} /> : tab === "ledger" ? (
        d.ledger.length === 0 ? <Empty title="No completed ride yet" body="Once a dispatched job is marked completed, its payout is listed here and added to your balance." /> : (
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {d.ledger.map((r) => {
              const w = whenParts(r.pickupDatetime);
              return (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] tracking-wider text-gold-400">{r.confirmationCode} <span className="ml-2 font-sans text-dark-500">{w.day}</span></p>
                    <p className="truncate text-sm text-white">{r.pickupAddress} <span className="text-dark-500">to</span> {r.dropoffAddress}</p>
                    <p className="text-xs text-dark-500">{r.driver?.user.name ?? "Driver"}{r.driverAmount != null ? ` · driver paid ${euro(r.driverAmount)}` : ""}</p>
                  </div>
                  <p className="font-display text-xl text-gold-400 tabular-nums">{euro(r.partnerPayout)}</p>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        d.withdrawals.length === 0 ? <Empty title="No withdrawal yet" body="Request one from your available balance. Elite BCN pays it to your bank or Bizum and it shows as paid here." /> : (
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {d.withdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-display text-xl text-white tabular-nums">{euro(w.amount)}</p>
                  <p className="text-xs text-dark-400">{w.method === "BANK" ? `Bank transfer · ${w.bankIban ?? ""}` : `Bizum · ${w.bizumPhone ?? ""}`}</p>
                  <p className="text-[11px] text-dark-500">{new Date(w.createdAt).toLocaleDateString("en-GB", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`inline-flex h-6 items-center rounded-lg border px-2 text-[11px] font-medium ${w.status === "PENDING" ? "border-gold-500/40 text-gold-300 bg-gold-500/10" : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"}`}>
                  {w.status === "PENDING" ? "Requested" : "Paid"}
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      <WithdrawSheet open={asking} available={d?.balance.available ?? 0} me={me} onClose={() => setAsking(false)} onDone={() => { setAsking(false); load(); }} />
    </div>
  );
}

function WithdrawSheet({ open, available, me, onClose, onDone }: { open: boolean; available: number; me: Me | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"BANK" | "BIZUM">("BANK");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setAmount(String(available)); }, [open, available]);

  const hasBank = Boolean(me?.bankIban);
  const hasBizum = Boolean(me?.bizumPhone);
  const n = parseFloat(amount);
  const ready = n > 0 && n <= available + 0.001 && (method === "BANK" ? hasBank : hasBizum);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/partner/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: n, method }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success("Requested. Elite BCN has been notified.");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Request withdrawal">
      <div className="space-y-5">
        <div>
          <label htmlFor="w-amount" className={label}>Amount (€)</label>
          <input id="w-amount" type="number" min={1} step="0.01" max={available} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} font-display text-2xl`} />
          <p className="mt-1.5 text-xs text-dark-500">{euro(available)} available.</p>
        </div>
        <div>
          <p className={label}>Pay to</p>
          <div className="grid grid-cols-2 gap-2">
            {(["BANK", "BIZUM"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${method === m ? "border-gold-500/60 bg-gold-500/[0.08] text-white" : "border-white/[0.1] text-dark-300 hover:border-white/20"}`}>
                <span className="block">{m === "BANK" ? "Bank transfer" : "Bizum"}</span>
                <span className="block text-xs text-dark-500">{m === "BANK" ? (me?.bankIban ?? "No IBAN on file") : (me?.bizumPhone ?? "No number on file")}</span>
              </button>
            ))}
          </div>
          {((method === "BANK" && !hasBank) || (method === "BIZUM" && !hasBizum)) && (
            <p className="mt-2 text-xs text-amber-300">Add your {method === "BANK" ? "IBAN" : "Bizum number"} under <Link href="/partner/account" className="underline">Account</Link> first.</p>
          )}
        </div>
        <button type="button" onClick={submit} disabled={!ready || busy} className={`${primary} w-full`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />} Send request
        </button>
        <p className="text-xs text-dark-500">Elite BCN settles requests by bank transfer or Bizum and marks them paid here.</p>
      </div>
    </Sheet>
  );
}
