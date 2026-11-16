import { theme } from '../styles/theme';

export interface GhostFigureProps {
  className?: string;
}

/** The ghost silhouette shared by the ghost card and the start menu. No text element. */
export function GhostFigure({ className = '' }: GhostFigureProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 80" className={className}>
      <path
        d="M8 76 V32 C8 14 20 4 32 4 C44 4 56 14 56 32 V76 L48 68 L40 76 L32 68 L24 76 L16 68 Z"
        fill="currentColor"
      />
      <circle cx="24" cy="34" r="4" fill={theme.background} />
      <circle cx="40" cy="34" r="4" fill={theme.background} />
    </svg>
  );
}
