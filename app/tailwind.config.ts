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
        'night-top': theme.nightTop,
        'night-mid': theme.nightMid,
        'night-low': theme.nightLow,
        mist: theme.mist,
        moon: theme.moon,
        'paper-label': theme.paperLabel,
        'seal-light': theme.sealLight,
        'hint-ink': theme.hintInk,
      },
      boxShadow: {
        'candle-glow': '0 0 20px rgba(240, 184, 102, 0.35)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        hanzi: [
          '"LXGW WenKai Subset"',
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
