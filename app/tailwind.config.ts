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
        paper: theme.paper,
        'ink-on-paper': theme.inkOnPaper,
        drawing: theme.drawing,
        seal: theme.seal,
        'grid-line': theme.gridLine,
        'grave-restless': theme.graveRestless,
        'grave-rest': theme.graveRest,
        'grave-wisp': theme.graveWisp,
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        hanzi: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Songti SC"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          '"Noto Serif CJK SC"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
