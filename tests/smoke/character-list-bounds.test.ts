import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCharacterList } from '../../scripts/lib/parse-character-list';

// Smoke test for the shipped data/character-list.txt.
//
// Unlike the unit tests (which feed synthetic input into parseCharacterList),
// this reads the REAL file on disk and asserts the project-level bounds the
// design requires: a sourced `#` header, 280–320 real entries, no duplicates,
// and every entry a valid single CJK codepoint. The CJK-validity + duplicate
// checks are delegated to parseCharacterList (the same parser the pipeline
// uses), so this test stays in sync with the production rules.

// Resolve data/character-list.txt relative to the repo root. This file lives
// at <root>/tests/smoke/, so the root is two directories up.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const characterListPath = resolve(repoRoot, 'data', 'character-list.txt');

describe('data/character-list.txt bounds', () => {
  const raw = readFileSync(characterListPath, 'utf8');
  const lines = raw.split('\n');

  it('starts with a # comment line', () => {
    expect(lines[0].trim().startsWith('#')).toBe(true);
  });

  it('has between 280 and 320 non-comment, non-blank lines', () => {
    const entryCount = lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('#');
    }).length;

    expect(entryCount).toBeGreaterThanOrEqual(280);
    expect(entryCount).toBeLessThanOrEqual(320);
  });

  it('parses cleanly: all entries are valid single CJK codepoints with no duplicates', () => {
    const result = parseCharacterList(raw);
    // ok: true is only returned when every entry is a single U+4E00–U+9FFF
    // codepoint and there are zero duplicates, so this one assertion covers
    // both CJK validity and uniqueness. Surface any errors on failure.
    if (!result.ok) {
      expect.fail(
        `parseCharacterList reported errors: ${JSON.stringify(result.errors, null, 2)}`,
      );
    }
    expect(result.ok).toBe(true);
  });
});
