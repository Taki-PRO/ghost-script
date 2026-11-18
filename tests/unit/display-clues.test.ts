// Displayed clues of every record of the three level datasets (proof-pass,
// task 5.6). The displayed clue is maskTarget(cleanupMeaning(meaning), character),
// as GhostPrompt shows it. Plain exhaustive loops over every record.
//
// Requirements: 2.30, 2.31, 2.33, 2.34
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { maskTarget } from '../../app/src/engine/mask';
import { cleanupMeaning } from '../../app/src/engine/promptCleanup';

const DATA = resolve(__dirname, '..', '..', 'app', 'public', 'data');
const HAN = /\p{Script=Han}/u;

const LEVELS = [
  { level: 1, file: 'characters.json' },
  { level: 2, file: 'characters-level2.json' },
  { level: 3, file: 'characters-level3.json' },
] as const;

// ---------------------------------------------------------------------------
// Literal copy of the cleanup as it was before the pair rule (the steps of
// `step` without removeTraditionalHalves), kept here as the "before" display.
// ---------------------------------------------------------------------------
const NOTE_PAREN_START = /\((?:CL:|e\.g\.|Taiwan pr\.)/;
const BARE_CL_START = /(^|[^A-Za-z0-9])CL:/;
const PR_NOTE = /(?:[A-Za-z]+\s+)?pr\.\s*\[[^\]]*\]/g;
const BRACKET_REF = /\[[^[\]]*\]/g;

function endOfParenthetical(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
}

function endOfClause(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') {
      if (depth === 0) {
        if (c === ')') return i;
      } else depth--;
    } else if (c === ';' && depth === 0) return i;
  }
  return s.length;
}

function oldStep(s: string): string {
  let out = s;
  for (let m = NOTE_PAREN_START.exec(out); m !== null; m = NOTE_PAREN_START.exec(out)) {
    out = out.slice(0, m.index) + out.slice(endOfParenthetical(out, m.index));
  }
  for (let m = BARE_CL_START.exec(out); m !== null; m = BARE_CL_START.exec(out)) {
    const start = m.index + (m[1]?.length ?? 0);
    out = out.slice(0, start) + out.slice(endOfClause(out, start + 3));
  }
  out = out.replace(PR_NOTE, '').replace(BRACKET_REF, '').replace(/\(\s*\)/gu, '');
  out = out.replace(/\s+/gu, (run) => run.charAt(0));
  out = out.replace(/;(?:\s*;)+/gu, ';');
  out = out.replace(/^[\s;,]+/u, '').replace(/[\s;,]+$/u, '');
  return out;
}

function oldCleanupMeaning(raw: string): string {
  let current = raw;
  for (;;) {
    const next = oldStep(current);
    if (next === current) break;
    current = next;
  }
  return current.trim() === '' ? raw : current;
}

function load(file: string): CharacterRecord[] {
  const records = JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as Record<
    string,
    CharacterRecord
  >;
  return Object.values(records);
}

const displayed = (r: CharacterRecord): string =>
  maskTarget(cleanupMeaning(r.prompt.meaning), r.character);
const displayedBefore = (r: CharacterRecord): string =>
  maskTarget(oldCleanupMeaning(r.prompt.meaning), r.character);

describe('displayed clues of every record', () => {
  for (const { level, file } of LEVELS) {
    const records = load(file);

    it(`level ${level}: no displayed clue contains its target character`, () => {
      expect(records.length).toBeGreaterThan(0);
      const failures = records
        .filter((r) => displayed(r).includes(r.character))
        .map((r) => `${r.character} (level ${level}): "${displayed(r)}"`);
      expect(failures, failures.join('\n')).toEqual([]);
    });

    if (level >= 2) {
      it(`level ${level}: no displayed clue contains a Han character`, () => {
        const failures = records
          .filter((r) => HAN.test(displayed(r)))
          .map((r) => `${r.character} (level ${level}): "${displayed(r)}"`);
        expect(failures, failures.join('\n')).toEqual([]);
      });
    }
  }

  it('counts the displayed clues changed by the pair rule: 1, 0, 0', () => {
    const counts: number[] = [];
    const changedChars: string[][] = [];
    for (const { file } of LEVELS) {
      const changed = load(file).filter((r) => displayed(r) !== displayedBefore(r));
      counts.push(changed.length);
      changedChars.push(changed.map((r) => r.character));
    }
    console.log(
      `Displayed clue changes: level 1: ${counts[0]}, level 2: ${counts[1]}, level 3: ${counts[2]}`,
    );
    console.log(
      `Changed characters: level 1: [${changedChars[0]?.join(' ')}], level 2: [${changedChars[1]?.join(' ')}], level 3: [${changedChars[2]?.join(' ')}]`,
    );
    expect(counts).toEqual([1, 0, 0]);
    expect(changedChars[0]).toEqual(['么']);
  });
});
