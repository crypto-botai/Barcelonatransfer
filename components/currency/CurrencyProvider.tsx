"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type DisplayCurrency,
  type RateTable,
  displayPrice,
  resolveDisplayCurrency,
} from "@/lib/currency";

const STORAGE_KEY = "elitebcn.currency";

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  /** Null when the ECB feed was unreachable — the switcher hides itself. */
  table: RateTable | null;
  /** Formats a EUR amount into the selected display currency. */
  format: (amountEur: number) => { eur: string; converted: string | null };
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  table,
  children,
}: {
  table: RateTable | null;
  children: React.ReactNode;
}) {
  // Always starts on EUR so the server and first client render agree; a stored
  // preference is applied after mount. Reading localStorage during render would
  // hydrate-mismatch every price on the page.
  const [currency, setCurrencyState] = useState<DisplayCurrency>("EUR");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setCurrencyState(resolveDisplayCurrency(stored));
    } catch {
      // Private browsing or blocked storage: EUR is a fine outcome.
    }
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* preference simply won't persist */
    }
  }, []);

  const format = useCallback(
    (amountEur: number) => {
      const p = displayPrice(amountEur, currency, table);
      return { eur: p.eur, converted: p.converted };
    },
    [currency, table],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, table, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Returns null outside a provider rather than throwing, so PriceCell and the
 * rest of the price components stay usable on pages that have not adopted the
 * switcher. Those pages simply render EUR.
 */
export function useCurrency(): CurrencyContextValue | null {
  return useContext(CurrencyContext);
}
