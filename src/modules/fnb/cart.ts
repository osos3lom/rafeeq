import { MENUS } from '../../data/menu';
import type { FnbLine, MenuItem } from '../../domain/types';
import { createStore, round2 } from '../../lib/store';

// F&B module: menu + cart + favorites. Deliberately knows nothing about
// fueling or payments — the orders module composes it into a bill.

export interface CartLine {
  itemId: string;
  qty: number;
}

interface CartState {
  menuId: string | null;
  lines: CartLine[];
  favorites: string[];
  /** Last placed café order — powers one-tap "my usual". */
  usual: CartLine[];
}

export const cartStore = createStore<CartState>({ menuId: null, lines: [], favorites: [], usual: [] }, 'cart');

export const menuFor = (menuId: string | null): MenuItem[] => (menuId ? (MENUS[menuId] ?? []) : []);

export function itemById(id: string): MenuItem | undefined {
  for (const menu of Object.values(MENUS)) {
    const found = menu.find((i) => i.id === id);
    if (found) return found;
  }
  return undefined;
}

export function setCartMenu(menuId: string) {
  // Switching station menus starts a fresh cart.
  if (cartStore.get().menuId !== menuId) cartStore.set({ menuId, lines: [] });
}

export function changeQty(itemId: string, delta: number) {
  cartStore.set((s) => {
    const existing = s.lines.find((l) => l.itemId === itemId);
    if (!existing) return delta > 0 ? { lines: [...s.lines, { itemId, qty: delta }] } : {};
    const qty = existing.qty + delta;
    return { lines: qty > 0 ? s.lines.map((l) => (l.itemId === itemId ? { ...l, qty } : l)) : s.lines.filter((l) => l.itemId !== itemId) };
  });
}

export const clearCart = () => cartStore.set({ lines: [] });

export function toggleFavorite(itemId: string) {
  cartStore.set((s) => ({
    favorites: s.favorites.includes(itemId) ? s.favorites.filter((f) => f !== itemId) : [...s.favorites, itemId],
  }));
}

export const rememberUsual = (lines: CartLine[]) => cartStore.set({ usual: lines });

/** Resolve cart lines against a menu into priced, bilingual order lines. Unavailable items are dropped. */
export function toFnbLines(lines: CartLine[], menu: MenuItem[]): FnbLine[] {
  return lines.flatMap((l) => {
    const item = menu.find((m) => m.id === l.itemId);
    return item
      ? [{ itemId: item.id, nameAr: item.nameAr, nameEn: item.nameEn, category: item.category, unitPrice: item.price, qty: l.qty }]
      : [];
  });
}

export const linesTotal = (lines: FnbLine[]) => round2(lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
export const linesCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
