// Feature: character-dataset, Task 16.1 — full-pipeline integration test.
//
// This test drives the REAL pipeline over the REAL repo data: it calls
// buildDataset with the actual paths in data/raw/ and data/character-list.txt,
// then makes concrete assertions over every one of the 300 produced records.
//
// Unlike the fast-check property tests in tests/property/ (which generate
// synthetic inputs), this is a single real build followed by a loop over the
// real output — so it surfaces real-data surprises (a bad gloss, a mismatched
// reading, a missing field) that synthetic generators cannot.
//
// Baseline assertions (Task 16.1 core):
//   - result.ok === true
//   - record count === non-comment/non-blank lines in character-list.txt (300)
//   - spot-checked well-known characters have well-formed fields + usable prompt
//   - result.promptReviewCsv is produced with the expected header + 300 rows
//
// Real-data property checks (Properties 8, 9, 11–16, 18–22 from design.md) are
// asserted over ALL 300 records in the "real-data property checks" describe.
// The test NEVER writes data/prompt-review.csv — it uses the returned string.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { buildDataset } from '../../scripts/build-data';
import type { BuildOptions, CharacterRecord } from '../../app/src/data/types';
import {
  parseCcCedict,
  type CcCedictEntry,
} from '../../scripts/lib/parse-cc-cedict';
import { numberedToToneMarks } from '../../scripts/lib/prompt';

// --- Path resolution (relative to repo root via import.meta.url) ------------

// This file lives at <root>/tests/integration/, so the repo root is two
// directories up.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const atRoot = (p: string): string => resolve(repoRoot, p);

const CHARACTER_LIST_PATH = atRoot('data/character-list.txt');
const HANZI_WRITER_DATA_DIR = atRoot('data/raw/hanzi-writer-data');
const MAKE_ME_A_HANZI_PATH = atRoot('data/raw/make-me-a-hanzi/dictionary.txt');
const CC_CEDICT_PATH = atRoot('data/raw/cc-cedict/cedict_ts.u8');
const PROMPT_OVERRIDES_PATH = atRoot('data/prompt-overrides.csv');

const BUILD_OPTIONS: BuildOptions = {
  characterListPath: CHARACTER_LIST_PATH,
  hanziWriterDataDir: HANZI_WRITER_DATA_DIR,
  makeMeAHanziPath: MAKE_ME_A_HANZI_PATH,
  ccCedictPath: CC_CEDICT_PATH,
  promptOverridesPath: PROMPT_OVERRIDES_PATH,
  // NOTE: no promptReviewPath — buildDataset does not write it. main() writes
  // data/prompt-review.csv; this test uses result.promptReviewCsv directly and
  // never touches the real file.
};

const REVIEW_HEADER =
  'character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives';

const QUESTION_MARK = '\uFF1F'; // ？ U+FF1F
const BOUND_FORM_PREFIX = '(bound form) ';

/** Codepoint ranges of the five recognised component blocks. */
const COMPONENT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Extension A
  [0x2e80, 0x2eff], // CJK Radicals Supplement
  [0x2f00, 0x2fdf], // Kangxi Radicals
  [0x31c0, 0x31ef], // CJK Strokes
];

/** The nine skipped prefixes from scripts/lib/prompt.ts (lowercased). */
const SKIPPED_PREFIXES = [
  'surname ',
  'variant of',
  'old variant of',
  'used in',
  'see ',
  'abbr.',
  'cl:',
  'also pr.',
  'taiwan pr.',
] as const;

// --- Small helpers ----------------------------------------------------------

function isRecognisedComponentCodepoint(cp: number): boolean {
  return COMPONENT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

function isIdc(cp: number): boolean {
  return cp >= 0x2ff0 && cp <= 0x2ffb;
}

/** Codepoint of a single-codepoint string, or undefined if not exactly one. */
function singleCodePoint(ch: string): number | undefined {
  const points = Array.from(ch);
  if (points.length !== 1) {
    return undefined;
  }
  return points[0].codePointAt(0);
}

/** Strip a single leading "(bound form) " prefix (mirrors prompt.ts). */
function stripBoundForm(gloss: string): string {
  if (gloss.startsWith(BOUND_FORM_PREFIX)) {
    return gloss.slice(BOUND_FORM_PREFIX.length).trim();
  }
  return gloss.trim();
}

/** Count the non-comment, non-blank lines exactly like the pipeline does. */
function countListEntries(raw: string): number {
  return raw.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('#');
  }).length;
}

