// Review samples (pure). Picks a fixed, reproducible sample of 50 rows from a
// level's Review_File so a human can spot-check the prompts of levels 2 and 3.
//
// Algorithm (spec harder-ghosts, "Review samples and prompt counts"):
//   seed      = FNV-1a 32 bit over the ASCII seed string
//   rand      = mulberry32(seed), floats in [0, 1)
//   positions = [0..n-1]; for i in 0..49: j = i + floor(rand() * (n - i)); swap
//   sample    = positions[0..49] sorted ascending (rows keep list order)

/** Number of rows in every Review_Sample. */
export const SAMPLE_SIZE = 50;

/** Levels that have a Review_Sample. */
export type SampleLevel = 2 | 3;

/** Seed string per level. */
export const SEED_STRINGS: Readonly<Record<SampleLevel, string>> = {
  2: 'ghost-script/prompt-review-sample/v1/level2',
  3: 'ghost-script/prompt-review-sample/v1/level3',
};

/** Repo-relative path of each level's Review_File. */
export const SOURCE_PATHS: Readonly<Record<SampleLevel, string>> = {
  2: 'data/prompt-review-level2.csv',
  3: 'data/prompt-review-level3.csv',
};

const ALGORITHM =
  'mulberry32 PRNG; partial Fisher-Yates over row positions; sample sorted by list order';
const SEED_HASH = 'FNV-1a 32 bit over the ASCII seed string';

/** FNV-1a, 32 bit, over the ASCII bytes of `text`. Returns an unsigned integer. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 PRNG: returns a function giving floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks `size` distinct row positions out of `rowCount` with a partial
 * Fisher-Yates shuffle. The result is sorted ascending.
 */
export function sampleRows(rowCount: number, size: number, seed: number): number[] {
  if (!Number.isInteger(rowCount) || !Number.isInteger(size) || size < 0 || rowCount < size) {
    throw new Error(`cannot sample ${size} rows from ${rowCount}`);
  }
  const rand = mulberry32(seed);
  const positions = Array.from({ length: rowCount }, (_, i) => i);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(rand() * (rowCount - i));
    const tmp = positions[i];
    positions[i] = positions[j];
    positions[j] = tmp;
  }
  return positions.slice(0, size).sort((a, b) => a - b);
}

/** Splits text into lines, each keeping its own terminator (LF or CRLF). */
function splitKeepingTerminators(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/**
 * Builds the Review_Sample CSV for a level from its Review_File text. The
 * header and the chosen rows are copied byte for byte. Throws when the file has
 * fewer than 50 data rows.
 */
export function buildReviewSample(reviewCsv: string, level: SampleLevel): string {
  const lines = splitKeepingTerminators(reviewCsv);
  const header = lines[0];
  const rows = lines.slice(1).filter((line) => line.replace(/\r?\n$/, '') !== '');
  if (header === undefined || rows.length < SAMPLE_SIZE) {
    throw new Error(
      `level ${level} Review_File has ${rows.length} data rows; at least ${SAMPLE_SIZE} are needed for a sample`,
    );
  }
  const eol = /\r?\n$/.exec(header)?.[0] ?? '\n';
  const withEol = (line: string): string => (/\n$/.test(line) ? line : line + eol);
  const seed = fnv1a32(SEED_STRINGS[level]);
  const picked = sampleRows(rows.length, SAMPLE_SIZE, seed).map((p) => withEol(rows[p]));
  return withEol(header) + picked.join('');
}

/** Per-level entry of the provenance record. */
export interface SampleProvenanceLevel {
  seedString: string;
  seed: number;
  source: string;
  rows: number;
}

/** Content of data/prompt-review-sample-provenance.json. */
export interface SampleProvenance {
  algorithm: string;
  seedHash: string;
  sampleSize: number;
  levels: { '2': SampleProvenanceLevel; '3': SampleProvenanceLevel };
}

/** Builds the provenance record from the data row counts of both Review_Files. */
export function buildSampleProvenance(rows: Readonly<Record<SampleLevel, number>>): SampleProvenance {
  const entry = (level: SampleLevel): SampleProvenanceLevel => ({
    seedString: SEED_STRINGS[level],
    seed: fnv1a32(SEED_STRINGS[level]),
    source: SOURCE_PATHS[level],
    rows: rows[level],
  });
  return {
    algorithm: ALGORITHM,
    seedHash: SEED_HASH,
    sampleSize: SAMPLE_SIZE,
    levels: { '2': entry(2), '3': entry(3) },
  };
}

/** Serialises the provenance record: 2-space JSON and a trailing newline. */
export function serialiseSampleProvenance(provenance: SampleProvenance): string {
  return JSON.stringify(provenance, null, 2) + '\n';
}
