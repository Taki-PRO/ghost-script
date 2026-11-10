import type { Config } from 'tailwindcss';
import { theme } from './src/styles/theme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: theme.background,
        surface: theme.surface,
        ink: theme.ink,
        muted: theme.muted,
        ghost: theme.ghost,
        success: theme.success,
        error: theme.error,
      },
    },
  },
  plugins: [],
} satisfies Config;
