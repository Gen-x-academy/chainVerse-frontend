import { create } from "zustand";
export interface CartItem {
  id: number;
  courseId?: string;
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
  pruneInvalidItems: () => void;
  requiresAuth: boolean;
  setRequiresAuth: (value: boolean) => void;
}

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  requiresAuth: false,
  setRequiresAuth: (value) => set({ requiresAuth: value }),
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
  pruneInvalidItems: () =>
    set((state) => ({
      items: state.items.filter(
        (item) => !item.courseId || isValidObjectId(item.courseId)
      ),
    })),
}));
