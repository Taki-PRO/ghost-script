import { theme } from '../styles/theme';

/**
 * The 米字格 practice grid: outer border, vertical and horizontal centre
 * lines, and two diagonals. Takes no props, so it cannot depend on a character.
 */
export function PracticeGrid() {
  const dash = '3 3';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
      data-testid="practice-grid"
    >
      <g
        fill="none"
        stroke={theme.gridLine}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={0.25}
      >
        <g data-line="border">
          <rect x="0.5" y="0.5" width="99" height="99" vectorEffect="non-scaling-stroke" />
        </g>
        <g data-line="vertical">
          <line x1="50" y1="0" x2="50" y2="100" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
        </g>
        <g data-line="horizontal">
          <line x1="0" y1="50" x2="100" y2="50" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
        </g>
        <g data-line="diagonal-down">
          <line x1="0" y1="0" x2="100" y2="100" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
        </g>
        <g data-line="diagonal-up">
          <line x1="100" y1="0" x2="0" y2="100" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
        </g>
      </g>
    </svg>
  );
}
