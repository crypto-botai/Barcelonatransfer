import { getAdminRoutes, getPricingSettings } from "@/lib/pricing-service";
import AdminPricingGrid from "./AdminPricingGrid";

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
      <AdminPricingGrid routes={routes} settings={settings} />
    </div>
  );
}
