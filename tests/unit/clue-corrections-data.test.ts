// Data tests for the corrected clues (proof-pass, Requirement 2.12 to 2.22).
// The fixtures in tests/fixtures/proof-pass/ were captured before any override edit.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_STRINGS, fnv1a32, sampleRows } from '../../scripts/lib/review-sample';
import { parseCsv } from '../helpers/csv';
import { hashRecord, hashRecordWithoutPrompt, sha256, type HashableRecord } from '../helpers/record-hashes';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');
const json = <T>(rel: string): T => JSON.parse(read(rel)) as T;

type Dataset = Record<string, HashableRecord & { prompt?: { meaning: string; pinyin: string } }>;
type RecordHashes = Record<string, { full: string; noPrompt: string }>;

const fixture = <T>(name: string): T => json<T>(`tests/fixtures/proof-pass/${name}`);
const dataset = (file: string): Dataset => json<Dataset>(`app/public/data/${file}`);

const changedChars = (data: Dataset, fixtures: RecordHashes): string[] =>
  Object.keys(fixtures).filter((c) => hashRecord(data[c]) !== fixtures[c].full);

describe('level 1 records', () => {
  const data = dataset('characters.json');
  const fixtures = fixture<RecordHashes>('level1-record-hashes.json');

  it('has the 300 fixture characters and no other', () => {
    expect(Object.keys(fixtures)).toHaveLength(300);
    expect(Object.keys(data).sort()).toEqual(Object.keys(fixtures).sort());
  });

  it('keeps the no-prompt hash of all 300 records', () => {
    const mismatches = Object.keys(fixtures).filter(
      (c) => hashRecordWithoutPrompt(data[c]) !== fixtures[c].noPrompt,
    );
    expect(mismatches).toEqual([]);
  });

  it('keeps the whole-record hash for exactly 298 records and changes 本 and 天', () => {
    const changed = changedChars(data, fixtures);
    expect(changed.sort()).toEqual(['天', '本'].sort());
    expect(Object.keys(fixtures).length - changed.length).toBe(298);
    expect(hashRecord(data['么'])).toBe(fixtures['么'].full);
  });

  it('keeps 第, 视, 奋 and 居 unchanged', () => {
    for (const c of ['第', '视', '奋', '居']) {
      if (c in fixtures) expect(hashRecord(data[c]), c).toBe(fixtures[c].full);
    }
  });

  it('gives 本 and 天 the requested text plus the reading of the selected entry', () => {
    expect(data['本'].prompt).toEqual({ meaning: 'root; stem', pinyin: 'běn' });
    expect(data['天'].prompt).toEqual({ meaning: 'sky', pinyin: 'tiān' });
  });
});

describe('level 1 data/prompt-review.csv', () => {
  const lines = read('data/prompt-review.csv').split('\n').filter((l) => l !== '');
  const fixtures = fixture<Record<string, string>>('prompt-review-level1-line-hashes.json');
  const byChar = new Map(lines.slice(1).map((l) => [l.slice(0, l.indexOf(',')), l] as const));

  it('keeps every line except 本 and 天 identical, the 么 line included', () => {
    expect(byChar.size).toBe(Object.keys(fixtures).length);
    const changed = Object.keys(fixtures).filter((c) => sha256(byChar.get(c) ?? '') !== fixtures[c]);
    expect(changed.sort()).toEqual(['天', '本'].sort());
    expect(sha256(byChar.get('么') ?? '')).toBe(fixtures['么']);
  });

  it('shows the new meaning and reviewedBy human on 本 and 天', () => {
    const rows = new Map(parseCsv(read('data/prompt-review.csv')).slice(1).map((r) => [r[0], r] as const));
    // columns: character, chosenMeaning, chosenPinyin, source, reviewedBy, alternatives
    expect(rows.get('本')?.slice(1, 5)).toEqual(['root; stem', 'běn', 'override', 'human']);
    expect(rows.get('天')?.slice(1, 5)).toEqual(['sky', 'tiān', 'override', 'human']);
  });
});

