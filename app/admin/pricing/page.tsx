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
      {/* And this one when a route the database already has is priced
          differently in code — the case the sync above deliberately ignores. */}
      <ApplyTablePricesButton vehicleCode="MINIBUS" />
      <AdminPricingGrid routes={routes} settings={settings} />
    </div>
  );
}
