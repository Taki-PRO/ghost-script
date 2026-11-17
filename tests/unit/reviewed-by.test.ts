// reviewedBy values in every review file (harder-ghosts, Requirement 4.16).
//
// Level 2 and 3 files accept exactly `human` (or empty on an unreviewed row).
// The two level 1 files are left as they are: prompt-review.csv accepts exactly
// `human-approved` and empty; prompt-overrides.csv pins its existing rows and
// accepts a new row only with `human`. This test never rewrites any file.
//
// Requirements: 4.16
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CharacterRecord } from '../../app/src/data/types';
import { parseCsv } from '../helpers/csv';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

/** SHA-256 of the 48 existing `human-approved` rows of data/prompt-overrides.csv, one per line. */
const LEVEL1_OVERRIDE_ROWS_SHA256 =
  '7e35baf6b30a1c86709f0755c4b232bb8a06cbce43a32510be434d77d29cb17b';
const LEVEL1_OVERRIDE_ROW_COUNT = 48;

export type ReviewFileKind =
  | 'review-new' // level 2/3 Review_Files and both Review_Samples: `human` or empty
  | 'approvals' // data/prompt-approvals.csv: exactly `human`
  | 'overrides-new' // data/prompt-overrides-level2.csv, -level3.csv: exactly `human`
  | 'overrides-level1' // data/prompt-overrides.csv: pinned rows, new rows `human`
  | 'review-level1'; // data/prompt-review.csv: `human-approved` or empty

/** Returns one message per problem; an empty list means the file passes. */
export function checkReviewedBy(kind: ReviewFileKind, csv: string): string[] {
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const col = header.indexOf('reviewedBy');
  if (col < 0) return ['no reviewedBy column in the header'];
  const problems: string[] = [];
  const accepted: Record<ReviewFileKind, readonly string[]> = {
    'review-new': ['human', ''],
    approvals: ['human'],
    'overrides-new': ['human'],
    'overrides-level1': ['human-approved', 'human'],
    'review-level1': ['human-approved', ''],
  };
  rows.slice(1).forEach((row, i) => {
    const value = row[col] ?? '';
    if (!accepted[kind].includes(value)) {
      problems.push(`row ${i + 2} (${row[0]}): reviewedBy "${value}" is not accepted`);
    }
  });
  if (kind === 'overrides-level1') {
    const pinned = csv
      .split('\n')
      .filter((line) => line.endsWith(',human-approved'))
      .map((line) => `${line}\n`);
    const hash = createHash('sha256').update(pinned.join('')).digest('hex');
    if (pinned.length !== LEVEL1_OVERRIDE_ROW_COUNT || hash !== LEVEL1_OVERRIDE_ROWS_SHA256) {
      problems.push('the existing human-approved rows differ from the pinned rows');
    }
  }
  return problems;
}

const FILES: ReadonlyArray<readonly [string, ReviewFileKind]> = [
  ['data/prompt-review-level2.csv', 'review-new'],
  ['data/prompt-review-level3.csv', 'review-new'],
  ['data/prompt-review-sample-level2.csv', 'review-new'],
  ['data/prompt-review-sample-level3.csv', 'review-new'],
  ['data/prompt-approvals.csv', 'approvals'],
  ['data/prompt-overrides-level2.csv', 'overrides-new'],
  ['data/prompt-overrides-level3.csv', 'overrides-new'],
  ['data/prompt-overrides.csv', 'overrides-level1'],
  ['data/prompt-review.csv', 'review-level1'],
];

describe('reviewedBy in the committed files', () => {
  for (const [file, kind] of FILES) {
    const present = existsSync(resolve(ROOT, file));
    // The approvals and level 2/3 override files are written by the human and may not exist yet.
    const optional = file.includes('approvals') || file.includes('overrides-level');
    it.skipIf(!present && optional)(`${file} passes (${kind})`, () => {
      expect(present, `${file} must exist`).toBe(true);
      expect(checkReviewedBy(kind, read(file))).toEqual([]);
    });
  }

  it.each([2, 3] as const)('level %i: reviewedBy human matches promptReview reviewed', (level) => {
    const data = JSON.parse(read(`app/public/data/characters-level${level}.json`)) as Record<
      string,
      CharacterRecord
    >;
    const rows = parseCsv(read(`data/prompt-review-level${level}.csv`)).slice(1);
    for (const row of rows) {
      const expected = row[4] === 'human' ? 'reviewed' : 'unreviewed';
      expect(data[row[0]].promptReview, row[0]).toBe(expected);
    }
  });
});

describe('checkReviewedBy rejects bad values', () => {
  it('rejects a personal-name style value in a new review file', () => {
    const csv = 'character,reviewedBy\n人,someone\n';
    expect(checkReviewedBy('review-new', csv)).toHaveLength(1);
  });

  it('rejects human-approved in a new review file', () => {
    expect(checkReviewedBy('review-new', 'character,reviewedBy\n人,human-approved\n')).toHaveLength(1);
  });

  it('rejects an empty value in approvals and in new overrides', () => {
    expect(checkReviewedBy('approvals', 'character,reviewedBy\n人,\n')).toHaveLength(1);
    expect(
      checkReviewedBy('overrides-new', 'character,entryIndex,meaningIndex,reviewedBy\n人,0,0,\n'),
    ).toHaveLength(1);
  });

  it('accepts human and empty where allowed', () => {
    expect(checkReviewedBy('review-new', 'character,reviewedBy\n人,human\n大,\n')).toEqual([]);
    expect(checkReviewedBy('approvals', 'character,reviewedBy\n人,human\n')).toEqual([]);
  });

  it('rejects a missing reviewedBy column', () => {
    expect(checkReviewedBy('review-new', 'character,other\n人,x\n')).toHaveLength(1);
  });

  it('level 1 review file accepts exactly human-approved and empty', () => {
    expect(checkReviewedBy('review-level1', 'character,reviewedBy\n人,human-approved\n大,\n')).toEqual([]);
    expect(checkReviewedBy('review-level1', 'character,reviewedBy\n人,human\n')).toHaveLength(1);
  });

  it('level 1 overrides: an altered or added human-approved row fails the pin, a human row passes', () => {
    const real = read('data/prompt-overrides.csv');
    expect(checkReviewedBy('overrides-level1', real)).toEqual([]);
    expect(checkReviewedBy('overrides-level1', `${real}人,0,0,human\n`)).toEqual([]);
    expect(checkReviewedBy('overrides-level1', `${real}人,0,0,human-approved\n`)).toHaveLength(1);
    expect(checkReviewedBy('overrides-level1', real.replace('比,2,0', '比,1,0'))).toHaveLength(1);
    expect(checkReviewedBy('overrides-level1', `${real}人,0,0,someone\n`)).toHaveLength(1);
  });
});
