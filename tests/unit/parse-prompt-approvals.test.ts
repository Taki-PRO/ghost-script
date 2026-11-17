import { describe, it, expect } from 'vitest';
import {
  parsePromptApprovals,
  type PromptApprovalError,
} from '../../scripts/lib/parse-prompt-approvals';
import { parsePromptOverrides } from '../../scripts/lib/parse-prompt-overrides';

const HEADER = 'character,reviewedBy';

function errorsOf(raw: string): PromptApprovalError[] {
  const result = parsePromptApprovals(raw);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe('parsePromptApprovals', () => {
  it('parses a valid CSV into a set of characters', () => {
    const result = parsePromptApprovals([HEADER, '三,human', '后,human', ''].join('\n'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.approvals]).toEqual(['三', '后']);
    }
  });

  it('accepts a header-only file as no approvals', () => {
    const result = parsePromptApprovals(HEADER + '\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.approvals.size).toBe(0);
    }
  });

  it('rejects a reviewer that is not exactly human', () => {
    for (const reviewer of ['alice', 'Human', 'humans', '']) {
      expect(errorsOf([HEADER, `三,${reviewer}`].join('\n'))).toEqual([
        { line: 2, character: '三', reason: 'invalid-reviewer' },
      ]);
    }
  });

  it('flags a duplicate character at the repeat line', () => {
    expect(errorsOf([HEADER, '三,human', '后,human', '三,human'].join('\n'))).toEqual([
      { line: 4, character: '三', reason: 'duplicate-character' },
    ]);
  });

  it('flags a wrong column count and a non-CJK character as malformed', () => {
    const errors = errorsOf([HEADER, '三,human,extra', 'ab,human', '三'].join('\n'));
    expect(errors.map((e) => [e.line, e.reason])).toEqual([
      [2, 'malformed-row'],
      [3, 'malformed-row'],
      [4, 'malformed-row'],
    ]);
  });

  it('flags a wrong header and an empty file at line 1', () => {
    expect(errorsOf('character,reviewer\n三,human')).toEqual([
      { line: 1, character: '', reason: 'malformed-row' },
    ]);
    expect(errorsOf('')).toEqual([{ line: 1, character: '', reason: 'malformed-row' }]);
  });

  it('reports every error, not just the first', () => {
    expect(errorsOf([HEADER, '三,bob', 'x,human'].join('\n'))).toHaveLength(2);
  });
});

describe('parsePromptOverrides requiredReviewer', () => {
  const OVERRIDE_HEADER = 'character,entryIndex,meaningIndex,reviewedBy';

  it('accepts human rows', () => {
    const result = parsePromptOverrides([OVERRIDE_HEADER, '三,0,1,human'].join('\n'), {
      requiredReviewer: 'human',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects any other reviewer as invalid-reviewer', () => {
    const result = parsePromptOverrides([OVERRIDE_HEADER, '三,0,1,alice'].join('\n'), {
      requiredReviewer: 'human',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ line: 2, character: '三', reason: 'invalid-reviewer' }]);
    }
  });

  it('still reports an empty reviewer as missing-reviewer', () => {
    const result = parsePromptOverrides([OVERRIDE_HEADER, '三,0,1,'].join('\n'), {
      requiredReviewer: 'human',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].reason).toBe('missing-reviewer');
    }
  });

  it('without the setting accepts any non-empty reviewer', () => {
    const result = parsePromptOverrides([OVERRIDE_HEADER, '三,0,1,alice'].join('\n'));
    expect(result.ok).toBe(true);
  });
});