// --- Type guards at the JSON boundary (no `any`) ----------------------------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isCharacterRecord(value: unknown): value is CharacterRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  if (typeof r.character !== 'string') return false;
  if (!isStringArray(r.pinyin)) return false;
  if (!isStringArray(r.meanings)) return false;
  if (typeof r.strokeCount !== 'number') return false;
  if (typeof r.strokeData !== 'object' || r.strokeData === null) return false;
  const sd = r.strokeData as Record<string, unknown>;
  if (!isStringArray(sd.strokes)) return false;
  if (typeof r.decomposition !== 'object' || r.decomposition === null)
    return false;
  const d = r.decomposition as Record<string, unknown>;
  if (typeof d.decomposition !== 'string') return false;
  if (typeof d.atomic !== 'boolean') return false;
  if (!isStringArray(d.components)) return false;
  if (typeof r.prompt !== 'object' || r.prompt === null) return false;
  const p = r.prompt as Record<string, unknown>;
  if (typeof p.meaning !== 'string') return false;
  if (typeof p.pinyin !== 'string') return false;
  return true;
}

/** Parse the serialised output into a typed record map (with guards). */
function parseRecords(output: string): Map<string, CharacterRecord> {
  const parsed: unknown = JSON.parse(output);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('output is not a JSON object');
  }
  const map = new Map<string, CharacterRecord>();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isCharacterRecord(value)) {
      throw new Error(`record for "${key}" failed the shape guard`);
    }
    map.set(key, value);
  }
  return map;
}

/** Parse the review CSV into rows of fields (RFC-4180 aware). */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }
  // Trailing field/row (when the file does not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Among a character's CC-CEDICT entries, find one whose tone-mark reading
 * equals `pinyin` AND whose stripped glosses include `meaning`. Returns the
 * index of the first such entry, or -1. This is the same-entry provenance
 * check used for Properties 18, 19 and 22.
 */
function findProvenanceEntry(
  cc: CcCedictEntry | undefined,
  meaning: string,
  pinyin: string,
): number {
  if (cc === undefined) {
    return -1;
  }
  for (let i = 0; i < cc.entries.length; i++) {
    const entry = cc.entries[i];
    if (numberedToToneMarks(entry.reading) !== pinyin) {
      continue;
    }
    const stripped = entry.meanings.map(stripBoundForm);
    if (stripped.includes(meaning)) {
      return i;
    }
  }
  return -1;
}

// --- One build, shared across every test ------------------------------------

let output: string;
let promptReviewCsv: string;
let records: Map<string, CharacterRecord>;
let characterListRaw: string;
let ccCedict: Map<string, CcCedictEntry>;
let overrideCharacters: Set<string>;

beforeAll(async () => {
  const result = await buildDataset(BUILD_OPTIONS);
  if (!result.ok) {
    throw new Error(
      `buildDataset failed on real data:\n${JSON.stringify(result.errors, null, 2)}`,
    );
  }
  output = result.output;
  promptReviewCsv = result.promptReviewCsv;
  records = parseRecords(output);

  characterListRaw = await readFile(CHARACTER_LIST_PATH, 'utf8');

  const ccRaw = await readFile(CC_CEDICT_PATH, 'utf8');
  ccCedict = parseCcCedict(ccRaw);

  // The override characters, read from the real overrides CSV (header + rows).
  const overridesRaw = await readFile(PROMPT_OVERRIDES_PATH, 'utf8');
  overrideCharacters = new Set(
    overridesRaw
      .split('\n')
      .slice(1) // drop header
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(',')[0]),
  );
}, 60_000);

// --- Part 1: baseline assertions --------------------------------------------

