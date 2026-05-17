"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import { DEFAULT_PRICING } from "@/lib/pricing";
import toast from "react-hot-toast";

type PricingRule = {
  vehicleClass: string;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  airportSurcharge: number;
  nightSurcharge: number;
};

export default function AdminPricingPage() {
  const [rules, setRules] = useState<Record<string, PricingRule>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, PricingRule> = {};
    VEHICLE_CATALOG.forEach((v) => {
      const p = DEFAULT_PRICING[v.class];
      init[v.class] = {
        vehicleClass: v.class,
        baseFare: p.baseFare,
        pricePerKm: p.pricePerKm,
        pricePerMinute: p.pricePerMinute,
        minimumFare: p.minimumFare,
        airportSurcharge: 10,
        nightSurcharge: 0.25,
      };
    });
    setRules(init);
  }, []);

  const update = (cls: string, field: keyof PricingRule, value: number) => {
    setRules((r) => ({ ...r, [cls]: { ...r[cls], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.values(rules)),
    });
    setSaving(false);
    if (res.ok) toast.success("Pricing rules saved!");
    else toast.error("Failed to save pricing");
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Pricing Rules</h1>
          <p className="text-dark-400 mt-1">Configure fare calculations per vehicle class</p>
        </div>
        <button onClick={save} disabled={saving}
          className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save All
        </button>
      </div>

      <div className="space-y-4">
        {VEHICLE_CATALOG.map((v) => {
          const r = rules[v.class];
          if (!r) return null;
          return (
            <div key={v.class} className="glass-card rounded-xl p-6">
              <h3 className="text-gold-400 font-medium mb-4">{v.label}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Base Fare (€)", field: "baseFare" },
                  { label: "Per KM (€)", field: "pricePerKm" },
                  { label: "Per Min (€)", field: "pricePerMinute" },
                  { label: "Min Fare (€)", field: "minimumFare" },
                  { label: "Airport (+€)", field: "airportSurcharge" },
                  { label: "Night (%)", field: "nightSurcharge" },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-xs text-dark-400 block mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={r[field as keyof PricingRule]}
                      onChange={(e) => update(v.class, field as keyof PricingRule, parseFloat(e.target.value))}
                      className="input-luxury w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
