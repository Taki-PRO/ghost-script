// Unit tests for scripts/lib/prompt-counts.ts on hand-built records.
import { describe, it, expect } from 'vitest';
import {
  computePromptCounts,
  renderCountsModule,
  renderReadmeBlock,
  replaceReadmeBlock,
} from '../../scripts/lib/prompt-counts';

const level2 = {
  甲: { promptReview: 'reviewed' },
  乙: { promptReview: 'unreviewed' },
  丙: { promptReview: 'unreviewed' },
};
const level3 = {
  丁: { promptReview: 'reviewed' },
  戊: { promptReview: 'reviewed' },
  己: {},
};

describe('computePromptCounts', () => {
  it('counts per level and together; records without the field are not counted', () => {
    expect(computePromptCounts({ level2, level3 })).toEqual({
      level2: { reviewed: 1, unreviewed: 2, total: 3 },
      level3: { reviewed: 2, unreviewed: 0, total: 2 },
      reviewed: 3,
      unreviewed: 2,
      total: 5,
    });
  });
});

describe('renderCountsModule', () => {
  it('renders a generated module with a do-not-edit header', () => {
    const text = renderCountsModule(computePromptCounts({ level2, level3 }));
    expect(text.split('\n')[0]).toContain('generated, do not edit');
    expect(text).toContain('export const PROMPT_COUNTS = {');
    expect(text).toContain('level2: { reviewed: 1, unreviewed: 2, total: 3 },');
    expect(text).toContain('level3: { reviewed: 2, unreviewed: 0, total: 2 },');
    expect(text).toContain('  total: 5,');
    expect(text.trimEnd().endsWith('} as const;')).toBe(true);
  });
});

describe('renderReadmeBlock', () => {
  it('renders the sentence with the counts', () => {
    expect(renderReadmeBlock(computePromptCounts({ level2, level3 }))).toBe(
      'Of the 5 prompts of levels 2 and 3, 3 are reviewed by a human and 2 are not ' +
        '(level 2: 1 reviewed, 2 not; level 3: 2 reviewed, 0 not). ' +
        'A human reviews a random sample of 50 rows per level.',
    );
  });
});

describe('replaceReadmeBlock', () => {
  const readme =
    'before\n<!-- prompt-counts:start -->\nplaceholder\n<!-- prompt-counts:end -->\nafter\n';

  it('replaces the text between the markers and keeps the rest', () => {
    expect(replaceReadmeBlock(readme, 'NEW')).toBe(
      'before\n<!-- prompt-counts:start -->\nNEW\n<!-- prompt-counts:end -->\nafter\n',
    );
  });

  it('is idempotent', () => {
    const once = replaceReadmeBlock(readme, 'NEW');
    expect(replaceReadmeBlock(once, 'NEW')).toBe(once);
  });

  it('fails when a marker is missing', () => {
    expect(() => replaceReadmeBlock('no markers', 'X')).toThrow(/prompt-counts:start/);
    expect(() =>
      replaceReadmeBlock('<!-- prompt-counts:start -->\nonly start', 'X'),
    ).toThrow(/prompt-counts:end/);
    expect(() =>
      replaceReadmeBlock('only end\n<!-- prompt-counts:end -->', 'X'),
    ).toThrow(/prompt-counts:start/);
  });
});