describe('full pipeline — baseline', () => {
  it('builds successfully (result.ok === true)', () => {
    // If the build had failed, beforeAll would have thrown. Re-assert the
    // observable consequence: we have a non-empty serialised output.
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('produces one record per non-comment list line (expected 300)', () => {
    const expected = countListEntries(characterListRaw);
    expect(expected).toBe(300);
    expect(records.size).toBe(expected);
  });

  it('spot-checks well-known characters for well-formed fields and a usable prompt', () => {
    const sample = ['我', '你', '好', '人', '口'];
    for (const char of sample) {
      const record = records.get(char);
      expect(record, `record for ${char} should exist`).toBeDefined();
      if (record === undefined) {
        continue;
      }

      expect(record.character).toBe(char);

      expect(record.pinyin.length).toBeGreaterThanOrEqual(1);
      expect(record.pinyin.every((p) => p.length > 0)).toBe(true);

      expect(record.meanings.length).toBeGreaterThanOrEqual(1);
      expect(record.meanings.every((m) => m.length > 0)).toBe(true);

      expect(Number.isInteger(record.strokeCount)).toBe(true);
      expect(record.strokeCount).toBeGreaterThanOrEqual(1);

      expect(record.strokeData.strokes.length).toBeGreaterThanOrEqual(1);

      expect(record.decomposition).toBeDefined();
      expect(Array.isArray(record.decomposition.components)).toBe(true);
      expect(record.decomposition.components.length).toBeGreaterThanOrEqual(1);

      expect(record.prompt.meaning.length).toBeGreaterThan(0);
      expect(record.prompt.pinyin.length).toBeGreaterThan(0);
    }
  });

  it('spot-checked prompts give a usable clue (not a surname / abbr.)', () => {
    const sample = ['我', '你', '好', '人', '口'];
    for (const char of sample) {
      const record = records.get(char);
      expect(record).toBeDefined();
      if (record === undefined) {
        continue;
      }
      const lower = record.prompt.meaning.toLowerCase();
      expect(lower.startsWith('surname ')).toBe(false);
      expect(lower.startsWith('abbr.')).toBe(false);
    }
  });

  it('produces a prompt-review CSV with the expected header and 300 data rows', () => {
    expect(typeof promptReviewCsv).toBe('string');
    expect(promptReviewCsv.length).toBeGreaterThan(0);

    const rows = parseCsvRows(promptReviewCsv);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].join(',')).toBe(REVIEW_HEADER);

    const dataRows = rows.slice(1);
    expect(dataRows.length).toBe(300);
  });
});

// --- Part 2: real-data property checks over all 300 records -----------------

