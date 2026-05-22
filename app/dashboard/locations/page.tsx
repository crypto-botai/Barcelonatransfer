"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Home, Building, Plane, Star, Plus, Edit2, Trash2, X, Check } from "lucide-react";
import Link from "next/link";

interface SavedLocation {
  id: string;
  type: "home" | "hotel" | "airport" | "favorite";
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

const TYPE_CONFIG = {
  home:     { icon: Home,     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Home" },
  hotel:    { icon: Building, color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       label: "Hotel" },
  airport:  { icon: Plane,    color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",   label: "Airport" },
  favorite: { icon: Star,     color: "text-gold-400",    bg: "bg-gold-500/10 border-gold-500/20",       label: "Favourite" },
};

const DEFAULTS: SavedLocation[] = [
  { id: "bcn-airport", type: "airport", label: "BCN Airport T1",   address: "Barcelona El Prat Airport, Terminal 1, 08820 El Prat de Llobregat" },
  { id: "bcn-airport-t2", type: "airport", label: "BCN Airport T2", address: "Barcelona El Prat Airport, Terminal 2, 08820 El Prat de Llobregat" },
];

export default function LocationsPage() {
  const [locations, setLocations] = useState<SavedLocation[]>(DEFAULTS);
  const [adding, setAdding] = useState(false);
  const [newLoc, setNewLoc] = useState<Partial<SavedLocation>>({ type: "favorite" });

  const remove = (id: string) => setLocations(prev => prev.filter(l => l.id !== id));

  const add = () => {
    if (!newLoc.label || !newLoc.address) return;
    setLocations(prev => [...prev, { id: crypto.randomUUID(), ...newLoc } as SavedLocation]);
    setNewLoc({ type: "favorite" });
    setAdding(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Saved Addresses</h2>
          <p className="text-dark-400 text-sm mt-0.5">Quick access to your favourite locations</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/15 transition-all text-sm font-medium"
        >
          <Plus size={15} /> Add Address
        </button>
      </div>

      {/* Add new form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-2xl p-5 border border-gold-500/20 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">New Address</h3>
              <button onClick={() => setAdding(false)} className="text-dark-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Type */}
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(t => {
                  const { icon: Icon, color, label } = TYPE_CONFIG[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setNewLoc(p => ({ ...p, type: t }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${newLoc.type === t ? `${color} bg-${color.split("-")[1]}-500/10 border-current` : "text-dark-400 border-white/[0.08] hover:border-white/[0.15]"}`}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  );
                })}
              </div>
              <input
                placeholder="Label (e.g. My Hotel)"
                value={newLoc.label ?? ""}
                onChange={e => setNewLoc(p => ({ ...p, label: e.target.value }))}
                className="input-luxury w-full px-4 py-2.5 rounded-xl text-sm"
              />
              <input
                placeholder="Full address"
                value={newLoc.address ?? ""}
                onChange={e => setNewLoc(p => ({ ...p, address: e.target.value }))}
                className="input-luxury w-full px-4 py-2.5 rounded-xl text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-dark-400 hover:text-white text-sm transition-all">
                  Cancel
                </button>
                <button
                  onClick={add}
                  disabled={!newLoc.label || !newLoc.address}
                  className="flex-1 py-2.5 rounded-xl btn-gold text-sm disabled:opacity-50"
                >
                  Save Address
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locations list */}
      {locations.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/[0.06]">
          <MapPin size={36} className="text-dark-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No saved addresses</p>
          <p className="text-dark-400 text-sm mb-5">Save your frequent locations for quick booking.</p>
          <button onClick={() => setAdding(true)} className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
            <Plus size={14} /> Add First Address
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {locations.map((loc, i) => {
            const { icon: Icon, color, bg } = TYPE_CONFIG[loc.type];
            return (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl p-4 sm:p-5 border border-white/[0.06] hover:border-gold-500/20 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl border ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{loc.label}</p>
                    <p className="text-dark-400 text-xs mt-0.5 truncate">{loc.address}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Link
                      href={`/book?pickup=${encodeURIComponent(loc.address)}`}
                      className="px-3 py-1.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/15 transition-all text-xs font-medium"
                    >
                      Book
                    </Link>
                    <button
                      onClick={() => remove(loc.id)}
                      className="p-1.5 rounded-xl text-dark-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
