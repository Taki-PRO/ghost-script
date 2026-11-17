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

  it('has the screenshot-review rules (approved by the human)', () => {
    expect(text).toMatch(/Moon is a full disc of 4 rem in the top right/);
    expect(text).toMatch(/never lies under text/);
    expect(text).toMatch(/top room of 4\.75 rem/);
    expect(text).toMatch(/992 px/);
    expect(text).toMatch(/0\.18 at 88% and 0\.10 at 72%/);
    expect(text).toMatch(/ghost is an ink wash/);
    expect(text).toMatch(/same shape at every size/);
    expect(text).toMatch(/seal sits in the paper margin and covers no stroke/);
  });

  it('keeps the Primary_Action table', () => {
    expect(text).toContain('| Intro | Begin the Séance |');
    expect(text).toContain('| Summary | Begin another Séance |');
  });

  it('names the ambient and rite-timing exemptions', () => {
    expect(text).toMatch(/Ambient exemption/);
    expect(text).toMatch(/Rite-timing exemption/);
  });
});
