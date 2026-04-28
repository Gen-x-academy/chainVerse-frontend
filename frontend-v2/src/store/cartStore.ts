import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartItem = {
  id: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  requiresAuth: boolean;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setRequiresAuth: (value: boolean) => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * useCartStore
 *
 * Persisted cart state. Items survive page refreshes via localStorage.
 *
 * addToCart  — O(n) scan to detect duplicates, then O(1) append or O(n) map.
 * removeFromCart — O(n) filter.
 * All other actions — O(1).
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      requiresAuth: false,

      addToCart: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      removeFromCart: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      clearCart: () => set({ items: [] }),

      setRequiresAuth: (value) => set({ requiresAuth: value }),
    }),
    { name: 'chainverse-cart' }
  )
);
