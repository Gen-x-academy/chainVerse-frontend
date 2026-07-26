import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalize course level casing for badge styling */
export function getLevelBadgeClass(level?: string): string {
  const l = (level ?? '').toLowerCase();
  if (l === 'beginner') return 'bg-green-100 text-green-700';
  if (l === 'intermediate') return 'bg-blue-100 text-blue-700';
  return 'bg-purple-100 text-purple-700';
}
