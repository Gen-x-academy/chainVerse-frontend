/**
 * tailwind-tokens.preset.ts
 *
 * Tailwind CSS preset that maps design-tokens.ts values into the Tailwind
 * theme so every token is available as a utility class (e.g. `text-primary`,
 * `bg-success`, `rounded-token-lg`, `shadow-token-md`).
 *
 * Usage — add to tailwind.config.ts:
 *   import tokensPreset from '@/src/shared/constants/tailwind-tokens.preset';
 *   export default { presets: [tokensPreset], ... };
 */

import type { Config } from 'tailwindcss';
import { colors, spacing, radius, shadows, fontSize, fontWeight, fontFamily, zIndex } from './design-tokens';

const tokensPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primary:     colors.primary,
        'primary-hover': colors.primaryHover,
        secondary:   colors.secondary,
        muted:       colors.muted,
        destructive: colors.destructive,
        success:     colors.success,
        warning:     colors.warning,
        info:        colors.info,
        overlay:     colors.overlay,
      },
      spacing: Object.fromEntries(
        Object.entries(spacing).map(([k, v]) => [`token-${k}`, v])
      ),
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [`token-${k}`, v])
      ),
      boxShadow: Object.fromEntries(
        Object.entries(shadows).map(([k, v]) => [`token-${k}`, v])
      ),
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, v]) => [`token-${k}`, v])
      ),
      fontWeight: Object.fromEntries(
        Object.entries(fontWeight).map(([k, v]) => [`token-${k}`, v])
      ),
      fontFamily: {
        'token-sans': [fontFamily.sans],
        'token-mono': [fontFamily.mono],
      },
      zIndex: Object.fromEntries(
        Object.entries(zIndex).map(([k, v]) => [`token-${k}`, v])
      ),
    },
  },
};

export default tokensPreset;
