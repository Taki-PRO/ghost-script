// Pure colour helpers shared by the E2E_Suite and its unit test. No Playwright import,
// so Vitest can load this file.

export type Rgb = readonly [number, number, number];

/** WCAG relative luminance of an sRGB colour with channels 0 to 255. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio `(L1 + 0.05) / (L2 + 0.05)`, lighter over darker, whatever the argument order. */
export function luminanceRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
