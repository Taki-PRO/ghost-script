// Unit tests for the data check: step ordering, failure reports, and tailLines.
// A fake StepRunner is used; npm is never started.
//
// Requirements: 1.4, 1.5, 1.6, 1.7, 9.1, 9.3
import { describe, expect, it } from 'vitest';
import {
  DATA_CHECK_STEPS,
  runDataCheck,
  tailLines,
  type CheckStep,
  type StepResult,
} from '../../scripts/data-check';

function fakeRunner(results: Record<string, StepResult>) {
  const calls: string[] = [];
  const run = (step: CheckStep): StepResult => {
    calls.push(step.name);
    return results[step.name] ?? { status: 0, output: '' };
  };
  return { run, calls };
}

function numberedLines(n: number): string {
  return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
}

describe('runDataCheck', () => {
  it('passes when both steps exit 0', () => {
    const { run, calls } = fakeRunner({});
    const outcome = runDataCheck(DATA_CHECK_STEPS, run);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout.split('\n')[0]).toMatch(/^DATA CHECK PASSED/);
    expect(outcome.stderr).toBe('');
    expect(calls).toEqual(['build:data', 'test:data']);
  });

  it('fails on a build failure and does not run the tests', () => {
    const { run, calls } = fakeRunner({
      'build:data': { status: 1, output: numberedLines(100) },
    });
    const outcome = runDataCheck(DATA_CHECK_STEPS, run);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr.startsWith('DATA CHECK FAILED')).toBe(true);
    expect(outcome.stderr.split('\n')[0]).toContain('build:data');
    expect(calls).toEqual(['build:data']);
    const tail = outcome.stderr.split('\n').slice(1).filter((l) => l !== '');
    expect(tail.length).toBeLessThanOrEqual(40);
    expect(tail[tail.length - 1]).toBe('line 100');
  });

  it('names test:data when the tests fail', () => {
    const { run, calls } = fakeRunner({
      'test:data': { status: 1, output: 'FAIL something' },
    });
    const outcome = runDataCheck(DATA_CHECK_STEPS, run);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr.split('\n')[0]).toContain('test:data');
    expect(outcome.stderr).toContain('FAIL something');
    expect(calls).toEqual(['build:data', 'test:data']);
  });

  it('treats a null status as a failure', () => {
    const { run } = fakeRunner({
      'build:data': { status: null, output: 'spawn npm ENOENT' },
    });
    const outcome = runDataCheck(DATA_CHECK_STEPS, run);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr.startsWith('DATA CHECK FAILED: build:data')).toBe(true);
  });
});

describe('tailLines', () => {
  it('returns all lines when there are fewer than the count', () => {
    expect(tailLines('a\nb\nc', 40)).toBe('a\nb\nc');
  });

  it('returns all lines when the line count equals the count', () => {
    expect(tailLines(numberedLines(40), 40)).toBe(numberedLines(40));
  });

  it('returns only the last lines when there are more than the count', () => {
    expect(tailLines('a\nb\nc\nd', 2)).toBe('c\nd');
  });

  it('returns an empty string for empty text', () => {
    expect(tailLines('', 40)).toBe('');
  });
});
