/**
 * Bundle size check: gzips every file in app/dist (level 9), excludes
 * data/characters.json, and fails when the total is over the budget.
 * Started with `npm run check:bundle` after `npm run build -w app`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface SizedFile {
  readonly path: string;
  readonly gzipBytes: number;
}

export interface BundleReport {
  readonly total: number;
  readonly ok: boolean;
  readonly largest: readonly SizedFile[];
}

/** 300 kB means 300,000 bytes of gzip. */
export const BUNDLE_BUDGET_BYTES = 300_000;

const EXCLUDED_PATH = 'data/characters.json';
const LARGEST_COUNT = 5;

function normalise(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Pure: totals the files (minus characters.json) and lists the five largest. `ok` is total <= budget. */
export function summariseBundle(
  files: readonly SizedFile[],
  budget: number = BUNDLE_BUDGET_BYTES,
): BundleReport {
  const counted = files.filter((f) => normalise(f.path) !== EXCLUDED_PATH);
  const total = counted.reduce((sum, f) => sum + f.gzipBytes, 0);
  const largest = [...counted]
    .sort((a, b) => b.gzipBytes - a.gzipBytes || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, LARGEST_COUNT);
  return { total, ok: total <= budget, largest };
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
  const files: SizedFile[] = walk(dist).map((full) => ({
    path: relative(dist, full).split(sep).join('/'),
    gzipBytes: gzipSync(readFileSync(full), { level: 9 }).length,
  }));
  const report = summariseBundle(files);
  const verdict = report.ok ? 'PASSED' : 'FAILED';
  const line = `BUNDLE CHECK ${verdict}: ${report.total} bytes gzip, budget ${BUNDLE_BUDGET_BYTES} (data/characters.json excluded)\n`;
  const detail = report.largest.map((f) => `  ${String(f.gzipBytes).padStart(8)}  ${f.path}\n`).join('');
  if (report.ok) {
    process.stdout.write(line + 'Largest files:\n' + detail);
  } else {
    process.stderr.write(line + 'Largest files:\n' + detail);
    process.exitCode = 1;
  }
}

// ESM-safe execution guard: run main() only when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
