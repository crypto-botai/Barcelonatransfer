interface PriceCellProps {
  amount: number;
  wasAmount?: number;
  gold?: boolean;
  className?: string;
}

/** Table cell that renders a price with optional strikethrough "was" price and VAT note. */
export default function PriceCell({ amount, wasAmount, gold = false, className = "" }: PriceCellProps) {
  return (
    <td className={`py-3.5 px-3 text-center ${className}`}>
      {wasAmount && (
        <span className="block text-[10px] text-dark-600 line-through leading-none mb-0.5">
          €{wasAmount}
        </span>
      )}
      <span className={`text-sm ${gold ? "font-semibold text-gold-400" : "font-medium text-white"}`}>
        €{amount}
      </span>
      {wasAmount && (
        <span className="block text-[9px] text-green-500/70 leading-none mt-0.5">incl. VAT</span>
      )}
    </td>
  );
}
