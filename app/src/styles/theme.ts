/**
 * Minimal dark ink-wash / candlelight theme tokens.
 *
 * Colour is never the only signal: components pair success/error tokens with
 * text or icon cues (e.g. "Accepted" / "Try again"). Text tokens are verified
 * against WCAG AA (>= 4.5:1) in theme.test.ts.
 */
export const theme = {
  background: '#0e0f13',
  surface: '#181a21',
  ink: '#ece6d6', // primary text (candlelit paper)
  muted: '#a9a79f', // secondary text
  ghost: '#bdb7a6', // neutral secondary text, pinyin
  success: '#ec7a64', // accepted; alias of sealLight
  error: '#e6dcc3', // rejected: aged paper, always with a text cue and a shape cue
  paper: '#e6dcc3', // writing surface background
  inkOnPaper: '#1c1914', // completed strokes, text on paper
  drawing: '#3a342a', // the stroke being drawn
  seal: '#b3361f', // Primary_Action fill, Seal_Stamp
  gridLine: '#7a6a4f', // practice grid and hanzi-writer outline (decorative, drawn at 0.25 opacity)
  graveRestless: '#261c24', // dark tint of surface
  graveRest: '#1a2420', // dark tint of surface
  graveWisp: '#14161c', // dark tint of surface
  nightTop: '#050813', // darkest sky stop; sticky header background
  nightMid: '#0a1126', // middle sky stop
  nightLow: '#12203f', // lightest sky stop
  mist: '#5b6f9a', // mist colour (dim, drawn at low alpha)
  moon: '#7283ab', // moon glow colour (dim, drawn at low alpha)
  paperLabel: '#f3ead2', // label on seal
  sealLight: '#ec7a64', // success marks on dark backgrounds
  hintInk: '#2c3e5a', // hanzi-writer stroke hint on paper
  candle: '#f0b866', // light only: inside box-shadow and gradients, never a fill
} as const;

export type ThemeToken = keyof typeof theme;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two #rrggbb colours (1..21). */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
