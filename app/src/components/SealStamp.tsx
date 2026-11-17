import { useId } from 'react';
import { theme } from '../styles/theme';
import { SEAL_GLYPH_PX, SEAL_INSET_PX, SEAL_SIZE_PX } from '../engine/sealLayout';

export interface SealStampProps {
  /** The target character of the dataset record. The glyph comes only from here. */
  character: string;
  className?: string;
}

/**
 * Seal_Stamp: the ghost's own character in paperLabel on a rough seal-red
 * square. Rendered only after a clean outcome (the caller decides). The wrapper
 * carries the accessible name, so the glyph is announced once.
 */
export function SealStamp({ character, className }: SealStampProps) {
  const filterId = `seal-rough-${useId().replace(/:/g, '')}`;
  return (
    <div
      role="img"
      aria-label={`Seal: ${character}`}
      data-testid="seal-stamp"
      className={`seal-stamp pointer-events-none absolute flex items-center justify-center ${className ?? ''}`.trim()}
      style={{
        pointerEvents: 'none',
        width: `${SEAL_SIZE_PX}px`,
        height: `${SEAL_SIZE_PX}px`,
        bottom: `${SEAL_INSET_PX}px`,
        right: `${SEAL_INSET_PX}px`,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        width="100%"
        height="100%"
        className="absolute inset-0"
        data-testid="seal-svg"
      >
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2" />
          </filter>
        </defs>
        <g transform="rotate(-6 24 24)" filter={`url(#${filterId})`}>
          <rect x="3" y="3" width="42" height="42" fill={theme.seal} />
          <rect
            x="6"
            y="6"
            width="36"
            height="36"
            fill="none"
            stroke={theme.paperLabel}
            strokeWidth="1"
            opacity="0.7"
          />
        </g>
      </svg>
      <span
        lang="zh"
        aria-hidden="true"
        className="relative"
        style={{ fontSize: `${SEAL_GLYPH_PX}px`, lineHeight: 1, color: theme.paperLabel }}
      >
        {character}
      </span>
    </div>
  );
}
