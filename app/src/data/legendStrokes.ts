import type { HanziWriterCharData } from './charDataLoader';
import { LEGEND_SOURCE } from './citations';

/** Stroke data of the legend line's Han characters, keyed by character (file: legend-strokes.json). */
export type LegendStrokesFile = Readonly<Record<string, HanziWriterCharData>>;

export type LegendResult =
  | { ok: true; strokes: LegendStrokesFile }
  | { ok: false; reason: 'network' | 'status' | 'json' | 'empty' };

/** The unique Han characters (U+4E00 to U+9FFF) of the legend line, in order. */
export function legendHanCharacters(zh: string = LEGEND_SOURCE.zh): string[] {
  const seen: string[] = [];
  for (const ch of zh) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x4e00 && cp <= 0x9fff && !seen.includes(ch)) seen.push(ch);
  }
  return seen;
}

/** Default location of the generated file, honouring Vite's base path. */
export function defaultLegendStrokesUrl(): string {
  return `${import.meta.env?.BASE_URL ?? '/'}data/legend-strokes.json`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCharData(v: unknown): v is HanziWriterCharData {
  if (!isPlainObject(v)) return false;
  const { strokes, medians, radStrokes } = v;
  if (!Array.isArray(strokes) || strokes.length === 0) return false;
  if (!strokes.every((s) => typeof s === 'string' && s.length > 0)) return false;
  if (!Array.isArray(medians) || medians.length !== strokes.length) return false;
  const medianOk = medians.every(
    (m) =>
      Array.isArray(m) &&
      m.length > 0 &&
      m.every(
        (pt) =>
          Array.isArray(pt) && pt.length === 2 && pt.every((n) => typeof n === 'number' && Number.isFinite(n)),
      ),
  );
  if (!medianOk) return false;
  return (
    radStrokes === undefined ||
    (Array.isArray(radStrokes) && radStrokes.every((n) => typeof n === 'number' && Number.isFinite(n)))
  );
}

/**
 * Fetch and validate legend-strokes.json. Never throws. A partial file succeeds
 * (a character without a valid entry is simply absent); a file with no valid
 * entry for any of the legend's Han characters is `empty`.
 */
export async function loadLegendStrokes(url: string = defaultLegendStrokesUrl()): Promise<LegendResult> {
  let text: string;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, reason: 'status' };
    text = await response.text();
  } catch {
    return { ok: false, reason: 'network' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isPlainObject(parsed)) return { ok: false, reason: 'json' };

  const strokes: Record<string, HanziWriterCharData> = {};
  for (const ch of legendHanCharacters()) {
    if (!Object.prototype.hasOwnProperty.call(parsed, ch)) continue;
    const entry = parsed[ch];
    if (isCharData(entry)) strokes[ch] = entry;
  }
  if (Object.keys(strokes).length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, strokes };
}
