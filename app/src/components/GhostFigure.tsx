import { useId } from 'react';
import { theme } from '../styles/theme';

export interface GhostFigureProps {
  className?: string;
}

/**
 * The one Ink_Ghost silhouette: a brushed shape with a ragged hem and a slightly
 * uneven edge. The roughness is part of the geometry, so the favicon can use this
 * exact string without a filter. In the app a displacement filter bleeds it further.
 */
export const GHOST_PATH =
  'M9 74 C8 66 9.5 58 8.4 49 C7.2 40 7.8 31 11 23.5 C14.5 14.5 22.5 5.5 32.5 4.6 ' +
  'C42 3.8 50.5 10 54 19 C57.2 27 56.4 36 56 45 C55.6 54 57 62 55.4 73.5 ' +
  'C54 72 52.2 69.2 50.6 67 C49.6 69.8 47.6 73 45.6 76.2 C44.2 73.6 42.4 70.2 40.4 68.4 ' +
  'C39 71 37.6 74.2 35.2 75.8 C33.8 72.8 32.4 69.6 30.4 67.6 C28.8 70.2 27 73.6 24.8 76.4 ' +
  'C23.6 73.4 21.8 70.4 19.8 68.6 C18.2 71.2 16.2 73.4 14 75.6 C12.8 73.8 11 72.8 9 74 Z';

/** Two small brushed eye marks. */
export const GHOST_EYE_PATHS: readonly string[] = [
  'M20.5 31.5 C20.8 29.4 23.6 29 25.2 30.4 C26.6 31.8 26.2 34.6 24 35.6 C22 36.4 20.2 34 20.5 31.5 Z',
  'M38.6 31.2 C39.2 29.2 41.8 28.8 43.4 30.2 C44.8 31.6 44.4 34.4 42.2 35.4 C40.2 36.2 38.2 33.8 38.6 31.2 Z',
];

/**
 * The ghost shared by the ghost card, the start menu and the intro. No text element.
 * An ink wash: a blurred wet hem, a body with a tone gradient, and a darker second wash
 * on the belly. Every id starts with the one per-instance `useId` value.
 */
export function GhostFigure({ className = '' }: GhostFigureProps) {
  const base = `ghost-${useId().replace(/:/g, '')}`;
  const bleedId = `${base}-bleed`;
  const toneId = `${base}-tone`;
  const washId = `${base}-wash`;
  const blurId = `${base}-blur`;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 80" className={className}>
      <defs>
        <filter id={bleedId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <linearGradient id={toneId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.82" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={washId} cx="0.38" cy="0.62" r="0.55">
          <stop offset="0%" stopColor={theme.background} stopOpacity="0.35" />
          <stop offset="100%" stopColor={theme.background} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={GHOST_PATH}
        fill="currentColor"
        opacity="0.45"
        transform="translate(0 1.5)"
        filter={`url(#${blurId})`}
      />
      <path d={GHOST_PATH} fill={`url(#${toneId})`} filter={`url(#${bleedId})`} />
      <path d={GHOST_PATH} fill={`url(#${washId})`} filter={`url(#${bleedId})`} />
      {GHOST_EYE_PATHS.map((d) => (
        <path key={d} d={d} fill={theme.background} />
      ))}
    </svg>
  );
}
