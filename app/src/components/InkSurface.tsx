import type { CSSProperties, RefObject } from 'react';
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
}

/** Paper, practice grid and the hanzi-writer container, at a fixed square size. */
export function InkSurface({ size, containerRef, role, ariaLabel, hidden, style }: InkSurfaceProps) {
  return (
    <div
      className="ink-paper relative"
      data-testid="ink-surface"
      style={{ width: size, aspectRatio: '1 / 1', touchAction: 'none', ...style }}
    >
      <PracticeGrid />
      <div
        ref={containerRef}
        role={role}
        aria-label={ariaLabel}
        className="relative h-full w-full"
        data-testid="ink-container"
        style={{ touchAction: 'none', visibility: hidden ? 'hidden' : 'visible' }}
      />
    </div>
  );
}
