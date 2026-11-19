import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// night-sounds amendment A5 (approved by the human): "Things to avoid"

const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/tech.md'), 'utf8');

const audioBullet =
  '- Audio files, samples, `Audio` elements and audio libraries. All sound is synthesised in code with the Web Audio API and loaded from nowhere.';
const gitignoreBullet = '- Adding `.kiro/` to `.gitignore`. It must stay in the repo for judging.';

describe('tech steering file, Things to avoid', () => {
  it('has the approved audio bullet', () => {
    expect(text).toContain(audioBullet);
  });

  it('puts the audio bullet inside Things to avoid, before the .gitignore bullet', () => {
    const section = text.indexOf('## Things to avoid');
    const audio = text.indexOf(audioBullet);
    const ignore = text.indexOf(gitignoreBullet);
    expect(section).toBeGreaterThan(-1);
    expect(audio).toBeGreaterThan(section);
    expect(ignore).toBeGreaterThan(audio);
  });
});
