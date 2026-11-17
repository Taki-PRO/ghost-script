// The committed Review_Samples (harder-ghosts, Requirement 4.12).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildReviewSample,
  buildSampleProvenance,
  SAMPLE_SIZE,
  serialiseSampleProvenance,
  type SampleLevel,
} from '../../scripts/lib/review-sample';
import { parseCsv } from '../helpers/csv';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const LEVELS: readonly SampleLevel[] = [2, 3];
const reviewCsv = (level: SampleLevel): string => read(`data/prompt-review-level${level}.csv`);
const sampleCsv = (level: SampleLevel): string => read(`data/prompt-review-sample-level${level}.csv`);

describe.each(LEVELS)('level %i Review_Sample', (level) => {
  it('equals a fresh generation from the Review_File', () => {
    expect(sampleCsv(level)).toBe(buildReviewSample(reviewCsv(level), level));
  });

  it('same seed gives identical bytes', () => {
    expect(buildReviewSample(reviewCsv(level), level)).toBe(
      buildReviewSample(reviewCsv(level), level),
    );
  });

  it('has the same header as the Review_File', () => {
    expect(parseCsv(sampleCsv(level))[0]).toEqual(parseCsv(reviewCsv(level))[0]);
  });

  it(`has exactly ${SAMPLE_SIZE} distinct rows, all from the Review_File, in list order`, () => {
    const sample = parseCsv(sampleCsv(level)).slice(1);
    const all = parseCsv(reviewCsv(level)).slice(1);
    expect(sample).toHaveLength(SAMPLE_SIZE);
    const characters = sample.map((row) => row[0]);
    expect(new Set(characters).size).toBe(SAMPLE_SIZE);
    const position = new Map(all.map((row, i) => [row[0], i]));
    let last = -1;
    for (const row of sample) {
      const at = position.get(row[0]);
      expect(at, `${row[0]} is in the Review_File`).toBeDefined();
      expect(row, `${row[0]} row equals the Review_File row`).toEqual(all[at as number]);
      expect(at as number).toBeGreaterThan(last);
      last = at as number;
    }
  });
});

describe('Sample_Provenance', () => {
  it('equals a fresh one', () => {
    const rows = {
      2: parseCsv(reviewCsv(2)).length - 1,
      3: parseCsv(reviewCsv(3)).length - 1,
    };
    expect(read('data/prompt-review-sample-provenance.json')).toBe(
      serialiseSampleProvenance(buildSampleProvenance(rows)),
    );
  });
});
