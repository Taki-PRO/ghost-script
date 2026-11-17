import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OracleDataError, loadDataset, powerDatasetPath } from '../src/dataset';

describe('powerDatasetPath', () => {
  const originalCwd = process.cwd();
  let temp: string | undefined;

  afterEach(() => {
    process.chdir(originalCwd);
    if (temp !== undefined) rmSync(temp, { recursive: true, force: true });
    temp = undefined;
  });

  it('ends in data/oracle-data.json', () => {
    expect(powerDatasetPath().replace(/\\/g, '/').endsWith('/data/oracle-data.json')).toBe(true);
  });

  it('does not depend on the working directory', () => {
    const before = powerDatasetPath();
    temp = mkdtempSync(join(tmpdir(), 'power-cwd-'));
    process.chdir(temp);
    expect(powerDatasetPath()).toBe(before);
  });

  it('makes loadDataset throw an OracleDataError naming a missing path', () => {
    const missing = join(tmpdir(), 'power-missing-dir', 'data', 'oracle-data.json');
    expect(() => loadDataset(missing)).toThrow(OracleDataError);
    expect(() => loadDataset(missing)).toThrow(missing);
  });
});
