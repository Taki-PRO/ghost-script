import { useId } from 'react';
import { theme } from '../styles/theme';
import { SEAL_GLYPH_PX, SEAL_INSET_PX, SEAL_SIZE_PX } from '../engine/sealLayout';

export interface SealStampProps {
  /** The target character of the dataset record. The glyph comes only from here. */
  character: string;
  className?: string;
  /** 'corner' (default): absolute, bottom right of the parent. 'flow': in the normal flow. */
  placement?: 'corner' | 'flow';
  /** Box width and height in CSS pixels. Default `SEAL_SIZE_PX`; the glyph is 0.75 of it. */
  size?: number;
}

/**
 * Seal_Stamp: the ghost's own character in paperLabel on a rough seal-red
 * square. Rendered only after a clean outcome (the caller decides). The wrapper
 * carries the accessible name, so the glyph is announced once.
 */
export function SealStamp({ character, className, placement = 'corner', size = SEAL_SIZE_PX }: SealStampProps) {
  const flow = placement === 'flow';
  const glyphPx = size === SEAL_SIZE_PX ? SEAL_GLYPH_PX : size * 0.75;
  const filterId = `seal-rough-${useId().replace(/:/g, '')}`;
  return (
    <div
      role="img"
      aria-label={`Seal: ${character}`}
      data-testid="seal-stamp"
      className={`seal-stamp pointer-events-none ${flow ? 'relative' : 'absolute'} flex items-center justify-center ${className ?? ''}`.trim()}
      style={{
        pointerEvents: 'none',
        width: `${size}px`,
        height: `${size}px`,
        ...(flow ? {} : { bottom: `${SEAL_INSET_PX}px`, right: `${SEAL_INSET_PX}px` }),
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
        style={{ fontSize: `${glyphPx}px`, lineHeight: 1, color: theme.paperLabel }}
      >
        {character}
      </span>
    </div>
  );
}
