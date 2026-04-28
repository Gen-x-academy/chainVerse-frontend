// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  primary:      '#2563eb',
  primaryHover: '#1d4ed8',
  secondary:    '#7c3aed',
  muted:        '#6b7280',
  destructive:  '#dc2626',
  success:      '#16a34a',
  warning:      '#d97706',
  info:         '#0891b2',
  background:   '#ffffff',
  foreground:   '#111827',
  border:       '#e5e7eb',
  inputBg:      '#f9fafb',
  overlay:      'rgba(0, 0, 0, 0.5)',
} as const;

// ─── Spacing scale ────────────────────────────────────────────────────────────

export const spacing = {
  '0':   '0',
  '0.5': '0.125rem',
  xs:    '0.25rem',
  sm:    '0.5rem',
  md:    '1rem',
  lg:    '1.5rem',
  xl:    '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  none: '0',
  sm:   '0.375rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  xl:   '1rem',
  full: '9999px',
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  none: 'none',
  sm:   '0 1px 2px rgba(0,0,0,0.05)',
  md:   '0 4px 6px rgba(0,0,0,0.1)',
  lg:   '0 10px 15px rgba(0,0,0,0.15)',
  xl:   '0 20px 25px rgba(0,0,0,0.2)',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontSize = {
  xs:    '0.75rem',
  sm:    '0.875rem',
  base:  '1rem',
  lg:    '1.125rem',
  xl:    '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
} as const;

export const fontWeight = {
  normal:    '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;

export const lineHeight = {
  tight:   '1.25',
  snug:    '1.375',
  normal:  '1.5',
  relaxed: '1.625',
  loose:   '2',
} as const;

export const fontFamily = {
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
} as const;

// ─── Z-index ──────────────────────────────────────────────────────────────────

export const zIndex = {
  base:     '0',
  raised:   '10',
  dropdown: '100',
  sticky:   '200',
  modal:    '300',
  toast:    '400',
} as const;
