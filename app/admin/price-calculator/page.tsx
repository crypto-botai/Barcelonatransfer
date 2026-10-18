import PriceCalculator from "./PriceCalculator";

export const dynamic = "force-dynamic";

export default function AdminPriceCalculatorPage() {
  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Price Calculator</h1>
        <p className="text-dark-400 mt-1">
          Pick any two places to see what the checkout would charge for every car, with the road route. It uses the same pricing as the booking
          form. Nothing is saved or sent.
        </p>
      </div>
      <PriceCalculator />
    </div>
  );
}