describe.each([
  { level: 2, file: 'characters-level2.json', fixtureName: 'level2-record-hashes.json', changed: ['云', '刚'] },
  { level: 3, file: 'characters-level3.json', fixtureName: 'level3-record-hashes.json', changed: ['获'] },
])('level $level records', ({ file, fixtureName, changed }) => {
  const data = dataset(file);
  const fixtures = fixture<RecordHashes>(fixtureName);

  it('has the fixture characters and no other', () => {
    expect(Object.keys(data).sort()).toEqual(Object.keys(fixtures).sort());
  });

  it('differs in the whole-record hash only in the corrected characters', () => {
    expect(changedChars(data, fixtures).sort()).toEqual([...changed].sort());
  });

  it('keeps the no-prompt hash everywhere', () => {
    const mismatches = Object.keys(fixtures).filter(
      (c) => hashRecordWithoutPrompt(data[c]) !== fixtures[c].noPrompt,
    );
    expect(mismatches).toEqual([]);
  });
});

describe('level 2 and 3 review files and clues', () => {
  const reviewRows = (level: 2 | 3): Map<string, string[]> =>
    new Map(parseCsv(read(`data/prompt-review-level${level}.csv`)).slice(1).map((r) => [r[0], r] as const));

  it('shows reviewedBy human for 云, 刚 and 获', () => {
    const l2 = reviewRows(2);
    const l3 = reviewRows(3);
    expect(l2.get('云')?.[4]).toBe('human');
    expect(l2.get('刚')?.[4]).toBe('human');
    expect(l3.get('获')?.[4]).toBe('human');
  });

  it('shows the requested clues', () => {
    const l2 = dataset('characters-level2.json');
    const l3 = dataset('characters-level3.json');
    expect(l2['云'].prompt).toEqual({ meaning: 'cloud', pinyin: 'yún' });
    expect(l2['刚'].prompt).toEqual({ meaning: 'just; only a short while ago', pinyin: 'gāng' });
    expect(l3['获'].prompt).toEqual({ meaning: 'to reap; to harvest', pinyin: 'huò' });
  });
});

describe('50-row review samples', () => {
  it('level 2 keeps the same characters at the same positions', () => {
    const fixtures = fixture<Record<string, string>>('prompt-review-sample-level2-line-hashes.json');
    const sample = parseCsv(read('data/prompt-review-sample-level2.csv')).slice(1);
    expect(sample.map((r) => r[0])).toEqual(Object.keys(fixtures));
  });

  it('level 2 changes only the 刚 row (and 云 if sampled, in reviewedBy)', () => {
    const fixtures = fixture<Record<string, string>>('prompt-review-sample-level2-line-hashes.json');
    const lines = read('data/prompt-review-sample-level2.csv').split('\n').filter((l) => l !== '').slice(1);
    const changed = lines
      .map((l) => l.slice(0, l.indexOf(',')))
      .filter((c, i) => sha256(lines[i]) !== fixtures[c]);
    expect(changed).toEqual(['刚']);
  });

  it('level 3 sample sits at the seeded row positions of the level 3 review file', () => {
    const rows = parseCsv(read('data/prompt-review-level3.csv')).slice(1);
    const positions = [...sampleRows(rows.length, 50, fnv1a32(SEED_STRINGS[3]))].sort((a, b) => a - b);
    const sample = parseCsv(read('data/prompt-review-sample-level3.csv')).slice(1);
    expect(sample.map((r) => r[0])).toEqual(positions.map((p) => rows[p][0]));
  });
});

describe('levels.json example meanings', () => {
  it('are the nine unchanged meanings and use no corrected clue', () => {
    const text = read('app/public/data/levels.json');
    for (const meaning of ['child', 'year', 'now', 'level', 'to stretch', 'to break', 'to discuss', 'window', 'brave']) {
      expect(text, meaning).toContain(`"${meaning}"`);
    }
    const levels = JSON.parse(text) as unknown;
    const meanings = JSON.stringify(levels);
    for (const corrected of ['root; stem', '"sky"', '"cloud"', 'just; only a short while ago', 'to reap; to harvest']) {
      expect(meanings.includes(corrected), corrected).toBe(false);
    }
  });
});
