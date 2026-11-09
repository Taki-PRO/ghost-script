import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve repo root from this file: tests/smoke/npm-script.test.ts -> ../../
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const packageJsonPath = resolve(repoRoot, 'package.json');

/**
 * Narrows the untyped JSON.parse result to the shape we care about: an object
 * with a `scripts` record of string -> string. Everything crosses the untyped
 * boundary as `unknown` and is checked explicitly (no `any`).
 */
function readScripts(raw: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('package.json did not parse to an object');
  }
  if (!('scripts' in parsed)) {
    throw new Error('package.json has no "scripts" field');
  }
  const scripts: unknown = (parsed as { scripts: unknown }).scripts;
  if (typeof scripts !== 'object' || scripts === null) {
    throw new Error('package.json "scripts" is not an object');
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

describe('package.json npm scripts', () => {
  const scripts = readScripts(readFileSync(packageJsonPath, 'utf8'));

  it('defines a build:data script that invokes scripts/build-data.ts', () => {
    const buildData = scripts['build:data'];
    expect(typeof buildData).toBe('string');
    expect(buildData.length).toBeGreaterThan(0);
    expect(buildData).toContain('build-data');
  });

  it('defines a test script that runs vitest', () => {
    const test = scripts['test'];
    expect(typeof test).toBe('string');
    expect(test.length).toBeGreaterThan(0);
    expect(test).toContain('vitest');
  });
});
