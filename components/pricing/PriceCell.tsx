interface PriceCellProps {
  amount: number;
  gold?: boolean;
  className?: string;
}

export default function PriceCell({ amount, gold = false, className = "" }: PriceCellProps) {
  return (
    <td className={`py-3.5 px-3 text-center ${className}`}>
      <span className={`text-sm ${gold ? "font-semibold text-gold-400" : "font-medium text-white"}`}>
        €{amount}
      </span>
    </td>
  );
}
