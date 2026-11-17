// The numbers on the Sources & licences screen come from the data, not from typing.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, UNREVIEWED_PROMPTS_SENTENCE } from '../../app/src/data/credits';
import { PROMPT_COUNTS } from '../../app/src/data/promptCounts.generated';
import { renderReadmeBlock } from '../../scripts/lib/prompt-counts';

const root = resolve(__dirname, '../..');
const load = (f: string): Record<string, { promptReview?: string }> =>
  JSON.parse(readFileSync(resolve(root, 'app/public/data', f), 'utf8'));

const level1 = load('characters.json');
const level2 = load('characters-level2.json');
const level3 = load('characters-level3.json');
const count = (d: Record<string, { promptReview?: string }>, v: string): number =>
  Object.values(d).filter((r) => r.promptReview === v).length;

const reviewed = count(level2, 'reviewed') + count(level3, 'reviewed');
const unreviewed = count(level2, 'unreviewed') + count(level3, 'unreviewed');
const total = Object.keys(level2).length + Object.keys(level3).length;

describe('Sources & licences prompt sentence', () => {
  it('shows the reviewed, total and unreviewed numbers of a fresh count over the data', () => {
    expect(PROMPT_COUNTS.reviewed).toBe(reviewed);
    expect(PROMPT_COUNTS.unreviewed).toBe(unreviewed);
    expect(PROMPT_COUNTS.total).toBe(total);
    expect(UNREVIEWED_PROMPTS_SENTENCE).toBe(
      `The clues of levels 2 and 3 come from CC-CEDICT by a fixed rule. A human has reviewed ${reviewed} of the ${total} clues and has not reviewed ${unreviewed}.`,
    );
  });

  it('matches the numbers in the README generated block', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    const block = readme.split('<!-- prompt-counts:start -->')[1].split('<!-- prompt-counts:end -->')[0];
    expect(block.trim()).toBe(renderReadmeBlock(PROMPT_COUNTS).trim());
    expect(block).toContain(`${reviewed} are reviewed`);
    expect(block).toContain(`${unreviewed} are not`);
  });
});

describe('character list row', () => {
  it('names the three level counts, which equal the record counts of the data files', () => {
    const row = DATA_SOURCES.find((s) => s.name.startsWith('Character list'));
    expect(row?.name).toBe('Character list — HSK 3.0 writing levels 1 to 3');
    const counts = [level1, level2, level3].map((d) => Object.keys(d).length);
    expect(row?.use).toBe(
      `the ${counts[0]}, ${counts[1]} and ${counts[2]} characters taught in the app, in three levels`,
    );
  });
});
