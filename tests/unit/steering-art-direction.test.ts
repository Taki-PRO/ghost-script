import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ink-and-candlelight Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7

const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/art-direction.md'), 'utf8');

describe('art-direction steering file', () => {
  it('starts with front matter whose inclusion is always', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/^inclusion: always$/m);
  });

  it.each(['## Direction', '## Palette', '### Primary action per screen', '## The ghost', '## Motion', '## Cultural care', '## Sound'])(
    'has the heading %s',
    (heading) => {
      expect(text).toContain(`\n${heading}\n`);
    },
  );

  it('names the ambient and rite-timing exemptions', () => {
    expect(text).toMatch(/Ambient exemption/);
    expect(text).toMatch(/Rite-timing exemption/);
  });
});
