// Simple toast hook for demo purposes
import { useState } from "react";

let toastFn: ((opts: { title: string; description?: string }) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<{ title: string; description?: string }[]>([]);
  toastFn = (opts) => setToasts((prev) => [...prev, opts]);
  return {
    toasts,
    toast: toastFn,
  };
}

export function toast(opts: { title: string; description?: string }) {
  if (toastFn) toastFn(opts);
} 