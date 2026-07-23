interface PriceCellProps {
  amount: number;
  wasAmount?: number;
  gold?: boolean;
  className?: string;
}

/** Table cell: current price bold, previous (pre-VAT) price struck with +10% VAT label. */
export default function PriceCell({ amount, wasAmount, gold = false, className = "" }: PriceCellProps) {
  return (
    <td className={`py-3.5 px-3 text-center ${className}`}>
      <span className={`text-sm ${gold ? "font-semibold text-gold-400" : "font-medium text-white"}`}>
        €{amount}
      </span>
      {wasAmount && (
        <span className="block text-[9px] text-dark-500 leading-none mt-0.5">
          <span className="line-through">€{wasAmount}</span>
          {" "}+10% VAT
        </span>
      )}
    </td>
  );
}
