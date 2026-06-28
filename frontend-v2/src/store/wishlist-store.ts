import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistState {
  items: string[];
  toggle: (courseId: string) => void;
  isWishlisted: (courseId: string) => boolean;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (courseId) =>
        set((state) => ({
          items: state.items.includes(courseId)
            ? state.items.filter((id) => id !== courseId)
            : [...state.items, courseId],
        })),
      isWishlisted: (courseId) => get().items.includes(courseId),
      clear: () => set({ items: [] }),
    }),
    { name: 'cv-wishlist' },
  ),
);
