'use client';

import { useState, useCallback } from 'react';
import type { ToastType } from '../../../shared/components/ui/Toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

/**
 * useToast
 *
 * Manages the list of active toast notifications.
 * Pair with <ToastContainer toasts={toasts} removeToast={removeToast} />
 * at the root of your layout.
 *
 * Usage:
 *   const { toasts, addToast, removeToast } = useToast();
 *   addToast('Saved!', 'success');
 *   addToast('Something went wrong', 'error');
 *   addToast('New message received', 'info');
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
