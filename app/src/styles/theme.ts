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
  ghost: '#9fc4d6', // accent
  success: '#8fd19e', // accepted
  error: '#f19188', // rejected
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
