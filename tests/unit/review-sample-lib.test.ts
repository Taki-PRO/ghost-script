// Unit tests for scripts/lib/review-sample.ts on small fixtures.

import { describe, it, expect } from 'vitest';
import {
  fnv1a32,
  mulberry32,
  sampleRows,
  buildReviewSample,
  buildSampleProvenance,
  serialiseSampleProvenance,
} from '../../scripts/lib/review-sample';

const HEADER = 'character,prompt,reviewedBy';

function fixture(rowCount: number, eol = '\n'): string {
  const rows = Array.from({ length: rowCount }, (_, i) => `c${i},"meaning, ${i}",`);
  return [HEADER, ...rows].join(eol) + eol;
}

describe('fnv1a32', () => {
  it('matches the published FNV-1a 32 bit test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('hashes the level seed strings to fixed numbers', () => {
    expect(fnv1a32('ghost-script/prompt-review-sample/v1/level2')).toBe(2036869478);
  });
});

describe('mulberry32', () => {
  it('gives floats in [0, 1) and repeats for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(b());
    }
  });
});

describe('sampleRows', () => {
  it('returns a fixed ascending position list for a known n and seed', () => {
    expect(sampleRows(20, 5, 12345)).toEqual([6, 10, 12, 16, 19]);
  });

  it('is deterministic, sorted and distinct', () => {
    const first = sampleRows(400, 50, 7);
    expect(sampleRows(400, 50, 7)).toEqual(first);
    expect(new Set(first).size).toBe(50);
    expect(first).toEqual([...first].sort((a, b) => a - b));
    expect(first.every((p) => p >= 0 && p < 400)).toBe(true);
  });

  it('throws when the size exceeds the row count', () => {
    expect(() => sampleRows(10, 50, 1)).toThrow();
  });
});

describe('buildReviewSample', () => {
  const csv = fixture(400);

  it('keeps the header, picks 50 distinct rows from the input and keeps list order', () => {
    const lines = buildReviewSample(csv, 2).split('\n');
    expect(lines.pop()).toBe('');
    expect(lines[0]).toBe(HEADER);
    const rows = lines.slice(1);
    expect(rows).toHaveLength(50);
    expect(new Set(rows).size).toBe(50);
    const input = csv.split('\n');
    const indexes = rows.map((r) => input.indexOf(r));
    expect(indexes.every((i) => i > 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('gives identical bytes for the same input and level, and different rows per level', () => {
    expect(buildReviewSample(csv, 2)).toBe(buildReviewSample(csv, 2));
    expect(buildReviewSample(csv, 3)).not.toBe(buildReviewSample(csv, 2));
  });

  it('copies rows byte for byte with CRLF line endings', () => {
    const out = buildReviewSample(fixture(60, '\r\n'), 3);
    expect(out.startsWith(HEADER + '\r\n')).toBe(true);
    expect(out.split('\r\n')).toHaveLength(52);
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('throws with fewer than 50 data rows', () => {
    expect(() => buildReviewSample(fixture(49), 2)).toThrow(/49/);
    expect(() => buildReviewSample('', 2)).toThrow();
  });

  it('accepts exactly 50 rows and returns all of them', () => {
    expect(buildReviewSample(fixture(50), 2)).toBe(fixture(50));
  });
});

describe('buildSampleProvenance', () => {
  const provenance = buildSampleProvenance({ 2: 400, 3: 500 });

  it('records algorithm, seeds, sources and row counts', () => {
    expect(provenance.sampleSize).toBe(50);
    expect(provenance.algorithm).toContain('mulberry32');
    expect(provenance.seedHash).toContain('FNV-1a');
    expect(provenance.levels['2']).toEqual({
      seedString: 'ghost-script/prompt-review-sample/v1/level2',
      seed: fnv1a32('ghost-script/prompt-review-sample/v1/level2'),
      source: 'data/prompt-review-level2.csv',
      rows: 400,
    });
    expect(provenance.levels['3']).toEqual({
      seedString: 'ghost-script/prompt-review-sample/v1/level3',
      seed: fnv1a32('ghost-script/prompt-review-sample/v1/level3'),
      source: 'data/prompt-review-level3.csv',
      rows: 500,
    });
  });

  it('serialises to 2-space JSON with a trailing newline that parses back', () => {
    const text = serialiseSampleProvenance(provenance);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "sampleSize": 50,');
    expect(JSON.parse(text)).toEqual(provenance);
    expect(serialiseSampleProvenance(provenance)).toBe(text);
  });
});
