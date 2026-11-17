import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { isPlayableInCangjie } from '../../app/src/engine/cangjieRules';
import { defaultDatasetPaths, loadDataset } from '../src/dataset';
import {
  CANGJIE_SOURCE,
  OracleInputError,
  decompose,
  lookup,
  parseCharacterInput,
  parseCodeInput,
  verify,
  type Dataset,
} from '../src/oracle';

function rec(
  character: string,
  cangjie: string | null,
  opts: { atomic?: boolean; ids?: string; components?: string[]; source?: 'unihan' | 'missing' } = {},
): CharacterRecord {
  const atomic = opts.atomic ?? false;
  return {
    character,
    pinyin: ['x1'],
    meanings: ['m'],
    strokeCount: 1,
    strokeData: { strokes: [], medians: [], radStrokes: [] },
    decomposition: {
      decomposition: opts.ids ?? (atomic ? '？' : '⿰扌戈'),
      radical: '戈',
      etymology: null,
      matches: null,
      atomic,
      components: opts.components ?? (atomic ? [character] : ['扌', '戈']),
    },
    prompt: { meaning: 'm', pinyin: 'x' },
    cangjie,
    summonInk: { class: 'opaque' },
    sources: {
      pinyin: 'cc-cedict',
      meanings: 'cc-cedict',
      strokeCount: 'hanzi-writer-data',
      strokeData: 'hanzi-writer-data',
      decomposition: 'make-me-a-hanzi',
      cangjie: opts.source ?? (cangjie === null ? 'missing' : 'unihan'),
    },
  } as CharacterRecord;
}

const small: Dataset = new Map<string, CharacterRecord>([
  ['我', rec('我', 'HQI')],
  ['别', rec('别', 'XRSLN')],
  ['无', rec('无', null)],
  ['一', rec('一', 'M', { atomic: true })],
  ['人', rec('人', 'O', { source: 'missing' })],
]);

describe('lookup', () => {
  it('returns a coded character with its source and playable flag', () => {
    expect(lookup(small, '我')).toEqual({
      found: true,
      character: '我',
      cangjie: 'HQI',
      source: CANGJIE_SOURCE,
      playable: true,
    });
  });

  it('returns the X-prefixed code but marks it not playable', () => {
    const r = lookup(small, '别');
    expect(r).toMatchObject({ found: true, cangjie: 'XRSLN', playable: false });
  });

  it('returns the null-code result when the code is null', () => {
    expect(lookup(small, '无')).toEqual({
      found: true,
      character: '无',
      cangjie: null,
      source: null,
      playable: false,
    });
  });

  it('returns the null-code result when sources.cangjie is not unihan, even with a code', () => {
    expect(lookup(small, '人')).toEqual({
      found: true,
      character: '人',
      cangjie: null,
      source: null,
      playable: false,
    });
  });

  it('reports a character outside the dataset as not found', () => {
    expect(lookup(small, '龘')).toEqual({ found: false, character: '龘', reason: 'not-in-dataset' });
  });
});

describe('verify', () => {
  it('matches a lowercase correct code and returns the normalised code', () => {
    const r = verify(small, '我', 'hqi');
    expect(r).toMatchObject({ found: true, matches: true, normalisedCode: 'HQI', source: CANGJIE_SOURCE });
  });

  it('does not match a wrong but valid code', () => {
    expect(verify(small, '我', 'abc')).toMatchObject({ found: true, matches: false, normalisedCode: 'ABC' });
  });

  it('reports no-code-in-source for a record without a code', () => {
    expect(verify(small, '无', 'abc')).toEqual({
      found: true,
      character: '无',
      normalisedCode: 'ABC',
      matches: false,
      source: null,
      reason: 'no-code-in-source',
    });
  });

  it('rejects codes that are invalid after normalising', () => {
    expect(() => verify(small, '我', 'hqz')).toThrow(OracleInputError);
    expect(() => verify(small, '我', 'abcdef')).toThrow(OracleInputError);
  });

  it('reports an unknown character as not found', () => {
    expect(verify(small, '龘', 'hqi')).toEqual({ found: false, character: '龘', reason: 'not-in-dataset' });
  });
});

