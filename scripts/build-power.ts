/**
 * Builds the self-contained Cangjie Oracle Power in `oracle/power/`:
 *   server.mjs, data/oracle-data.json, NOTICE.md and licenses/*.
 * `buildPowerFiles` reads inputs and returns the exact bytes without writing;
 * `main` is the only writer. Run with `npm run build:power`.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CharacterRecord } from '../app/src/data/types';

export interface PowerFile {
  /** Path relative to the repository root, with `/` separators. */
  path: string;
  contents: string | Uint8Array;
}

/** The fields the Oracle tools read; typed against CharacterRecord so a rename fails tsc. */
export type PowerRecord = Pick<CharacterRecord, 'character' | 'cangjie'> & {
  sources: Pick<CharacterRecord['sources'], 'cangjie'>;
  decomposition: Pick<
    CharacterRecord['decomposition'],
    'decomposition' | 'atomic' | 'radical' | 'components'
  >;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVEL_FILES = ['characters.json', 'characters-level2.json', 'characters-level3.json'];

/** Keeps exactly the seven fields the tools read; a character in two inputs fails. */
export function deriveOracleData(levels: readonly Record<string, CharacterRecord>[]): string {
  const out: Record<string, PowerRecord> = {};
  for (const level of levels) {
    for (const [key, r] of Object.entries(level)) {
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        throw new Error(`Character ${key} appears in more than one level dataset`);
      }
      out[key] = {
        character: r.character,
        cangjie: r.cangjie,
        sources: { cangjie: r.sources.cangjie },
        decomposition: {
          decomposition: r.decomposition.decomposition,
          atomic: r.decomposition.atomic,
          radical: r.decomposition.radical,
          components: r.decomposition.components,
        },
      };
    }
  }
  return `${JSON.stringify(out)}\n`;
}

interface DataSource {
  name: string;
  version: string;
  field: string;
  licence: string;
  url: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    name: 'Unihan (`Unihan_DictionaryLikeData.txt`)',
    version: 'Unicode 18.0.0',
    field: '`kCangjie` (Cangjie codes)',
    licence: 'Unicode License V3',
    url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  },
  {
    name: 'Make Me a Hanzi (`dictionary.txt`)',
    version: 'commit bddc96d41bef78427ed0e034e9f7e31d71fd1b92',
    field: 'decomposition, radical, components, atomic flag',
    licence: 'GNU LGPL v3.0 or later (LGPL-3.0-or-later)',
    url: 'https://github.com/skishore/makemeahanzi',
  },
];

const DATA_LICENCE_COPIES: { from: string; to: string }[] = [
  { from: 'data/raw/unihan/LICENSE', to: 'oracle/power/licenses/unihan-LICENSE.txt' },
  { from: 'data/raw/make-me-a-hanzi/LICENSE', to: 'oracle/power/licenses/make-me-a-hanzi-LICENSE.txt' },
  { from: 'data/raw/make-me-a-hanzi/LGPL', to: 'oracle/power/licenses/make-me-a-hanzi-LGPL.txt' },
];

interface BundledPackage {
  name: string;
  version: string;
  licence: string;
  dir: string;
}

/** Packages under node_modules named by the metafile inputs, sorted by name. */
function bundledPackages(inputPaths: string[]): BundledPackage[] {
  const dirs = new Set<string>();
  for (const p of inputPaths) {
    const marker = 'node_modules/';
    const at = p.lastIndexOf(marker);
    if (at === -1) continue;
    const parts = p.slice(at + marker.length).split('/');
    const nameLen = parts[0].startsWith('@') ? 2 : 1;
    dirs.add(p.slice(0, at + marker.length) + parts.slice(0, nameLen).join('/'));
  }
  const found = new Map<string, BundledPackage>();
  for (const dir of dirs) {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
      license?: string;
    };
    const known = found.get(pkg.name);
    if (known && known.version !== pkg.version) {
      throw new Error(`Two versions of ${pkg.name} are bundled (${known.version}, ${pkg.version})`);
    }
    found.set(pkg.name, {
      name: pkg.name,
      version: pkg.version,
      licence: pkg.license ?? 'UNKNOWN',
      dir,
    });
  }
  return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function npmLicenceFileName(name: string): string {
  return `npm-${name.replace(/^@/, '').replace(/\//g, '-')}-LICENSE.txt`;
}

