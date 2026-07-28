"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Client cart, persisted to localStorage. Foundation for build-order step 3
 * (cart + checkout). Step 2 uses `add` (from the product buy panel) and `count`
 * (the header badge). The cart must survive the redirect to Vipps and back, so
 * localStorage is the right home; a server-side cart row is added in step 3
 * (03-api-and-payments.md — "Cart belongs in localStorage plus a server-side
 * cart row").
 */
export type CartLine = {
  variantId: string;
  slug: string;
  titleNo: string;
  titleEn: string | null;
  colorNo: string;
  colorEn: string;
  sizeLabel: string;
  unitPrice: number; // øre, gross
  tileBg: string;
  mockupUrl: string | null;
  qty: number;
};

type CartValue = {
  lines: CartLine[];
  count: number;
  hydrated: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);
const STORAGE_KEY = "fc_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const firstRender = useRef(true);

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* corrupt storage — start empty */
    }
    setHydrated(true);
  }, []);

  // Persist on change (but not on the initial empty render before hydration).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore quota errors */
    }
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === line.variantId);
      if (i === -1) return [...prev, { ...line, qty }];
      return prev.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.variantId === variantId ? { ...l, qty: Math.max(1, qty) } : l,
      ),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((a, l) => a + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({ lines, count, hydrated, add, setQty, remove, clear }),
    [lines, count, hydrated, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
