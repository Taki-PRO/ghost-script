// Legend_Strokes_File: the stroke data of the Han characters of the intro's
// legend line, copied unchanged from data/raw/hanzi-writer-data. Built only by
// scripts/build-data.ts, never by hand.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One character's hanzi-writer data, exactly as in its source file. */
export interface LegendStrokeEntry {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

/** True for U+4E00 to U+9FFF, the Han characters of the legend line. */
function isHan(ch: string): boolean {
  const cp = ch.codePointAt(0) as number;
  return cp >= 0x4e00 && cp <= 0x9fff;
}

/** The unique Han characters of `zh`, in order of first appearance. */
export function legendCharacters(zh: string): string[] {
  const seen = new Set<string>();
  for (const ch of zh) {
    if (isHan(ch)) seen.add(ch);
  }
  return [...seen];
}

/**
 * Reads `<dir>/<char>.json` for each character, in the given order. A missing,
 * unparsable or malformed file throws an Error that names the character.
 */
export function buildLegendStrokes(
  dir: string,
  chars: readonly string[],
): Record<string, LegendStrokeEntry> {
  const result: Record<string, LegendStrokeEntry> = {};
  for (const ch of chars) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, `${ch}.json`), 'utf8'));
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      throw new Error(
        `legend stroke file for ${ch} is missing or unreadable (${ch}.json): ${why}`,
      );
    }
    const obj = parsed as Record<string, unknown> | null;
    if (
      typeof obj !== 'object' ||
      obj === null ||
      !Array.isArray(obj.strokes) ||
      obj.strokes.length === 0 ||
      !Array.isArray(obj.medians)
    ) {
      throw new Error(
        `legend stroke file for ${ch} is invalid (${ch}.json): strokes and medians are required`,
      );
    }
    result[ch] = parsed as LegendStrokeEntry;
  }
  return result;
}

/** Compact JSON in legend order plus one trailing newline. */
export function serialiseLegendStrokes(
  data: Record<string, LegendStrokeEntry>,
): string {
  return `${JSON.stringify(data)}\n`;
}
