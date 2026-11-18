import { TUFT_HEIGHT, TUFT_SHAPES, TUFT_WIDTH } from '../engine/grassPattern';
import { theme } from '../styles/theme';

/** One decorative grass tuft: blades only, no text, no animation. */
export function GrassTuft({ shape, scale = 1 }: { shape: number; scale?: number }) {
  const index = ((shape % TUFT_SHAPES.length) + TUFT_SHAPES.length) % TUFT_SHAPES.length;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${TUFT_WIDTH} ${TUFT_HEIGHT}`}
      width={TUFT_WIDTH * scale}
      height={TUFT_HEIGHT * scale}
      className="pointer-events-none block"
    >
      <path d={TUFT_SHAPES[index]} fill={theme.grass} />
    </svg>
  );
}
