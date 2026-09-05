import { getAdminRoutes, getPricingSettings } from "@/lib/pricing-service";
import AdminPricingGrid from "./AdminPricingGrid";
import SyncRoutesButton from "@/components/admin/SyncRoutesButton";
import ApplyTablePricesButton from "@/components/admin/ApplyTablePricesButton";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const [routes, settings] = await Promise.all([
    getAdminRoutes(),
    getPricingSettings(),
  ]);

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white">Pricing Editor</h1>
        <p className="text-dark-400 mt-1">
          Edit route prices here — changes go live across the site instantly (cache flushes on save).
        </p>
      </div>
      {/* Renders only when the code has routes the database has not got yet. */}
      <SyncRoutesButton />
      {/* And these when a route the database already has is priced differently
          in code — the case the sync above deliberately ignores.

          One per vehicle, and each renders nothing unless that column actually
          differs, so in the normal case none of them appear. It was minibus
          only at first, which meant a change to any other column had no way of
          reaching the database and simply sat in the code looking applied. */}
      {(["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"] as const).map((code) => (
        <ApplyTablePricesButton key={code} vehicleCode={code} />
      ))}
      <AdminPricingGrid routes={routes} settings={settings} />
    </div>
  );
}
