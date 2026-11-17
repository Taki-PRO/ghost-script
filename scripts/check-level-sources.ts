/**
 * Source_Check (harder-ghosts, task 1.1). Read-only: writes no data file.
 *
 * Reads the pinned HSK 3.0 CSV and, for each level 2 and 3 character, reports
 * presence in hanzi-writer-data, Make Me a Hanzi, CC-CEDICT (simplified
 * headword) and Unihan kCangjie (exactly one value matching ^[A-Y]{1,5}$),
 * whether selectPrompt yields a prompt, and whether the source font has a
 * glyph. Then compares the result with the Expected_Result.
 *
 * Started with `npm run check:levels`. Exit 0: no difference. Exit 1: at least
 * one difference (printed).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPlayableInCangjie } from '../app/src/engine/cangjieRules';
import { classifySummonInk } from '../app/src/engine/summonInk';
import { cmapCoverage } from './build-font';
import { parseCcCedict } from './lib/parse-cc-cedict';
import { parseCharacterList } from './lib/parse-character-list';
import { parseHanziWriterData } from './lib/parse-hanzi-writer-data';
import { parseMakeMeAHanzi } from './lib/parse-make-me-a-hanzi';
import { parseUnihanCangjie } from './lib/parse-unihan';
import { selectPrompt } from './lib/prompt';

export type Level = 1 | 2 | 3;
export const LEVELS: readonly Level[] = [1, 2, 3];
export type CheckedLevel = 2 | 3;
export const CHECKED_LEVELS: readonly CheckedLevel[] = [2, 3];

export const CSV_BYTES = 108366;
export const CSV_LINES = 3001;
export const CSV_SHA256 = '8c5957108e6dafd120be10518a827a4d834ea3ce29acbfedeff1022cd7d05280';

export const EXPECTED_ROWS: Readonly<Record<Level, number>> = { 1: 300, 2: 400, 3: 500 };
export const EXPECTED_NOT_PLAYABLE: Readonly<Record<CheckedLevel, readonly string[]>> = {
  2: ['广', '换', '压', '灭'],
  3: ['历', '内', '敌', '锻', '镜', '宽', '亏', '杀', '贡'],
};

export const SOURCE_NAMES = [
  'hanzi-writer-data',
  'make-me-a-hanzi',
  'cc-cedict',
  'unihan-kCangjie',
  'prompt',
  'font-glyph',
] as const;
export type SourceName = (typeof SOURCE_NAMES)[number];

const CANGJIE_PATTERN = /^[A-Y]{1,5}$/;

/** True when the Unihan values hold exactly one value of the form ^[A-Y]{1,5}$. */
export function isSingleValidCangjie(values: readonly string[] | undefined): boolean {
  return values !== undefined && values.length === 1 && CANGJIE_PATTERN.test(values[0] as string);
}

// ---------------------------------------------------------------- CSV

export interface CsvRow {
  hanzi: string;
  /** The `WritingLevel` column; null when empty. */
  level: number | null;
}

/** Splits one CSV line; double quotes group a field and "" is a literal quote. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] as string;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parses the pinned CSV (header row first) into rows of Hanzi and WritingLevel. */
export function parseHsk30Csv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0] ?? '');
  const hanziAt = header.indexOf('Hanzi');
  const levelAt = header.indexOf('WritingLevel');
  if (hanziAt < 0 || levelAt < 0) {
    throw new Error('CSV header lacks Hanzi or WritingLevel');
  }
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const rawLevel = (fields[levelAt] ?? '').trim();
    return {
      hanzi: (fields[hanziAt] ?? '').trim(),
      level: rawLevel === '' ? null : Number(rawLevel),
    };
  });
}

/** Characters of each level in row order. Rows with another or empty level are ignored. */
export function splitByLevel(rows: readonly CsvRow[]): Record<Level, string[]> {
  const out: Record<Level, string[]> = { 1: [], 2: [], 3: [] };
  for (const row of rows) {
    if (row.level === 1 || row.level === 2 || row.level === 3) out[row.level].push(row.hanzi);
  }
  return out;
}

/** Characters that appear in more than one level (each listed once, sorted by first level seen). */
export function findOverlap(levels: Record<Level, readonly string[]>): string[] {
  const seen = new Map<string, number>();
  const overlap: string[] = [];
  for (const level of LEVELS) {
    for (const ch of levels[level]) {
      const first = seen.get(ch);
      if (first === undefined) seen.set(ch, level);
      else if (first !== level && !overlap.includes(ch)) overlap.push(ch);
    }
  }
  return overlap;
}

// ------------------------------------------------------------- report

