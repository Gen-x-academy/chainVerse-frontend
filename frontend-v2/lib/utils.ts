import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LEVEL_BADGE_MAP: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
};

/** Normalize course level casing for badge styling */
export function getLevelBadgeClass(level?: string): string {
  return LEVEL_BADGE_MAP[(level ?? '').toLowerCase()] ?? 'bg-purple-100 text-purple-700';
}

/** Capitalize level string for display */
export function formatLevel(level?: string): string {
  if (!level) return '';
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
}
