// The Rule_Changes_File (data/prompt-rule-changes.csv) agrees with the
// committed level datasets, the character lists and the Current_Rule
// (harder-ghosts, task 15.6). Plain unit tests over the real files.
//
// Requirements: 18.13, 18.19
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { parseCcCedict } from '../../scripts/lib/parse-cc-cedict';
import { parseCharacterList } from '../../scripts/lib/parse-character-list';
import { parsePromptApprovals } from '../../scripts/lib/parse-prompt-approvals';
import { parsePromptOverrides } from '../../scripts/lib/parse-prompt-overrides';
import { selectPrompt } from '../../scripts/lib/prompt';
import { RULE_CHANGES_HEADER } from '../../scripts/lib/rule-changes';

const ROOT = resolve(__dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(resolve(ROOT, ...p), 'utf8');

/** RFC 4180 parser: quoted fields, doubled quotes, LF or CRLF line ends. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

type Level = 2 | 3;
const LEVELS: Level[] = [2, 3];

const csvRows = parseCsv(read('data', 'prompt-rule-changes.csv'));
const header = csvRows[0] ?? [];
const rows = csvRows.slice(1).map((r) => ({
  character: r[0],
  level: Number(r[1]),
  oldPinyin: r[2],
  oldMeaning: r[3],
  newPinyin: r[4],
  newMeaning: r[5],
  width: r.length,
}));

const cc = parseCcCedict(read('data', 'raw', 'cc-cedict', 'cedict_ts.u8'));

function listOf(level: Level): string[] {
  const parsed = parseCharacterList(read('data', `character-list-level${level}.txt`));
  if (!parsed.ok) throw new Error(`character-list-level${level}.txt is invalid`);
  return parsed.characters;
}
function datasetOf(level: Level): Record<string, CharacterRecord> {
  return JSON.parse(read('app', 'public', 'data', `characters-level${level}.json`)) as Record<
    string,
    CharacterRecord
  >;
}
function overridesOf(level: Level): Set<string> {
  const path = resolve(ROOT, 'data', `prompt-overrides-level${level}.csv`);
  if (!existsSync(path)) return new Set();
  const parsed = parsePromptOverrides(readFileSync(path, 'utf8'));
  if (!parsed.ok) throw new Error(`prompt-overrides-level${level}.csv is invalid`);
  return new Set(parsed.overrides.keys());
}
function approvals(): Set<string> {
  const path = resolve(ROOT, 'data', 'prompt-approvals.csv');
  if (!existsSync(path)) return new Set();
  const parsed = parsePromptApprovals(readFileSync(path, 'utf8'));
  if (!parsed.ok) throw new Error('prompt-approvals.csv is invalid');
  return parsed.approvals;
}

const lists = { 2: listOf(2), 3: listOf(3) };
const datasets = { 2: datasetOf(2), 3: datasetOf(3) };
const overrides = { 2: overridesOf(2), 3: overridesOf(3) };
const approved = approvals();
const hasHumanChoice = (level: Level, ch: string): boolean =>
  overrides[level].has(ch) || approved.has(ch);

/** Characters of a level whose dataset prompt differs from the Current_Rule's. */
function expectedChanges(level: Level): { character: string; oldPinyin: string; oldMeaning: string }[] {
  const out: { character: string; oldPinyin: string; oldMeaning: string }[] = [];
  for (const ch of lists[level]) {
    if (hasHumanChoice(level, ch)) continue;
    const entry = cc.get(ch);
    const current = entry === undefined ? undefined : selectPrompt(ch, entry, undefined);
    if (current === undefined || !current.ok) continue;
    const prompt = datasets[level][ch].prompt;
    if (current.choice.pinyin !== prompt.pinyin || current.choice.meaning !== prompt.meaning) {
      out.push({
        character: ch,
        oldPinyin: current.choice.pinyin,
        oldMeaning: current.choice.meaning,
      });
    }
  }
  return out;
}

describe('Rule_Changes_File agrees with the datasets', () => {
  it('has the exact fixed header and six columns in every row', () => {
    expect(header.join(',')).toBe(RULE_CHANGES_HEADER);
    expect(RULE_CHANGES_HEADER).toBe('character,level,oldPinyin,oldMeaning,newPinyin,newMeaning');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.width, row.character).toBe(6);
  });

  it('every row is for a level 2 or 3 character in that level list and dataset', () => {
    const failures: string[] = [];
    for (const row of rows) {
      if (row.level !== 2 && row.level !== 3) {
        failures.push(`${row.character}: bad level ${row.level}`);
        continue;
      }
      const level = row.level;
      if (!lists[level].includes(row.character)) failures.push(`${row.character}: not in level ${level} list`);
      if (datasets[level][row.character] === undefined) failures.push(`${row.character}: not in level ${level} dataset`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('new pinyin and meaning equal the dataset prompt', () => {
    const failures: string[] = [];
    for (const row of rows) {
      const record = datasets[row.level as Level]?.[row.character];
      if (record === undefined) continue;
      if (record.prompt.pinyin !== row.newPinyin || record.prompt.meaning !== row.newMeaning) {
        failures.push(`${row.character}: file "${row.newPinyin}" / "${row.newMeaning}", dataset "${record.prompt.pinyin}" / "${record.prompt.meaning}"`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('old pinyin and meaning equal the Current_Rule choice over the CC-CEDICT data', () => {
    const failures: string[] = [];
    for (const row of rows) {
      const entry = cc.get(row.character);
      const current = entry === undefined ? undefined : selectPrompt(row.character, entry, undefined);
      if (current === undefined || !current.ok) {
        failures.push(`${row.character}: Current_Rule yields no prompt`);
        continue;
      }
      if (current.choice.pinyin !== row.oldPinyin || current.choice.meaning !== row.oldMeaning) {
        failures.push(`${row.character}: file "${row.oldPinyin}" / "${row.oldMeaning}", rule "${current.choice.pinyin}" / "${current.choice.meaning}"`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('every row differs between old and new', () => {
    const same = rows.filter((r) => r.oldPinyin === r.newPinyin && r.oldMeaning === r.newMeaning);
    expect(same.map((r) => r.character)).toEqual([]);
  });

  it('no row is for an override or approval character', () => {
    const bad = rows.filter((r) => hasHumanChoice(r.level as Level, r.character));
    expect(bad.map((r) => r.character)).toEqual([]);
  });

  it('lists each changed character exactly once, level 2 then level 3, in list order', () => {
    const expected = LEVELS.flatMap((level) =>
      expectedChanges(level).map((c) => ({ character: c.character, level })),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(rows.map((r) => ({ character: r.character, level: r.level }))).toEqual(expected);
    expect(new Set(rows.map((r) => `${r.level}:${r.character}`)).size).toBe(rows.length);
  });

  it('marks every changed record unreviewed unless an override or approval exists', () => {
    const failures: string[] = [];
    for (const level of LEVELS) {
      for (const ch of lists[level]) {
        const entry = cc.get(ch);
        const current = entry === undefined ? undefined : selectPrompt(ch, entry, undefined);
        if (current === undefined || !current.ok) continue;
        const record = datasets[level][ch];
        const changed =
          current.choice.pinyin !== record.prompt.pinyin ||
          current.choice.meaning !== record.prompt.meaning;
        if (!changed) continue;
        const want = hasHumanChoice(level, ch) ? 'reviewed' : 'unreviewed';
        if (record.promptReview !== want) {
          failures.push(`${ch} (level ${level}): promptReview ${String(record.promptReview)}, want ${want}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
