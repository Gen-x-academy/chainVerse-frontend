'use client';

import React, { createContext, useContext } from 'react';
import { useWishlistStore } from '@/src/store/wishlist-store';
import { courseService } from '@/src/features/courses/services/course.service';

interface WishlistContextValue {
  wishlist: string[];
  toggle: (courseId: string) => void;
  isWishlisted: (courseId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const items = useWishlistStore((s) => s.items);
  const storeToggle = useWishlistStore((s) => s.toggle);

  const toggle = (courseId: string) => {
    const newState = !items.includes(courseId);
    storeToggle(courseId);
    courseService.toggleWishlist(courseId, newState).catch(() => {});
  };

  const isWishlisted = (courseId: string) => items.includes(courseId);

  return (
    <WishlistContext.Provider value={{ wishlist: items, toggle, isWishlisted }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
