import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// proof-pass amendment 2 (approved by the human): core game loop step 2, Summon line

const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/product.md'), 'utf8');

describe('product steering file, core loop step 2', () => {
  it('has the approved Summon line, split between first meeting and returning ghost', () => {
    expect(text).toContain(
      "   - **Summon:** type the character's Cangjie code (physical or on-screen keyboard); each key reveals one shape. On a first meeting the character then forms and fades. On a returning ghost only the shapes the keys inked appear, and writing starts at once.",
    );
  });

  it('no longer says every summon ends with the character forming and fading', () => {
    expect(text).not.toContain('each key reveals one shape until the character forms, then it fades.');
  });

  it('keeps the Lay to rest step after the Summon line', () => {
    const summon = text.indexOf('**Summon:**');
    const rest = text.indexOf('**Lay to rest:**');
    expect(summon).toBeGreaterThan(-1);
    expect(rest).toBeGreaterThan(summon);
  });
});
