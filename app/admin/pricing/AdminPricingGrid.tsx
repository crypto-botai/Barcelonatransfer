"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

const CODES = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"] as const;
type VehicleCode = (typeof CODES)[number];

const CODE_LABELS: Record<VehicleCode, string> = {
  ECONOMY:  "Economy",
  BUSINESS: "Business",
  MINIVAN:  "Minivan",
  VCLASS:   "V-Class",
  MINIBUS:  "Minibus",
};

type PriceRow = { vehicleCode: string; price: number; updatedBy: string | null; updatedAt: Date };

interface AdminRoute {
  id:        string;
  slug:      string;
  label:     string;
  category:  string;
  note:      string | null;
  sortOrder: number;
  active:    boolean;
  prices:    PriceRow[];
}

interface Setting {
  key:   string;
  label: string;
  value: string;
}

interface Props {
  routes:   AdminRoute[];
  settings: Setting[];
}

type DraftPrices = Record<string, Record<VehicleCode, number>>;

function buildDraft(routes: AdminRoute[]): DraftPrices {
  const draft: DraftPrices = {};
  for (const r of routes) {
    draft[r.id] = {} as Record<VehicleCode, number>;
    for (const code of CODES) {
      draft[r.id][code] = r.prices.find((p) => p.vehicleCode === code)?.price ?? 0;
    }
  }
  return draft;
}

function diffDraft(original: AdminRoute[], draft: DraftPrices) {
  const changes: { routeId: string; vehicleCode: VehicleCode; price: number }[] = [];
  for (const r of original) {
    for (const code of CODES) {
      const orig = r.prices.find((p) => p.vehicleCode === code)?.price ?? 0;
      const next = draft[r.id]?.[code] ?? 0;
      if (orig !== next) changes.push({ routeId: r.id, vehicleCode: code, price: next });
    }
  }
  return changes;
}

const CATEGORY_LABELS: Record<string, string> = {
  "airport":      "Airport & City",
  "costa-dorada": "Costa Dorada",
  "costa-brava":  "Costa Brava",
};

export default function AdminPricingGrid({ routes, settings }: Props) {
  const [draft,  setDraft]  = useState<DraftPrices>(() => buildDraft(routes));
  const [saved,  setSaved]  = useState(false);
  const [pending, startSave] = useTransition();

  const change = (routeId: string, code: VehicleCode, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    setDraft((d) => ({ ...d, [routeId]: { ...d[routeId], [code]: n } }));
    setSaved(false);
  };

  const save = () => {
    const changes = diffDraft(routes, draft);
    if (changes.length === 0) { toast("No changes to save."); return; }

    startSave(async () => {
      const res = await fetch("/api/admin/pricing", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(changes),
      });
      if (res.ok) {
        setSaved(true);
        toast.success(`Saved ${changes.length} price change${changes.length > 1 ? "s" : ""}. Cache flushed.`);
      } else {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(error ?? "Save failed");
      }
    });
  };

  // Group routes by category
  const groups = Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => ({
    cat, catLabel,
    rows: routes.filter((r) => r.category === cat),
  }));

  return (
    <div className="space-y-8">
      {/* Settings (read-only display) */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-white text-sm font-semibold mb-3">Surcharge Settings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
          {settings.map((s) => (
            <div key={s.key} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
              <p className="text-dark-400 mb-1">{s.label}</p>
              <p className="text-gold-400 font-semibold text-base">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="text-dark-600 text-xs mt-3">Surcharge settings are read-only here. Edit them in <code>.env.local</code> or the DB directly.</p>
      </div>

      {/* Route price tables */}
      {groups.map(({ cat, catLabel, rows }) => rows.length === 0 ? null : (
        <div key={cat} className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-white text-sm font-semibold">{catLabel}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-4 text-xs text-dark-400 font-medium">Route</th>
                  {CODES.map((c) => (
                    <th key={c} className="text-center py-3 px-3 text-xs text-dark-400 font-medium w-28">
                      {CODE_LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const origPrices = Object.fromEntries(
                    r.prices.map((p) => [p.vehicleCode, p.price])
                  );
                  return (
                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 text-dark-200">
                        {r.label}
                        {r.note && <span className="ml-2 text-dark-500 text-xs">({r.note})</span>}
                      </td>
                      {CODES.map((code) => {
                        const orig = origPrices[code] ?? 0;
                        const val  = draft[r.id]?.[code] ?? 0;
                        const dirty = val !== orig;
                        return (
                          <td key={code} className="py-2 px-2 text-center">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-dark-400 text-xs pointer-events-none">€</span>
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                value={val}
                                onChange={(e) => change(r.id, code, e.target.value)}
                                className={`w-20 pl-5 pr-2 py-1.5 rounded-lg text-center text-sm border transition-colors
                                  ${dirty
                                    ? "border-gold-500/60 bg-gold-500/5 text-gold-300"
                                    : "border-white/[0.08] bg-white/[0.03] text-dark-200"
                                  } focus:outline-none focus:border-gold-500`}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Save bar */}
      <div className="sticky bottom-6 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="btn-gold flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold shadow-xl"
        >
          {pending ? (
            <><Loader2 size={16} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle size={16} /> Saved</>
          ) : (
            <><Save size={16} /> Save Changes</>
          )}
        </button>
      </div>
    </div>
  );
}
