import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectRuntimePackages,
  renderNotices,
  runtimeSummary,
  type NoticePackage,
} from '../../scripts/build-notices';
import { SOFTWARE_CREDITS } from '../../app/src/data/software';

const NOTICES_PATH = 'app/public/THIRD_PARTY_NOTICES.txt';

describe('committed third-party notices', () => {
  it('is up to date', () => {
    const committed = readFileSync(NOTICES_PATH, 'utf8');
    const fresh = renderNotices(collectRuntimePackages('app'));
    expect(
      fresh === committed,
      'THIRD_PARTY_NOTICES.txt is out of date. Run `npm run build:notices` and commit the result.',
    ).toBe(true);
  });

  it('is deterministic', () => {
    expect(renderNotices(collectRuntimePackages('app'))).toBe(renderNotices(collectRuntimePackages('app')));
  });

  it('is complete', () => {
    const committed = readFileSync(NOTICES_PATH, 'utf8');
    const packages = collectRuntimePackages('app');
    const names = packages.map((p) => p.name);
    for (const n of ['react', 'react-dom', 'hanzi-writer', 'scheduler', '@fontsource/cormorant-garamond']) {
      expect(names).toContain(n);
    }
    const appPkg = JSON.parse(readFileSync('app/package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const runtime = new Set([
      ...Object.keys(appPkg.dependencies ?? {}),
      ...Object.keys(appPkg.optionalDependencies ?? {}),
      ...names,
    ]);
    for (const dev of Object.keys(appPkg.devDependencies ?? {})) {
      if (!runtime.has(dev)) expect(names).not.toContain(dev);
    }
    for (const p of packages) {
      expect(committed).toContain(`${p.name} ${p.version}\nLicence: ${p.licence}\n`);
      for (const f of p.files) expect(committed).toContain(f.text);
    }
  });

  it('Credits match: SOFTWARE_CREDITS equals the packages in the committed file headers', () => {
    const committed = readFileSync(NOTICES_PATH, 'utf8');
    const rule = '='.repeat(80);
    const parsed: { name: string; version: string; licence: string }[] = [];
    const seen = new Set<string>();
    for (const m of committed.matchAll(/^(.+) (\S+)\nLicence: (.+)\n/gm)) {
      const key = `${m[1]} ${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ name: m[1], version: m[2], licence: m[3] });
    }
    expect(committed).toContain(rule);
    expect(parsed.length).toBeGreaterThan(0);
    expect(SOFTWARE_CREDITS.map((c) => ({ ...c }))).toEqual(parsed);
  });

  it('includes the font licence text', () => {
    const font = collectRuntimePackages('app').find((p) => p.name === '@fontsource/cormorant-garamond');
    expect(font).toBeDefined();
    const text = font!.files[0].text;
    expect(text.trimStart().startsWith('Copyright') || /SIL OPEN FONT LICENSE/i.test(text)).toBe(true);
    expect(/SIL OPEN FONT LICENSE Version 1\.1/i.test(text)).toBe(true);
    expect(readFileSync(NOTICES_PATH, 'utf8')).toContain(text);
  });
});

describe('notices script on a fixture tree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function pkg(dir: string, name: string, fields: Record<string, unknown>, files: Record<string, string> = {}): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...fields }));
    for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t);
  }

  function fixture(): { root: string; app: string; nm: (n: string) => string } {
    const root = mkdtempSync(join(tmpdir(), 'notices-'));
    dirs.push(root);
    const app = join(root, 'app');
    pkg(app, 'app', {
      dependencies: { a: '1.0.0', b: '1.0.0' },
      devDependencies: { devonly: '1.0.0' },
      peerDependencies: { peeronly: '1.0.0' },
    });
    const nm = (n: string): string => join(root, 'node_modules', n);
    pkg(nm('a'), 'a', { license: 'MIT', dependencies: { c: '1.0.0' } }, { LICENSE: 'A text\r\n' });
    pkg(nm('b'), 'b', { license: 'ISC', dependencies: { a: '1.0.0' } }, { LICENSE: 'B1', 'COPYING.md': 'B2\n', 'README.md': 'x' });
    pkg(nm('c'), 'c', { license: 'MIT', dependencies: { a: '1.0.0' } }, { LICENCE: 'C text' });
    pkg(nm('devonly'), 'devonly', { license: 'MIT' }, { LICENSE: 'dev' });
    pkg(nm('peeronly'), 'peeronly', { license: 'MIT' }, { LICENSE: 'peer' });
    return { root, app, nm };
  }

  it('skips dev and peer deps, finds hoisted deps, and ends cycles', () => {
    const { app } = fixture();
    expect(runtimeSummary(collectRuntimePackages(app)).map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('prints every licence file sorted by name, verbatim', () => {
    const { app } = fixture();
    const pkgs = collectRuntimePackages(app);
    expect(pkgs.find((p) => p.name === 'b')!.files.map((f) => f.fileName)).toEqual(['COPYING.md', 'LICENSE']);
    const out = renderNotices(pkgs);
    const b = out.slice(out.indexOf('\nb 1.0.0\n'), out.indexOf('\nc 1.0.0\n'));
    expect(b.indexOf('File: COPYING.md')).toBeGreaterThan(-1);
    expect(b.indexOf('File: COPYING.md')).toBeLessThan(b.indexOf('File: LICENSE\n'));
    expect(out).toContain('A text\r\n');
    expect(out).toContain('C text\n');
  });

  it('throws naming the package when the licence file is missing', () => {
    const { app, nm } = fixture();
    rmSync(join(nm('c'), 'LICENCE'));
    expect(() => collectRuntimePackages(app)).toThrow(/\bc\b/);
  });

  it('throws naming the package when the license field is missing', () => {
    const { app, nm } = fixture();
    pkg(nm('c'), 'c', {}, { LICENCE: 'C text' });
    expect(() => collectRuntimePackages(app)).toThrow(/Package c /);
  });

  it('renders the same string for shuffled input', () => {
    const { app } = fixture();
    const pkgs: NoticePackage[] = collectRuntimePackages(app);
    expect(renderNotices([...pkgs].reverse())).toBe(renderNotices(pkgs));
  });
});