function noticeText(packages: BundledPackage[]): string {
  const lines: string[] = [];
  lines.push('# Cangjie Oracle Power: notice', '');
  lines.push(
    'This folder is generated. `server.mjs` is the bundled Cangjie Oracle server and `data/oracle-data.json` is a derived copy of the Cangjie code and decomposition fields of the three level datasets. To rebuild both, run `npm run build:power` in the repository root.',
    '',
  );
  lines.push('## Data sources', '');
  lines.push('| Source | Version | Fields used | Licence | URL |', '| --- | --- | --- | --- | --- |');
  for (const s of DATA_SOURCES) {
    lines.push(`| ${s.name} | ${s.version} | ${s.field} | ${s.licence} | ${s.url} |`);
  }
  lines.push('');
  lines.push(
    '`data/oracle-data.json` is data derived from these two sources and keeps their terms: the Cangjie codes stay under the Unicode License V3 and the decomposition fields stay under LGPL-3.0-or-later. The code of this repository, including the code in `server.mjs` that is not from a package listed below, is MIT.',
    '',
  );
  lines.push(
    'The data file contains no CC-CEDICT, Arphic or HSK list data.',
    '',
    'Licence texts: `licenses/unihan-LICENSE.txt`, `licenses/make-me-a-hanzi-LICENSE.txt` and `licenses/make-me-a-hanzi-LGPL.txt`.',
    '',
  );
  lines.push('## npm packages bundled in `server.mjs`', '');
  lines.push('| Package | Version | Licence | Licence file |', '| --- | --- | --- | --- |');
  for (const p of packages) {
    lines.push(`| ${p.name} | ${p.version} | ${p.licence} | licenses/${npmLicenceFileName(p.name)} |`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

function findLicenceFile(dir: string): string {
  const abs = join(REPO_ROOT, dir);
  const hit = readdirSync(abs)
    .filter((f) => /^(licen[sc]e|copying)(\.|$)/i.test(f))
    .sort()[0];
  if (!hit) throw new Error(`No licence file found in ${dir}`);
  return join(dir, hit);
}

const toLf = (s: string): string => s.replace(/\r\n?/g, '\n');

export async function buildPowerFiles(): Promise<PowerFile[]> {
  const levels = LEVEL_FILES.map(
    (name) =>
      JSON.parse(readFileSync(join(REPO_ROOT, 'app/public/data', name), 'utf8')) as Record<
        string,
        CharacterRecord
      >,
  );
  const dataJson = deriveOracleData(levels);

  const outfile = join(REPO_ROOT, 'oracle/power/server.mjs');
  const result = await build({
    entryPoints: ['oracle/src/power.ts'],
    absWorkingDir: REPO_ROOT,
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    target: 'node20',
    banner: {
      js: 'import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);',
    },
    minify: true,
    legalComments: 'eof',
    metafile: true,
    write: false,
    logLevel: 'silent',
    tsconfig: 'oracle/tsconfig.json',
  });
  if (result.errors.length > 0 || result.warnings.length > 0) {
    const all = [...result.errors, ...result.warnings].map((m) => m.text).join('; ');
    throw new Error(`esbuild reported problems: ${all}`);
  }
  if (result.outputFiles.length !== 1) {
    throw new Error(`Expected one output file, got ${result.outputFiles.length}`);
  }
  const bundle = toLf(result.outputFiles[0].text);

  const packages = bundledPackages(Object.keys(result.metafile.inputs));
  const files: PowerFile[] = [
    { path: 'oracle/power/server.mjs', contents: bundle },
    { path: 'oracle/power/data/oracle-data.json', contents: dataJson },
    { path: 'oracle/power/NOTICE.md', contents: noticeText(packages) },
  ];
  for (const c of DATA_LICENCE_COPIES) {
    files.push({ path: c.to, contents: new Uint8Array(readFileSync(join(REPO_ROOT, c.from))) });
  }
  for (const p of packages) {
    files.push({
      path: `oracle/power/licenses/${npmLicenceFileName(p.name)}`,
      contents: new Uint8Array(readFileSync(join(REPO_ROOT, findLicenceFile(p.dir)))),
    });
  }
  return files;
}

export async function main(): Promise<void> {
  const files = await buildPowerFiles();
  for (const f of files) {
    const abs = join(REPO_ROOT, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.contents);
    console.log(`wrote ${f.path} (${Buffer.byteLength(f.contents)} bytes)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
