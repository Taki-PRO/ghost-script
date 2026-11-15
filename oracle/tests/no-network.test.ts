import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f))
  .map((f) => join(srcDir, f));

const MODULES = 'http|https|net|tls|dgram|dns';
const forbidden: [string, RegExp][] = [
  ['network module import', new RegExp(`(?:from|import|require)\\s*\\(?\\s*['"](?:node:)?(?:${MODULES})(?:/[\\w-]+)?['"]`)],
  ['require(', /\brequire\s*\(/],
  ['fetch(', /\bfetch\s*\(/],
  ['process.env', /\bprocess\.env\b/],
  ['console.log', /\bconsole\.log\b/],
];

describe('oracle/src has no network, env or stdout use', () => {
  it('scans at least one source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const [label, pattern] of forbidden) {
    it(`no file contains ${label}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
      expect(offenders).toEqual([]);
    });
  }
});
