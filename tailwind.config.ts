import type { Config } from 'tailwindcss';

const config = {
  darkMode: 'class',
  content: [
    './pages//*.{ts,tsx}',
    './components//*.{ts,tsx}',
    './app//*.{ts,tsx}',
    './src//*.{ts,tsx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        background: '#f8fafd',
        foreground: '#0e1a33',
        primary: {
          DEFAULT: '#4361ee',
          foreground: '#f5f7fa',
        },
        secondary: {
          DEFAULT: '#a855f7',
          foreground: '#f5f7fa',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#f5f7fa',
        },
        muted: {
          DEFAULT: '#f1f5fa',
          foreground: '#6c7793',
        },
        accent: {
          DEFAULT: '#06b6d4',
          foreground: '#f5f7fa',
        },
        popover: {
          DEFAULT: '--popover',
          foreground: '--popover-foreground',
        },
        card: {
          DEFAULT: '--card',
          foreground: '--card-foreground',
        },
        sidebar: {
          DEFAULT: '#f0f4fa',
          foreground: '--sidebar-foreground',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#4361ee',
        sidebarForeground: '#394764',
        sidebarBorder: '#e2e8f0',
        success: '#16a34a',
        successForeground: '#f5f7fa',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