describe('decompose', () => {
  it('returns an atomic record', () => {
    expect(decompose(small, '一')).toEqual({
      found: true,
      character: '一',
      ids: '？',
      atomic: true,
      radical: '戈',
      components: ['一'],
      source: { dataset: 'make-me-a-hanzi' },
    });
  });

  it('returns a composite record', () => {
    expect(decompose(small, '我')).toMatchObject({
      found: true,
      ids: '⿰扌戈',
      atomic: false,
      components: ['扌', '戈'],
    });
  });

  it('reports an unknown character as not found', () => {
    expect(decompose(small, '龘')).toEqual({ found: false, character: '龘', reason: 'not-in-dataset' });
  });
});

describe('invalid input throws OracleInputError', () => {
  const badCharacters: unknown[] = ['', '我我', 'a', 'あ', '\u{20000}', ' ', 42, null, undefined, {}];
  const badCodes: unknown[] = ['', 'hqz', 'abcdef', 'h1', 'h q', 42, null, undefined];

  it.each(badCharacters.map((v) => [String(v), v]))('character %s', (_label, value) => {
    expect(() => parseCharacterInput(value)).toThrow(OracleInputError);
    expect(() => lookup(small, value)).toThrow(OracleInputError);
    expect(() => verify(small, value, 'hqi')).toThrow(OracleInputError);
    expect(() => decompose(small, value)).toThrow(OracleInputError);
  });

  it.each(badCodes.map((v) => [String(v), v]))('code %s', (_label, value) => {
    expect(() => parseCodeInput(value)).toThrow(OracleInputError);
    expect(() => verify(small, '我', value)).toThrow(OracleInputError);
  });

  it('accepts and uppercases a valid code', () => {
    expect(parseCodeInput('hqi')).toBe('HQI');
  });
});

describe('real dataset (exhaustive)', () => {
  const dataset = loadDataset();

  it('holds every record of the three Level_Datasets', () => {
    const total = defaultDatasetPaths()
      .map((path) => Object.keys(JSON.parse(readFileSync(path, 'utf8')) as object).length)
      .reduce((a, b) => a + b, 0);
    expect(defaultDatasetPaths()).toHaveLength(3);
    expect(dataset.size).toBe(total);
  });
  it('answers for a character from each level file', () => {
    for (const path of defaultDatasetPaths()) {
      const first = Object.keys(JSON.parse(readFileSync(path, 'utf8')) as object)[0];
      expect(lookup(dataset, first).found).toBe(true);
    }
  });

  it('lookup, verify and decompose agree with every stored record', () => {
    for (const [ch, record] of dataset) {
      const l = lookup(dataset, ch);
      expect(l.found).toBe(true);
      if (!l.found) continue;
      expect(l.cangjie).toBe(record.cangjie);
      expect(l.playable).toBe(isPlayableInCangjie(record.cangjie));
      expect(l.source !== null).toBe(record.sources.cangjie === 'unihan');
      if (l.source) expect(l.source).toEqual(CANGJIE_SOURCE);

      if (record.cangjie !== null) {
        const v = verify(dataset, ch, record.cangjie.toLowerCase());
        expect(v).toMatchObject({ found: true, matches: true, normalisedCode: record.cangjie });
        const wrong = verify(dataset, ch, record.cangjie === 'M' ? 'N' : 'M');
        expect(wrong).toMatchObject({ found: true, matches: false });
      }

      const d = decompose(dataset, ch);
      expect(d.found).toBe(true);
      if (!d.found) continue;
      expect(d.ids).toBe(record.decomposition.decomposition);
      expect(d.atomic).toBe(record.decomposition.atomic);
      expect(d.radical).toBe(record.decomposition.radical);
      expect(d.components).toEqual(record.decomposition.components);
    }
  });
});

describe('source version', () => {
  it('data/raw/SOURCES.md states the Unicode version used by CANGJIE_SOURCE', () => {
    const path = fileURLToPath(new URL('../../data/raw/SOURCES.md', import.meta.url));
    const text = readFileSync(path, 'utf8');
    expect(text).toContain(`**Unicode version:** ${CANGJIE_SOURCE.version}`);
    expect(CANGJIE_SOURCE.version).toBe('18.0.0');
  });
});
