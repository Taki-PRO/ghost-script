import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// proof-pass Requirements 1.1, 14.2, 14.15 (amendment 1, approved by the human)
const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/content-accuracy.md'), 'utf8');

describe('content-accuracy steering file', () => {
  it('limits the full summon reveal to a first meeting (approved by the human)', () => {
    expect(text).toContain(
      '- The designed summon reveal, for a first meeting only: once the code is complete, the character forms, holds and fades before writing starts. The plain-text fallback used when the animation fails follows the same timing and is also allowed for a first meeting. For a returning ghost, only the parts that the typed keys inked are shown. Nothing is held or faded, and the plain-text fallback is not allowed; if the animation fails, writing starts with nothing shown.',
    );
  });

  it('allows one drawn sample per level and no Han character as text on the level screen (amendment 4, approved by the human)', () => {
    expect(text).toContain(
      "- The level screen shows English example meanings and may draw one sample character per level from its stroke data (the hanzi-writer-data outlines, written into the Level_Manifest by the data pipeline). Each sample is at position 31 or later of its level's learning order and is chosen by the stroke-count rule: the stroke count closest to the level's average, ties to the lowest position. No Han character appears as text on the level screen. The Graveyard shows the glyph of a character with a Review entry at any level.",
    );
    expect(text).not.toContain('English example meanings, never a character');
  });

  it('no longer allows the reveal without the first-meeting limit', () => {
    expect(text).not.toContain('- The designed summon reveal: once the code is complete');
    expect(text).not.toMatch(/follows the same timing and is also allowed\./);
  });
});
