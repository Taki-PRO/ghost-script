import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Requirement 30.5: no tracked text file names a person.
// The token is assembled from parts so this file does not contain it.
const repoRoot = resolve(__dirname, '..', '..');
const nameToken = new RegExp(['Tak', 'shil'].join(''), 'i');

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i;
const SKIPPED_DIRS = /(^|\/)(node_modules|dist|\.git|test-results|playwright-report)\//;

function isExempt(path: string): boolean {
  return (
    path === 'kiro-log.md' ||
    path.startsWith('.kiro/steering/') ||
    path === 'tasks.meta.json' ||
    path.endsWith('/tasks.meta.json')
  );
}

function trackedTextFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter((p) => p !== '')
    .filter((p) => !BINARY_EXTENSIONS.test(p) && !SKIPPED_DIRS.test(p) && !isExempt(p));
}

describe('no personal names in repo files', () => {
  it('no tracked text file contains the name token', () => {
    const offenders: string[] = [];
    for (const path of trackedTextFiles()) {
      const full = resolve(repoRoot, path);
      if (!existsSync(full)) continue; // deleted in the working tree
      if (nameToken.test(readFileSync(full, 'utf8'))) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it('exempts kiro-log.md, the steering files and tasks.meta.json files', () => {
    expect(isExempt('kiro-log.md')).toBe(true);
    expect(isExempt('.kiro/steering/structure.md')).toBe(true);
    expect(isExempt('.kiro/specs/x/tasks.meta.json')).toBe(true);
    expect(isExempt('README.md')).toBe(false);
  });
});
