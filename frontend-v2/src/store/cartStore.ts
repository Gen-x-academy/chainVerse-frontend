import { create } from 'zustand';

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  currency: string;
}

interface CartState {
  items: CartItem[];
  requiresAuth: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  setRequiresAuth: (requiresAuth: boolean) => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  requiresAuth: false,
  addToCart: (item) => set((state) => ({ items: [...state.items, item] })),
  removeFromCart: (itemId) => set((state) => ({ items: state.items.filter((item) => item.id !== itemId) })),
  setRequiresAuth: (requiresAuth) => set({ requiresAuth }),
}));