export interface CharacterFacts {
  character: string;
  /** Sources in which the character is present and usable. */
  present: Readonly<Record<SourceName, boolean>>;
  /** The single Unihan code, or null when it is absent, repeated or malformed. */
  cangjie: string | null;
}

export interface SourceReport {
  csvBytes: number;
  csvLines: number;
  csvSha256: string;
  rows: Record<Level, number>;
  /** Level 1 CSV rows equal the content and order of data/character-list.txt. */
  level1EqualsList: boolean;
  overlap: string[];
  facts: Record<CheckedLevel, CharacterFacts[]>;
  notPlayable: Record<Level, string[]>;
  summonInk: Record<Level, { transparent: number; partial: number; opaque: number }>;
}

export interface Difference {
  item: string;
  level: Level | null;
  character: string | null;
  source: string | null;
  expected: string;
  found: string;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Every difference between a report and the Expected_Result (Requirement 1.8). */
export function compareToExpected(report: SourceReport): Difference[] {
  const diffs: Difference[] = [];
  const add = (d: Difference): void => {
    diffs.push(d);
  };
  const scalar = (item: string, expected: string, found: string): void => {
    if (expected !== found) {
      add({ item, level: null, character: null, source: 'hsk30-chars.csv', expected, found });
    }
  };
  scalar('csv bytes', String(CSV_BYTES), String(report.csvBytes));
  scalar('csv lines', String(CSV_LINES), String(report.csvLines));
  scalar('csv sha256', CSV_SHA256, report.csvSha256);
  for (const level of LEVELS) {
    scalar(`rows level ${level}`, String(EXPECTED_ROWS[level]), String(report.rows[level]));
  }
  if (!report.level1EqualsList) {
    add({
      item: 'level 1 equals character-list.txt in order',
      level: 1,
      character: null,
      source: 'data/character-list.txt',
      expected: 'equal',
      found: 'different',
    });
  }
  for (const ch of report.overlap) {
    add({
      item: 'character in two levels',
      level: null,
      character: ch,
      source: 'hsk30-chars.csv',
      expected: 'one level',
      found: 'more than one level',
    });
  }
  for (const level of CHECKED_LEVELS) {
    for (const fact of report.facts[level]) {
      for (const source of SOURCE_NAMES) {
        if (!fact.present[source]) {
          add({
            item: 'source lacks character',
            level,
            character: fact.character,
            source,
            expected: 'present',
            found: 'missing',
          });
        }
      }
    }
    const expected = EXPECTED_NOT_PLAYABLE[level];
    const found = report.notPlayable[level];
    for (const ch of expected) {
      if (!found.includes(ch)) {
        add({
          item: 'not-Playable set',
          level,
          character: ch,
          source: 'unihan-kCangjie',
          expected: 'not Playable',
          found: 'Playable',
        });
      }
    }
    for (const ch of found) {
      if (!expected.includes(ch)) {
        add({
          item: 'not-Playable set',
          level,
          character: ch,
          source: 'unihan-kCangjie',
          expected: 'Playable',
          found: 'not Playable',
        });
      }
    }
  }
  return diffs;
}

export function formatDifference(d: Difference): string {
  return (
    `  item: ${d.item}; level: ${d.level ?? '-'}; character: ${d.character ?? '-'}; ` +
    `source: ${d.source ?? '-'}; expected: ${d.expected}; found: ${d.found}`
  );
}

export function formatReport(report: SourceReport): string {
  const lines: string[] = [];
  lines.push(
    `Pinned CSV: ${report.csvLines} lines, ${report.csvBytes} bytes, SHA-256 ${report.csvSha256}`,
  );
  lines.push(
    `Rows per level: ${LEVELS.map((l) => `level ${l} = ${report.rows[l]} (expected ${EXPECTED_ROWS[l]})`).join(', ')}`,
  );
  lines.push(`Level 1 equals data/character-list.txt in order: ${report.level1EqualsList ? 'yes' : 'no'}`);
  lines.push(
    `Characters in two levels: ${report.overlap.length === 0 ? 'none' : report.overlap.join(' ')}`,
  );
  for (const level of CHECKED_LEVELS) {
    const facts = report.facts[level];
    lines.push(`Level ${level} source coverage (${facts.length} characters):`);
    for (const source of SOURCE_NAMES) {
      const missing = facts.filter((f) => !f.present[source]).map((f) => f.character);
      lines.push(
        `  ${source}: ${facts.length - missing.length} present, ${missing.length} missing` +
          (missing.length > 0 ? ` (${missing.join(' ')})` : ''),
      );
    }
  }
  for (const level of LEVELS) {
    const np = report.notPlayable[level];
    lines.push(`Not Playable, level ${level}: ${np.length} (${np.join(' ')})`);
  }
  for (const level of LEVELS) {
    const c = report.summonInk[level];
    lines.push(
      `Summon-ink level ${level}: transparent ${c.transparent} / partial ${c.partial} / opaque ${c.opaque}`,
    );
  }
  return lines.join('\n');
}

// ------------------------------------------------------------ real run

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function buildReport(root: string): SourceReport {
  const csvBuffer = readFileSync(join(root, 'data', 'raw', 'hsk30', 'hsk30-chars.csv'));
  const csvText = csvBuffer.toString('utf8');
  const levels = splitByLevel(parseHsk30Csv(csvText));

  const list = parseCharacterList(readFileSync(join(root, 'data', 'character-list.txt'), 'utf8'));
  const level1EqualsList = list.ok && same(list.characters, levels[1]);

  const all = LEVELS.flatMap((l) => levels[l]);
  const hanziWriter = parseHanziWriterData(join(root, 'data', 'raw', 'hanzi-writer-data'), all);
  const makeMeAHanzi = parseMakeMeAHanzi(
    readFileSync(join(root, 'data', 'raw', 'make-me-a-hanzi', 'dictionary.txt'), 'utf8'),
  );
  const ccCedict = parseCcCedict(
    readFileSync(join(root, 'data', 'raw', 'cc-cedict', 'cedict_ts.u8'), 'utf8'),
  );
  const unihan = parseUnihanCangjie(
    readFileSync(join(root, 'data', 'raw', 'unihan', 'Unihan_DictionaryLikeData.txt'), 'utf8'),
  );
  const hasGlyph = cmapCoverage(
    new Uint8Array(readFileSync(join(root, 'data', 'raw', 'fonts', 'cache', 'LXGWWenKai-Regular.ttf'))),
  );

  const cangjieOf = (ch: string): string | null => {
    const values = unihan.get(ch);
    return isSingleValidCangjie(values) ? (values as string[])[0] as string : null;
  };

  const facts = { 2: [], 3: [] } as Record<CheckedLevel, CharacterFacts[]>;
  for (const level of CHECKED_LEVELS) {
    for (const ch of levels[level]) {
      const cc = ccCedict.get(ch);
      const prompt = cc !== undefined && selectPrompt(ch, cc, undefined).ok;
      facts[level].push({
        character: ch,
        cangjie: cangjieOf(ch),
        present: {
          'hanzi-writer-data': hanziWriter.has(ch),
          'make-me-a-hanzi': makeMeAHanzi.has(ch),
          'cc-cedict': cc !== undefined,
          'unihan-kCangjie': cangjieOf(ch) !== null,
          prompt,
          'font-glyph': hasGlyph(ch.codePointAt(0) as number),
        },
      });
    }
  }

  const notPlayable = { 1: [], 2: [], 3: [] } as Record<Level, string[]>;
  const summonInk = {
    1: { transparent: 0, partial: 0, opaque: 0 },
    2: { transparent: 0, partial: 0, opaque: 0 },
    3: { transparent: 0, partial: 0, opaque: 0 },
  } as SourceReport['summonInk'];
  for (const level of LEVELS) {
    for (const ch of levels[level]) {
      const code = cangjieOf(ch);
      if (code !== null && !isPlayableInCangjie(code)) notPlayable[level].push(ch);
      const hw = hanziWriter.get(ch);
      const mm = makeMeAHanzi.get(ch);
      if (hw === undefined || mm === undefined) continue;
      const result = classifySummonInk({
        character: ch,
        cangjie: code,
        strokeCount: hw.strokes.length,
        decomposition: { decomposition: mm.decomposition, matches: mm.matches, atomic: mm.atomic },
      });
      summonInk[level][result.class] += 1;
    }
  }

  return {
    csvBytes: csvBuffer.length,
    csvLines: csvText.split('\n').length - (csvText.endsWith('\n') ? 1 : 0),
    csvSha256: createHash('sha256').update(csvBuffer).digest('hex'),
    rows: { 1: levels[1].length, 2: levels[2].length, 3: levels[3].length },
    level1EqualsList,
    overlap: findOverlap(levels),
    facts,
    notPlayable,
    summonInk,
  };
}

function main(): void {
  const report = buildReport(repoRoot());
  const diffs = compareToExpected(report);
  process.stdout.write(`${formatReport(report)}\n`);
  if (diffs.length === 0) {
    process.stdout.write('SOURCE CHECK PASSED: the result equals the Expected_Result\n');
    process.exitCode = 0;
  } else {
    process.stdout.write(
      `SOURCE CHECK FAILED: ${diffs.length} difference(s)\n${diffs.map(formatDifference).join('\n')}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
