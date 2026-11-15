/**
 * Data check: runs the dataset build, then the dataset tests.
 * Started with `npm run check:data` (and by the data-check-on-save hook).
 *
 * Pass: exit 0, first stdout line `DATA CHECK PASSED ...`.
 * Fail: exit 1, first stderr line `DATA CHECK FAILED: <step>`, then the last
 * 40 lines of that step's combined stdout + stderr.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface CheckStep {
  name: string;
  command: string;
  args: string[];
}

/** `output` is stdout + stderr. `status` is null when the step could not start or was killed. */
export interface StepResult {
  status: number | null;
  output: string;
}

export type StepRunner = (step: CheckStep) => StepResult;

export interface CheckOutcome {
  exitCode: 0 | 1;
  stdout: string;
  stderr: string;
}

export const DATA_CHECK_STEPS: readonly CheckStep[] = [
  { name: 'build:data', command: 'npm', args: ['run', 'build:data'] },
  { name: 'test:data', command: 'npm', args: ['run', 'test:data'] },
];

const TAIL_LINE_COUNT = 40;

/** Returns the last `count` lines of `text` (ignoring one trailing newline). */
export function tailLines(text: string, count: number): string {
  if (count <= 0 || text === '') return '';
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/);
  return lines.slice(-count).join('\n');
}

export function runDataCheck(steps: readonly CheckStep[], run: StepRunner): CheckOutcome {
  for (const step of steps) {
    const result = run(step);
    if (result.status !== 0) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `DATA CHECK FAILED: ${step.name}\n${tailLines(result.output, TAIL_LINE_COUNT)}\n`,
      };
    }
  }
  return {
    exitCode: 0,
    stdout: 'DATA CHECK PASSED: build:data and test:data succeeded\n',
    stderr: '',
  };
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function spawnRunner(step: CheckStep): StepResult {
  const result = spawnSync(step.command, step.args, { encoding: 'utf8', cwd: repoRoot() });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const note = result.error ? `${String(result.error)}\n` : '';
  return { status: result.status, output: note + output };
}

function main(): void {
  const outcome = runDataCheck(DATA_CHECK_STEPS, spawnRunner);
  if (outcome.stdout) process.stdout.write(outcome.stdout);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  process.exitCode = outcome.exitCode;
}

// ESM-safe execution guard: run main() only when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
