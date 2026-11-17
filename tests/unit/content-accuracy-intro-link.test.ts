import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..', '..');
const steering = readFileSync(resolve(repoRoot, '.kiro/steering/content-accuracy.md'), 'utf8');

function section(heading: string): string {
  const start = steering.indexOf(`## ${heading}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = steering.slice(start + 3);
  const next = rest.indexOf('\n## ');
  return next === -1 ? rest : rest.slice(0, next);
}

describe('content-accuracy: the intro cites by link', () => {
  it('has the section heading', () => {
    expect(steering).toContain('## The intro cites by link');
  });

  it('names the Sources & licences screen and both citation sources', () => {
    const text = section('The intro cites by link');
    expect(text).toContain('Sources & licences');
    expect(text).toContain('CANGJIE_CITATIONS');
    expect(text).toContain('LEGEND_SOURCE.citation');
  });

  it('keeps the approved legend line section', () => {
    expect(steering).toContain('## Approved legend line');
  });
});
