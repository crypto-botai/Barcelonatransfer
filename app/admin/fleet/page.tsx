"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Car, Edit2, X, Save } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import toast from "react-hot-toast";

const VEHICLE_CLASSES = VEHICLE_CATALOG.map((v) => ({ value: v.class, label: v.label }));

type Vehicle = {
  id: string; make: string; model: string; year: number; color: string;
  licensePlate: string; class: string; maxPassengers: number; maxLuggage: number;
  isActive: boolean; imageUrl: string | null;
  driver?: { user: { name: string | null } } | null;
};

const DEFAULT_FORM = {
  make: "", model: "", year: new Date().getFullYear(), color: "", licensePlate: "",
  class: "BUSINESS", maxPassengers: 4, maxLuggage: 4, isActive: true,
};

export default function AdminFleetPage() {
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState<Vehicle | null>(null);
  const [form,     setForm]       = useState(DEFAULT_FORM);
  const [saving,   setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/fleet");
    if (res.ok) setVehicles(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(DEFAULT_FORM); setShowForm(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ make: v.make, model: v.model, year: v.year, color: v.color, licensePlate: v.licensePlate, class: v.class, maxPassengers: v.maxPassengers, maxLuggage: v.maxLuggage, isActive: v.isActive });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const url  = editing ? `/api/admin/fleet/${editing.id}` : "/api/admin/fleet";
      const method = editing ? "PATCH" : "POST";
      const body = { ...form, features: [] };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed");
      toast.success(editing ? "Vehicle updated" : "Vehicle added");
      setShowForm(false);
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this vehicle?")) return;
    const res = await fetch(`/api/admin/fleet/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Failed to delete");
  };

  const toggle = async (v: Vehicle) => {
    const res = await fetch(`/api/admin/fleet/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    if (res.ok) { toast.success(v.isActive ? "Deactivated" : "Activated"); load(); }
    else toast.error("Failed");
  };

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Fleet</h1>
          <p className="text-dark-400 mt-1">{vehicles.length} vehicles · {vehicles.filter(v=>v.isActive).length} active</p>
        </div>
        <button onClick={openAdd} className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Vehicle form drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="w-full max-w-md bg-[#0a0a0a] border-l border-white/[0.08] h-full overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h2 className="text-white font-display text-xl">{editing ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Make", key: "make", type: "text", ph: "Mercedes-Benz" },
                { label: "Model", key: "model", type: "text", ph: "E-Class" },
                { label: "Year", key: "year", type: "number", ph: "2023" },
                { label: "Color", key: "color", type: "text", ph: "Black" },
                { label: "License Plate", key: "licensePlate", type: "text", ph: "1234 ABC" },
                { label: "Max Passengers", key: "maxPassengers", type: "number", ph: "4" },
                { label: "Max Luggage", key: "maxLuggage", type: "number", ph: "4" },
              ].map(({ label, key, type, ph }) => (
                <div key={key}>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">{label}</label>
                  <input type={type} value={(form as Record<string, unknown>)[key] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? parseInt(e.target.value) : e.target.value }))}
                    placeholder={ph} className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Vehicle Class</label>
                <select value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: e.target.value }))}
                  className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm">
                  {VEHICLE_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? "bg-green-500" : "bg-white/10"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${form.isActive ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-dark-300">Active</span>
              </div>
              <button onClick={save} disabled={saving}
                className="btn-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 mt-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="text-gold-500 animate-spin" /></div>
      ) : vehicles.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Car size={40} className="text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400 mb-4">No vehicles in your fleet yet.</p>
          <button onClick={openAdd} className="btn-gold px-6 py-3 rounded-xl text-sm font-semibold">Add First Vehicle</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className={`glass-card rounded-xl p-5 transition-opacity ${v.isActive ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-medium">{v.make} {v.model}</p>
                  <p className="text-dark-400 text-xs mt-0.5">{v.year} · {v.color}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${v.isActive ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-500"}`}>
                  {v.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-dark-400 mb-4">
                <p>Plate: <span className="text-white font-mono">{v.licensePlate}</span></p>
                <p>Class: <span className="text-gold-400">{v.class.replace(/_/g, " ")}</span></p>
                <p>Capacity: {v.maxPassengers} pax · {v.maxLuggage} bags</p>
                {v.driver && <p className="text-green-400">Driver: {v.driver.user.name ?? "—"}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(v)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${v.isActive ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : "border-green-500/20 text-green-400 hover:bg-green-500/10"}`}>
                  {v.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => openEdit(v)} className="p-2 rounded-lg border border-white/10 text-dark-400 hover:text-white transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => remove(v.id)} className="p-2 rounded-lg border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
