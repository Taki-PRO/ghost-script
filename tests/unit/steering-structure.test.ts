import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// night-sounds amendment A6 (approved by the human): the project tree gains the audio/ line

const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/structure.md'), 'utf8');

const AUDIO_LINE =
  '│       ├── audio/       # Web Audio sound engine: voice limits, recipes, engine, provider';
const STORAGE_LINE = '│       ├── storage/     # localStorage wrapper';

describe('structure steering file, project tree', () => {
  it('has the approved audio/ line', () => {
    expect(text).toContain(AUDIO_LINE);
  });

  it('puts the audio/ line directly after the storage/ line', () => {
    expect(text).toContain(`${STORAGE_LINE}\n${AUDIO_LINE}\n`);
  });

  it('has the audio/ line exactly once', () => {
    expect(text.split(AUDIO_LINE).length - 1).toBe(1);
  });
});
