// CLI: writes the proof-pass hash fixtures. Run before any override edit:
//   npx tsx tests/helpers/capture-proof-pass-fixtures.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashRecord, hashRecordWithoutPrompt, sha256, type HashableRecord } from './record-hashes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'tests', 'fixtures', 'proof-pass');
mkdirSync(outDir, { recursive: true });

function write(name: string, value: unknown): void {
  writeFileSync(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

const datasets: Array<[string, string]> = [
  ['level1-record-hashes.json', 'characters.json'],
  ['level2-record-hashes.json', 'characters-level2.json'],
  ['level3-record-hashes.json', 'characters-level3.json'],
];
for (const [out, src] of datasets) {
  const data = JSON.parse(readFileSync(join(root, 'app/public/data', src), 'utf8')) as Record<string, HashableRecord>;
  const hashes: Record<string, { full: string; noPrompt: string }> = {};
  for (const [char, record] of Object.entries(data)) {
    hashes[char] = { full: hashRecord(record), noPrompt: hashRecordWithoutPrompt(record) };
  }
  write(out, hashes);
  console.log(`${out}: ${Object.keys(hashes).length} records`);
}

const lineFixtures: Array<[string, string]> = [
  ['prompt-review-level1-line-hashes.json', 'data/prompt-review.csv'],
  ['prompt-review-sample-level2-line-hashes.json', 'data/prompt-review-sample-level2.csv'],
];
for (const [out, src] of lineFixtures) {
  const lines = readFileSync(join(root, src), 'utf8').split('\n').filter((l) => l !== '');
  const hashes: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const char = line.slice(0, line.indexOf(','));
    if (char in hashes) throw new Error(`duplicate character ${char} in ${src}`);
    hashes[char] = sha256(line);
  }
  write(out, hashes);
  console.log(`${out}: ${Object.keys(hashes).length} lines`);
}
