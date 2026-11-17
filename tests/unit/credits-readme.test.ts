import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, FONTS } from '../../app/src/data/credits';
import { LEGEND_SOURCE } from '../../app/src/data/citations';

const root = resolve(__dirname, '../..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const accuracy = readFileSync(resolve(root, '.kiro/steering/content-accuracy.md'), 'utf8');

/** Remove Markdown backticks and emphasis asterisks. */
const plain = (s: string): string => s.replace(/[`*]/g, '');
const noFinalPeriod = (s: string): string => s.replace(/\.$/, '');

function readmeTableRows(): string[][] {
  const start = readme.indexOf('| Source |');
  expect(start).toBeGreaterThan(-1);
  const lines = readme.slice(start).split('\n');
  const rows: string[][] = [];
  for (const line of lines.slice(2)) {
    if (!line.startsWith('|')) break;
    rows.push(line.split(/\s\|\s/).map((c) => plain(c.replace(/^\|\s*|\s*\|$/g, '').trim())));
  }
  return rows;
}

describe('README credits match app/src/data', () => {
  it('table rows equal DATA_SOURCES', () => {
    const rows = readmeTableRows();
    expect(rows).toEqual(
      DATA_SOURCES.map((d) => [d.name, d.version, d.use, d.licence, d.url]),
    );
  });

  it('font line matches FONTS', () => {
    const lines = readme.split('\n');
    const start = lines.findIndex((l) => l.startsWith('- **Fonts:**'));
    expect(start).toBeGreaterThan(-1);
    const block = [lines[start]];
    for (const l of lines.slice(start + 1)) {
      if (!l.startsWith('  ')) break;
      block.push(l);
    }
    const text = plain(block.join('\n'));
    for (const f of FONTS) {
      expect(text).toContain(f.name);
      if (f.pkg) expect(text).toContain(f.pkg);
      if (f.url) expect(text).toContain(f.url);
      expect(text).toContain(f.version);
      expect(text).toContain(f.licence);
      expect(text).toContain(f.copyright);
    }
    expect(text).toContain("Any other Chinese text uses the device's fonts");
  });

  it('legend citation appears in the README and in content-accuracy.md', () => {
    const citation = noFinalPeriod(LEGEND_SOURCE.citation);
    expect(plain(readme)).toContain(citation);
    expect(plain(accuracy)).toContain(citation);
  });

  it('names the notices file and its build command', () => {
    expect(readme).toContain('app/public/THIRD_PARTY_NOTICES.txt');
    expect(readme).toContain('npm run build:notices');
  });
});