describe('real-data property checks (all 300 records)', () => {
  it('Property 8: every component is a single recognised-block codepoint, never ？ or an IDC', () => {
    for (const [char, record] of records) {
      for (const component of record.decomposition.components) {
        const cp = singleCodePoint(component);
        expect(cp, `component "${component}" of ${char} is single-codepoint`).toBeDefined();
        if (cp === undefined) {
          continue;
        }
        expect(component, `component of ${char} is not ？`).not.toBe(QUESTION_MARK);
        expect(isIdc(cp), `component of ${char} is not an IDC`).toBe(false);
        expect(
          isRecognisedComponentCodepoint(cp),
          `component "${component}" (U+${cp.toString(16)}) of ${char} is in a recognised block`,
        ).toBe(true);
      }
    }
  });

  it('Property 9: atomic records have exactly one component equal to the character', () => {
    for (const [char, record] of records) {
      if (record.decomposition.atomic !== true) {
        continue;
      }
      expect(record.decomposition.components, `${char} atomic components length`).toHaveLength(1);
      expect(record.decomposition.components[0]).toBe(char);
    }
  });

  it('Property 11: record count equals character-list non-comment line count', () => {
    expect(records.size).toBe(countListEntries(characterListRaw));
  });

  it('Property 12: every list character is a key exactly once; no extra keys', () => {
    const listChars = characterListRaw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    // No duplicates in the list, and every list char is a key.
    const seen = new Set<string>();
    for (const char of listChars) {
      expect(seen.has(char), `${char} appears once in the list`).toBe(false);
      seen.add(char);
      expect(records.has(char), `${char} is a key in the output`).toBe(true);
    }
    // No extra keys beyond the list.
    for (const key of records.keys()) {
      expect(seen.has(key), `output key ${key} is in the character list`).toBe(true);
    }
    expect(records.size).toBe(seen.size);
  });

  it('Property 13: pinyin has length >= 1 and all elements non-empty', () => {
    for (const [char, record] of records) {
      expect(record.pinyin.length, `${char} pinyin length`).toBeGreaterThanOrEqual(1);
      for (const p of record.pinyin) {
        expect(p.length, `${char} pinyin element non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('Property 14: meanings has length >= 1 and all elements non-empty', () => {
    for (const [char, record] of records) {
      expect(record.meanings.length, `${char} meanings length`).toBeGreaterThanOrEqual(1);
      for (const m of record.meanings) {
        expect(m.length, `${char} meaning element non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('Property 15: strokeCount is a positive integer equal to strokeData.strokes.length', () => {
    for (const [char, record] of records) {
      expect(Number.isInteger(record.strokeCount), `${char} strokeCount integer`).toBe(true);
      expect(record.strokeCount, `${char} strokeCount > 0`).toBeGreaterThan(0);
      expect(record.strokeCount, `${char} strokeCount === strokes.length`).toBe(
        record.strokeData.strokes.length,
      );
    }
  });

  it('Property 16: every non-sentinel IDS codepoint is a component-block codepoint, an IDC, or ？', () => {
    for (const [char, record] of records) {
      const ids = record.decomposition.decomposition;
      if (ids === QUESTION_MARK) {
        continue; // the ？ sentinel is excluded by the property premise.
      }
      for (const ch of ids) {
        const cp = ch.codePointAt(0);
        expect(cp, `${char} IDS codepoint defined`).toBeDefined();
        if (cp === undefined) {
          continue;
        }
        const ok =
          isRecognisedComponentCodepoint(cp) || isIdc(cp) || ch === QUESTION_MARK;
        expect(
          ok,
          `${char} IDS char "${ch}" (U+${cp.toString(16)}) is a recognised block / IDC / ？`,
        ).toBe(true);
      }
    }
  });

  it('Property 18: prompt.meaning is a source gloss (after optional (bound form) stripping) of some entry', () => {
    for (const [char, record] of records) {
      const cc = ccCedict.get(char);
      expect(cc, `${char} has CC-CEDICT data`).toBeDefined();
      if (cc === undefined) {
        continue;
      }
      expect(record.prompt.meaning.length, `${char} prompt.meaning non-empty`).toBeGreaterThan(0);

      const allStripped = cc.entries.flatMap((e) => e.meanings.map(stripBoundForm));
      expect(
        allStripped.includes(record.prompt.meaning),
        `${char} prompt.meaning "${record.prompt.meaning}" is a (bound-form-stripped) source gloss`,
      ).toBe(true);
    }
  });

  it('Property 19: prompt.pinyin is the tone-mark form of one of the character CC-CEDICT readings', () => {
    for (const [char, record] of records) {
      const cc = ccCedict.get(char);
      expect(cc, `${char} has CC-CEDICT data`).toBeDefined();
      if (cc === undefined) {
        continue;
      }
      const readings = cc.entries.map((e) => numberedToToneMarks(e.reading));
      expect(
        readings.includes(record.prompt.pinyin),
        `${char} prompt.pinyin "${record.prompt.pinyin}" is a tone-mark form of a source reading`,
      ).toBe(true);
    }
  });

  it('Property 20: no DEFAULT-rule prompt.meaning begins with a skipped prefix', () => {
    // Property 20 constrains only default-rule choices. Override rows may
    // legitimately select a gloss the default rule would skip, so they are
    // excluded here. The source is read from the real overrides CSV.
    for (const [char, record] of records) {
      if (overrideCharacters.has(char)) {
        continue;
      }
      const lower = record.prompt.meaning.toLowerCase();
      for (const prefix of SKIPPED_PREFIXES) {
        expect(
          lower.startsWith(prefix),
          `default prompt for ${char} ("${record.prompt.meaning}") must not start with "${prefix}"`,
        ).toBe(false);
      }
    }
  });

  it('Property 21: review CSV source/reviewer matches the overrides file for all 300 rows', () => {
    const rows = parseCsvRows(promptReviewCsv).slice(1); // drop header
    expect(rows.length).toBe(300);

    for (const row of rows) {
      const [character, , , source, reviewedBy] = row;
      if (overrideCharacters.has(character)) {
        expect(source, `${character} is an override row`).toBe('override');
        expect(reviewedBy.length, `${character} override has a reviewer`).toBeGreaterThan(0);
      } else {
        expect(source, `${character} is a default row`).toBe('default');
        expect(reviewedBy, `${character} default row has empty reviewer`).toBe('');
      }
    }

    // Every override character in the CSV must correspond to a real record.
    for (const char of overrideCharacters) {
      expect(records.has(char), `override character ${char} is in the output`).toBe(true);
    }
  });

  it('Property 22: prompt meaning and reading share a single CC-CEDICT entry (same-entry provenance)', () => {
    for (const [char, record] of records) {
      const cc = ccCedict.get(char);
      expect(cc, `${char} has CC-CEDICT data`).toBeDefined();
      if (cc === undefined) {
        continue;
      }
      const entryIndex = findProvenanceEntry(cc, record.prompt.meaning, record.prompt.pinyin);
      expect(
        entryIndex,
        `${char} prompt {meaning:"${record.prompt.meaning}", pinyin:"${record.prompt.pinyin}"} comes from a single CC-CEDICT entry`,
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
