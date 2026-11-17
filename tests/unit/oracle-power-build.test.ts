import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { decompose, lookup, verify } from '../../oracle/src/oracle';
import { loadDataset } from '../../oracle/src/dataset';
import { buildPowerFiles, deriveOracleData, type PowerFile } from '../../scripts/build-power';
import type { CharacterRecord } from '../../app/src/data/types';

// Power_Staleness_Test. Requirements 10.3, 10.4, 10.6, 10.7, 10.8, 10.9, 10.10, 10.14, 9.1

const repoRoot = resolve(__dirname, '..', '..');
const dataDir = resolve(repoRoot, 'app/public/data');
const levelPaths = ['characters.json', 'characters-level2.json', 'characters-level3.json'].map(
  (name) => resolve(dataDir, name),
);
const powerDataPath = resolve(repoRoot, 'oracle/power/data/oracle-data.json');

const bytes = (c: string | Uint8Array): Buffer =>
  typeof c === 'string' ? Buffer.from(c, 'utf8') : Buffer.from(c);

const readLevels = (): Record<string, CharacterRecord>[] =>
  levelPaths.map((p) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, CharacterRecord>);

let built: PowerFile[] = [];

beforeAll(async () => {
  built = await buildPowerFiles();
}, 60_000);

const find = (path: string): PowerFile => {
  const f = built.find((x) => x.path === path);
  if (!f) throw new Error(`buildPowerFiles() produced no ${path}`);
  return f;
};

