import { useId } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { PracticeGrid } from './PracticeGrid';

export interface InkSurfaceProps {
  /** CSS length of the square side, e.g. 'min(80vw, 420px)'. */
  size: string;
  containerRef: RefObject<HTMLDivElement>;
  role?: string;
  ariaLabel?: string;
  /** Visually empties the hanzi-writer container but still reserves its space. */
  hidden?: boolean;
  style?: CSSProperties;
  /** Drawn after the container, absolutely placed, ignoring pointer events. */
  overlay?: ReactNode;
  /** True on the Write step, where the paper takes strokes. Sets data-brush for the Brush_Cursor. */
  drawable?: boolean;
}

/**
 * Paper, practice grid and the hanzi-writer container, at a fixed square size.
 * An ink-bleed filter roughens the finished strokes only: hanzi-writer 3.7.3
 * draws `svg > g(positioned) > g(outline), g(main), g(highlight)`, and the
 * filter targets the main group (`svg > g > g:nth-child(2)`), so the stroke
 * being drawn stays sharp. If that structure changes the rule matches nothing
 * and the strokes simply stay unfiltered.
 * The filter works in the positioned group's units (about 1024 per glyph, scaled
 * down to the surface), hence the larger numbers than on a screen-sized element.
 */
export function InkSurface({ size, containerRef, role, ariaLabel, hidden, style, overlay, drawable }: InkSurfaceProps) {
  const filterId = `ink-bleed-${useId().replace(/:/g, '')}`;
  return (
    <div
      className="ink-paper relative"
      data-testid="ink-surface"
      data-ink-surface={filterId}
      data-brush={drawable ? 'true' : undefined}
      style={{ width: size, aspectRatio: '1 / 1', touchAction: 'none', ...style }}
    >
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute" data-testid="ink-filter-defs">
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <style>{`[data-ink-surface="${filterId}"] [data-testid="ink-container"] svg > g > g:nth-child(2) { filter: url(#${filterId}); }`}</style>
      <PracticeGrid />
      <div
        ref={containerRef}
        role={role}
        aria-label={ariaLabel}
        className="relative h-full w-full"
        data-testid="ink-container"
        style={{ touchAction: 'none', visibility: hidden ? 'hidden' : 'visible' }}
      />
      {overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          data-testid="ink-overlay"
          style={{ pointerEvents: 'none' }}
        >
          {overlay}
        </div>
      ) : null}
    </div>
  );
}
