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
        border: '--border',
        input: '--input',
        ring: '--ring',
        background: '--background',
        foreground: '--foreground',
        primary: {
          DEFAULT: '--primary',
          foreground: '--primary-foreground',
        },
        secondary: {
          DEFAULT: '--secondary',
          foreground: '--secondary-foreground',
        },
        destructive: {
          DEFAULT: '--destructive',
          foreground: '--destructive-foreground',
        },
        muted: {
          DEFAULT: '--muted',
          foreground: '--muted-foreground',
        },
        accent: {
          DEFAULT: '--accent',
          foreground: '--accent-foreground',
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
          DEFAULT: '--sidebar',
          foreground: '--sidebar-foreground',
        },
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