describe('Power_Staleness_Test: committed files equal a fresh build', () => {
  it('produces server.mjs, data, NOTICE.md and licenses/* and nothing else', () => {
    const paths = built.map((f) => f.path);
    expect(paths).toContain('oracle/power/server.mjs');
    expect(paths).toContain('oracle/power/data/oracle-data.json');
    expect(paths).toContain('oracle/power/NOTICE.md');
    for (const p of paths) {
      expect(
        p === 'oracle/power/server.mjs' ||
          p === 'oracle/power/data/oracle-data.json' ||
          p === 'oracle/power/NOTICE.md' ||
          p.startsWith('oracle/power/licenses/'),
        `unexpected build output ${p}`,
      ).toBe(true);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('every built file equals the committed file byte for byte', () => {
    for (const f of built) {
      const abs = resolve(repoRoot, f.path);
      expect(existsSync(abs), `${f.path} is missing. Run \`npm run build:power\` and commit the result.`).toBe(true);
      const same = bytes(f.contents).equals(readFileSync(abs));
      expect(same, `${f.path} is stale. Run \`npm run build:power\` and commit the result.`).toBe(true);
    }
  });

  it('licenses/ holds no file that the build does not produce', () => {
    const expected = built
      .filter((f) => f.path.startsWith('oracle/power/licenses/'))
      .map((f) => f.path.slice('oracle/power/licenses/'.length))
      .sort();
    const onDisk = readdirSync(resolve(repoRoot, 'oracle/power/licenses')).sort();
    expect(
      onDisk,
      'licenses/ differs from the build output. Run `npm run build:power` and commit the result.',
    ).toEqual(expected);
  });
});

describe('Power_Staleness_Test: answers equal the Level_Datasets', () => {
  const appData = loadDataset(levelPaths);
  const powerData = loadDataset(powerDataPath);

  it('has 1,200 characters with equal key sets', () => {
    expect(appData.size).toBe(1200);
    expect(powerData.size).toBe(1200);
    expect([...powerData.keys()]).toEqual([...appData.keys()]);
  });

  it('lookup, verify (stored and a wrong valid code) and decompose are equal for every character', () => {
    let checked = 0;
    for (const [ch, rec] of appData) {
      expect(lookup(powerData, ch), `lookup ${ch}`).toEqual(lookup(appData, ch));
      expect(decompose(powerData, ch), `decompose ${ch}`).toEqual(decompose(appData, ch));
      const wrong = rec.cangjie === 'A' ? 'B' : 'A';
      const codes = rec.cangjie === null ? [wrong] : [rec.cangjie, wrong];
      for (const code of codes) {
        expect(verify(powerData, ch, code), `verify ${ch} ${code}`).toEqual(
          verify(appData, ch, code),
        );
      }
      if (rec.cangjie !== null) {
        expect(verify(powerData, ch, rec.cangjie)).toMatchObject({ found: true, matches: true });
        expect(verify(powerData, ch, wrong)).toMatchObject({ found: true, matches: false });
      }
      checked += 1;
    }
    expect(checked).toBe(1200);
  });

  it('answers a character outside the dataset the same way', () => {
    const outside = '龘';
    expect(appData.has(outside)).toBe(false);
    expect(lookup(powerData, outside)).toEqual(lookup(appData, outside));
    expect(decompose(powerData, outside)).toEqual(decompose(appData, outside));
    expect(verify(powerData, outside, 'AB')).toEqual(verify(appData, outside, 'AB'));
  });
});

describe('deriveOracleData', () => {
  const levels = readLevels();
  const derived = JSON.parse(deriveOracleData(levels)) as Record<string, Record<string, unknown>>;

  it('keeps exactly the seven fields and drops all others', () => {
    const sample = levels[0]['明'];
    expect(sample).toBeDefined();
    const out = JSON.parse(deriveOracleData([{ 明: sample }])) as Record<string, unknown>;
    expect(out).toEqual({
      明: {
        character: sample.character,
        cangjie: sample.cangjie,
        sources: { cangjie: sample.sources.cangjie },
        decomposition: {
          decomposition: sample.decomposition.decomposition,
          atomic: sample.decomposition.atomic,
          radical: sample.decomposition.radical,
          components: sample.decomposition.components,
        },
      },
    });
    for (const rec of Object.values(derived)) {
      expect(Object.keys(rec)).toEqual(['character', 'cangjie', 'sources', 'decomposition']);
      expect(Object.keys(rec.sources as object)).toEqual(['cangjie']);
      expect(Object.keys(rec.decomposition as object)).toEqual([
        'decomposition',
        'atomic',
        'radical',
        'components',
      ]);
    }
  });

  it('is compact JSON with one trailing newline and keeps level order', () => {
    const text = deriveOracleData(levels);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.slice(0, -1)).not.toContain('\n');
    expect(Object.keys(derived)).toEqual(levels.flatMap((l) => Object.keys(l)));
  });

  it('fails when a character is present in two inputs', () => {
    expect(() => deriveOracleData([levels[0], levels[0]])).toThrow(/more than one/);
    const ch = Object.keys(levels[1])[0];
    expect(() => deriveOracleData([levels[0], { [ch]: levels[1][ch] }, levels[1]])).toThrow(
      new RegExp(ch),
    );
  });
});

describe('Power_Bundle and data hygiene', () => {
  const bundle = readFileSync(resolve(repoRoot, 'oracle/power/server.mjs'), 'utf8');
  const data = readFileSync(powerDataPath, 'utf8');

  it('contain no /Users/ path and no drive-letter path', () => {
    for (const [name, text] of [['server.mjs', bundle], ['oracle-data.json', data]] as const) {
      expect(text, `${name} has /Users/`).not.toContain('/Users/');
      expect(text, `${name} has a drive-letter path`).not.toMatch(/\b[A-Za-z]:[\\/]/);
    }
  });

  it('contain no build timestamp (full times only; ajv-formats has a partial "T" literal)', () => {
    for (const [name, text] of [['server.mjs', bundle], ['oracle-data.json', data]] as const) {
      expect(text, `${name} has a time`).not.toMatch(/T\d\d:\d\d:\d\d/);
    }
  });

  it('is deterministic: a second build gives identical bytes', async () => {
    const again = await buildPowerFiles();
    expect(again.map((f) => f.path)).toEqual(built.map((f) => f.path));
    for (const f of again) {
      expect(bytes(f.contents).equals(bytes(find(f.path).contents)), f.path).toBe(true);
    }
  }, 60_000);
});

describe('Power licence record', () => {
  const notice = readFileSync(resolve(repoRoot, 'oracle/power/NOTICE.md'), 'utf8');
  const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

  it('NOTICE.md names Unicode License V3 and LGPL-3.0-or-later', () => {
    expect(notice).toContain('Unicode License V3');
    expect(notice).toContain('LGPL-3.0-or-later');
  });

  it('the README table names both licences', () => {
    expect(readme).toContain('Unicode License V3');
    expect(readme).toMatch(/LGPL[ -]v?3\.0[ -]or[ -]later/);
  });

  it('licenses/ copies equal their originals under data/raw/', () => {
    const pairs: [string, string][] = [
      ['data/raw/unihan/LICENSE', 'oracle/power/licenses/unihan-LICENSE.txt'],
      ['data/raw/make-me-a-hanzi/LICENSE', 'oracle/power/licenses/make-me-a-hanzi-LICENSE.txt'],
      ['data/raw/make-me-a-hanzi/LGPL', 'oracle/power/licenses/make-me-a-hanzi-LGPL.txt'],
    ];
    for (const [from, to] of pairs) {
      expect(
        readFileSync(resolve(repoRoot, to)).equals(readFileSync(resolve(repoRoot, from))),
        `${to} differs from ${from}. Run \`npm run build:power\`.`,
      ).toBe(true);
    }
  });

  it('every npm package in NOTICE.md has its licence file', () => {
    const files = [...notice.matchAll(/\| (licenses\/npm-[^ |]+) \|/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(existsSync(resolve(repoRoot, 'oracle/power', f)), f).toBe(true);
  });
});
