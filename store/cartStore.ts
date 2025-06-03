import { create } from "zustand";

export interface CartItem {
  id: number;
  title: string;
  price: number;
  currency: string;
  image: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => boolean;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addToCart: (item) => {
    const exists = get().items.find((i) => i.id === item.id);
    if (exists) return false;
    set((state) => ({
      items: [...state.items, { ...item, quantity: 1 }],
    }));
    return true;
  },
  removeFromCart: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearCart: () => set({ items: [] }),
})); 