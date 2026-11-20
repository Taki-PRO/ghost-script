import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// night-sounds Requirements 18.1, 18.2, 18.4, 19.5, 21.8
const repoRoot = resolve(__dirname, '..', '..');
const appDir = resolve(repoRoot, 'app');

const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'oga',
  'opus',
  'm4a',
  'aac',
  'flac',
  'aif',
  'aiff',
  'weba',
  'mid',
  'midi',
];
const EXT_GROUP = AUDIO_EXTENSIONS.join('|');
const AUDIO_FILE = new RegExp(`\\.(${EXT_GROUP})$`, 'i');

const FORBIDDEN_SOURCE: { name: string; pattern: RegExp }[] = [
  { name: 'data:audio/', pattern: /data:audio\//i },
  { name: 'new Audio(', pattern: /new\s+Audio\s*\(/ },
  { name: '<audio', pattern: /<audio(?=[\s>/])/i },
  { name: 'createMediaElementSource', pattern: /createMediaElementSource/ },
  { name: 'decodeAudioData', pattern: /decodeAudioData/ },
  { name: 'fetch( naming an audio extension', pattern: new RegExp(`fetch\\s*\\([^)]*\\.(${EXT_GROUP})\\b`, 'i') },
  {
    name: 'XMLHttpRequest naming an audio extension',
    pattern: new RegExp(`XMLHttpRequest[\\s\\S]{0,300}?\\.(${EXT_GROUP})\\b`, 'i'),
  },
];

const KNOWN_PUBLIC_FILES = [
  'THIRD_PARTY_NOTICES.txt',
  'data/.gitkeep',
  'data/characters-level2.json',
  'data/characters-level3.json',
  'data/characters.json',
  'data/legend-strokes.json',
  'data/levels.json',
  'favicon.svg',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

const isTestFile = (file: string): boolean => /\.test\.tsx?$/.test(file);
const isSourceFile = (file: string): boolean => /\.(ts|tsx|js|jsx|css|html)$/.test(file);

function audioFiles(files: string[]): string[] {
  return files.filter((f) => AUDIO_FILE.test(f));
}

function forbiddenHits(text: string): string[] {
  return FORBIDDEN_SOURCE.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
}

function importsAudioMock(text: string): boolean {
  return /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*audioMock(?:\.[a-z]+)?['"]/.test(text);
}

const srcFiles = walk(resolve(appDir, 'src'));
const publicFiles = walk(resolve(appDir, 'public'));
const nonTestSource = srcFiles.filter((f) => isSourceFile(f) && !isTestFile(f));

describe('no audio files in the app', () => {
  it('has no audio-extension file under app/public or app/src', () => {
    expect(audioFiles([...publicFiles, ...srcFiles]).map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it('finds source files to scan', () => {
    expect(nonTestSource.length).toBeGreaterThan(10);
  });

  it('has no forbidden audio API or reference in any non-test source file', () => {
    const hits: string[] = [];
    for (const file of nonTestSource) {
      for (const name of forbiddenHits(readFileSync(file, 'utf8'))) {
        hits.push(`${relative(repoRoot, file)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps the runtime dependencies to the four known packages', () => {
    const pkg = JSON.parse(readFileSync(resolve(appDir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).toEqual([
      '@fontsource/cormorant-garamond',
      'hanzi-writer',
      'react',
      'react-dom',
    ]);
  });

  it('holds only the files known before this feature in app/public', () => {
    const listed = publicFiles.map((f) => relative(resolve(appDir, 'public'), f).split('\\').join('/'));
    expect(listed).toEqual([...KNOWN_PUBLIC_FILES].sort());
  });

  it('is imported by no non-test file in app/src (audioMock is for tests only)', () => {
    const importers = nonTestSource
      .filter((f) => importsAudioMock(readFileSync(f, 'utf8')))
      .map((f) => relative(repoRoot, f));
    expect(importers).toEqual([]);
  });
});

describe('the scan detects what it forbids (synthetic fixtures)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'no-audio-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it.each(AUDIO_EXTENSIONS)('flags a file ending in .%s', (ext) => {
    const dir = join(tmp, ext);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `sound.${ext}`), '');
    writeFileSync(join(dir, 'sound.txt'), '');
    expect(audioFiles(walk(dir)).map((f) => relative(dir, f))).toEqual([`sound.${ext}`]);
  });

  it.each([
    ['data:audio/', "const u = 'data:audio/wav;base64,AAAA';"],
    ['new Audio(', "const a = new Audio('x');"],
    ['<audio', 'const el = <audio src="x" />;'],
    ['createMediaElementSource', 'ctx.createMediaElementSource(el);'],
    ['decodeAudioData', 'await ctx.decodeAudioData(buf);'],
    ['fetch( naming an audio extension', "fetch('/sounds/tap.mp3');"],
    ['XMLHttpRequest naming an audio extension', "const x = new XMLHttpRequest(); x.open('GET', '/a/wind.ogg');"],
  ])('flags %s', (name, text) => {
    expect(forbiddenHits(text)).toContain(name);
  });

  it('does not flag a fetch of JSON', () => {
    expect(forbiddenHits("fetch('/data/levels.json');")).toEqual([]);
  });

  it('flags an import of audioMock and ignores other imports', () => {
    expect(importsAudioMock("import { createAudioMock } from './audioMock';")).toBe(true);
    expect(importsAudioMock("import { x } from '../audio/audioMock.ts';")).toBe(true);
    expect(importsAudioMock("import { x } from './engine';")).toBe(false);
  });

  it('flags an extra file in a public listing', () => {
    expect([...KNOWN_PUBLIC_FILES, 'wind.txt'].sort()).not.toEqual([...KNOWN_PUBLIC_FILES].sort());
  });
});
