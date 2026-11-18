/**
 * Bundle size check: gzips every file in app/dist (level 9), skips
 * the lazy files (level datasets and level font subsets), and fails when the total is over the budget.
 * Started with `npm run check:bundle` after `npm run build -w app`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface SizedFile {
  readonly path: string;
  readonly gzipBytes: number;
  /** Uncompressed size; only needed for the lazy-file listing. */
  readonly rawBytes?: number;
}

export interface BundleReport {
  readonly total: number;
  readonly ok: boolean;
  readonly largest: readonly SizedFile[];
}

/** 300 kB means 300,000 bytes of gzip. */
export const BUNDLE_BUDGET_BYTES = 300_000;

/** Files fetched on demand (level datasets and level font subsets). They are listed, not counted. */
export const LAZY_PATHS: readonly string[] = [
  'data/characters.json',
  'data/characters-level2.json',
  'data/characters-level3.json',
];
export const LAZY_PATH_PREFIXES: readonly string[] = ['assets/lxgw-wenkai-subset-level'];
const LARGEST_COUNT = 5;

function normalise(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Pure: true when the file is loaded lazily and so is not counted against the budget. */
export function isLazy(path: string): boolean {
  const p = normalise(path);
  return LAZY_PATHS.includes(p) || LAZY_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/** Pure: the lazy files, sorted by path. */
export function lazyFiles(files: readonly SizedFile[]): readonly SizedFile[] {
  return files.filter((f) => isLazy(f.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Pure: totals the files (minus lazy files) and lists the five largest. `ok` is total <= budget. */
export function summariseBundle(
  files: readonly SizedFile[],
  budget: number = BUNDLE_BUDGET_BYTES,
): BundleReport {
  const counted = files.filter((f) => !isLazy(f.path));
  const total = counted.reduce((sum, f) => sum + f.gzipBytes, 0);
  const largest = [...counted]
    .sort((a, b) => b.gzipBytes - a.gzipBytes || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, LARGEST_COUNT);
  return { total, ok: total <= budget, largest };
}

/** The level 1 dataset, fetched at start but not counted against the budget. */
export const LEVEL1_DATASET_PATH = 'data/characters.json';

export interface FirstLoad {
  /** Gzip bytes of the counted bundle (the part the budget applies to). */
  readonly counted: number;
  /** Gzip bytes of the level 1 dataset. */
  readonly level1: number;
  /** counted + level1. */
  readonly total: number;
}

/**
 * Pure: the real first load. `counted` is the budgeted total, `level1` is the gzip size of the
 * level 1 dataset (0 when absent), `total` is their sum. The Legend_Strokes_File is not lazy, so it is in `counted`.
 */
export function firstLoad(files: readonly SizedFile[]): FirstLoad {
  const counted = summariseBundle(files).total;
  const level1 = files
    .filter((f) => normalise(f.path) === LEVEL1_DATASET_PATH)
    .reduce((sum, f) => sum + f.gzipBytes, 0);
  return { counted, level1, total: counted + level1 };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function main(): void {
  const dist = join(repoRoot(), 'app', 'dist');
  if (!existsSync(dist)) {
    process.stderr.write('BUNDLE CHECK FAILED: app/dist is missing. Run `npm run build -w app` first.\n');
    process.exitCode = 1;
    return;
  }
  const files: SizedFile[] = walk(dist).map((full) => {
    const bytes = readFileSync(full);
    return {
      path: relative(dist, full).split(sep).join('/'),
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
      rawBytes: bytes.length,
    };
  });
  const report = summariseBundle(files);
  const verdict = report.ok ? 'PASSED' : 'FAILED';
  const line = `BUNDLE CHECK ${verdict}: ${report.total} bytes gzip, budget ${BUNDLE_BUDGET_BYTES} (lazy files not counted)\n`;
  const detail = report.largest.map((f) => `  ${String(f.gzipBytes).padStart(8)}  ${f.path}\n`).join('');
  const lazy = lazyFiles(files)
    .map((f) => `  raw ${String(f.rawBytes ?? 0).padStart(8)}  gzip ${String(f.gzipBytes).padStart(8)}  ${f.path}\n`)
    .join('');
  const fl = firstLoad(files);
  const firstLine = `First load: ${fl.counted} bytes counted + ${fl.level1} bytes level 1 dataset = ${fl.total} bytes gzip\n`;
  const out = line + 'Largest files:\n' + detail + 'Lazy files (not counted):\n' + lazy + firstLine;
  if (report.ok) {
    process.stdout.write(out);
  } else {
    process.stderr.write(out);
    process.exitCode = 1;
  }
}

// ESM-safe execution guard: run main() only when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
