import type { Level, LevelSample as LevelSampleData } from '../data/types';

export interface LevelSampleProps {
  level: Level;
  sample: LevelSampleData;
  className?: string;
}

/**
 * One sample character of a level, drawn from its stroke paths (hanzi-writer-data
 * outlines, 1024 x 1024 with a flipped y axis). Never text: the character itself
 * is not rendered, and the label is English.
 */
export function LevelSample({ level, sample, className = '' }: LevelSampleProps) {
  return (
    <svg
      role="img"
      aria-label={`sample character of level ${level}`}
      viewBox="0 0 1024 1024"
      className={`card-slip p-1 ${className}`}
    >
      <g transform="scale(1, -1) translate(0, -900)" fill="currentColor">
        {sample.strokes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
