/**
 * Font pipeline: subsets LXGW WenKai Regular (v1.530, SIL OFL 1.1) to the
 * characters the app can show and writes the subset, the glyph set and the
 * @font-face stylesheet. Started with `npm run build:font`.
 *
 * Steps: read or download the pinned source, verify its SHA-256, compute the
 * glyph set from code and data, check the source covers every glyph, subset to
 * WOFF2, write the outputs, print bytes, gzip bytes and SHA-256.
 *
 * The glyph set is always computed from the repository, never listed by hand.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CANGJIE_KEYS } from '../app/src/engine/cangjieRules';
import { LEGEND_SOURCE } from '../app/src/data/citations';

export const FONT_URL =
  'https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf';
export const FONT_SOURCE_SHA256 =
  '2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b';
export const FONT_FAMILY = 'LXGW WenKai Subset';
export const SUBSET_FILE_NAME = 'lxgw-wenkai-subset.woff2';

/** CJK ideographs (incl. extension A), CJK symbols and punctuation (not U+3000), fullwidth forms. */
const CJK_CHAR = /[\u3001-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]|[\u{20000}-\u{2FA1F}]/u;

export class FontBuildError extends Error {}

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Throws FontBuildError naming the expected and actual SHA-256 when they differ. */
export function verifySourceChecksum(data: Uint8Array, expected: string = FONT_SOURCE_SHA256): void {
  const actual = sha256Hex(data);
  if (actual !== expected) {
    throw new FontBuildError(
      `Source font checksum mismatch.\n  expected SHA-256: ${expected}\n  actual SHA-256:   ${actual}`,
    );
  }
}

/**
 * Removes `//` and block comments from TypeScript/TSX source. Quoted strings
 * are kept. A quote ends at a line break, so an apostrophe in JSX text cannot
 * swallow the rest of the file. Template literals may span lines.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === '\\' && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (c === quote || (c === '\n' && quote !== '`')) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
    i += 1;
  }
  return out;
}

export function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}

function codePoints(text: string): string[] {
  return Array.from(text);
}

/** Pure. Sorted by code point, unique. Dataset, key shapes and legend are taken whole; uiText keeps only CJK characters and fullwidth punctuation. */
export function collectGlyphSet(input: {
  dataset: readonly string[];
  keyShapes: readonly string[];
  legend: string;
  uiText: readonly string[];
}): string[] {
  const all = new Set<string>();
  for (const s of [...input.dataset, ...input.keyShapes, input.legend]) {
    for (const ch of codePoints(s)) all.add(ch);
  }
  for (const s of input.uiText) {
    for (const ch of codePoints(s)) if (CJK_CHAR.test(ch)) all.add(ch);
  }
  return [...all].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
}

/** Pure. The characters of `set` for which `hasGlyph(codePoint)` is false, in input order. */
export function missingGlyphs(set: readonly string[], hasGlyph: (cp: number) => boolean): string[] {
  return set.filter((ch) => !hasGlyph(ch.codePointAt(0) ?? 0));
}

/** Pure. A CSS unicode-range value, for example "U+4E00,U+4E2D-4E3F". */
export function unicodeRange(set: readonly string[]): string {
  const cps = [...new Set(set.map((ch) => ch.codePointAt(0) ?? 0))].sort((a, b) => a - b);
  const hex = (n: number): string => n.toString(16).toUpperCase().padStart(4, '0');
  const parts: string[] = [];
  let i = 0;
  while (i < cps.length) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j += 1;
    parts.push(i === j ? `U+${hex(cps[i])}` : `U+${hex(cps[i])}-${hex(cps[j])}`);
    i = j + 1;
  }
  return parts.join(',');
}

/** Pure. The generated stylesheet: one @font-face rule, no media block. */
export function renderFontsCss(set: readonly string[], fontUrl: string): string {
  return (
    '/* Generated by scripts/build-font.ts. Do not edit by hand.\n' +
    ' * LXGW WenKai Regular v1.530, SIL Open Font License 1.1, subset to the glyph set of this game. */\n' +
    '@font-face {\n' +
    `  font-family: "${FONT_FAMILY}";\n` +
    `  src: url("${fontUrl}") format("woff2");\n` +
    '  font-weight: 400;\n' +
    '  font-style: normal;\n' +
    '  font-display: swap;\n' +
    `  unicode-range: ${unicodeRange(set)};\n` +
    '}\n'
  );
}

/**
 * Reads the cmap table of a TrueType/OpenType file (formats 4 and 12) and
 * returns a lookup: does the font have a glyph for this code point.
 */
export function cmapCoverage(font: Uint8Array): (cp: number) => boolean {
  const v = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const numTables = v.getUint16(4);
  let cmapOffset = -1;
  for (let t = 0; t < numTables; t += 1) {
    const rec = 12 + t * 16;
    const tag = String.fromCharCode(font[rec], font[rec + 1], font[rec + 2], font[rec + 3]);
    if (tag === 'cmap') cmapOffset = v.getUint32(rec + 8);
  }
  if (cmapOffset < 0) throw new FontBuildError('The source font has no cmap table.');

  const lookups: Array<(cp: number) => boolean> = [];
  const subtables = v.getUint16(cmapOffset + 2);
  for (let s = 0; s < subtables; s += 1) {
    const o = cmapOffset + v.getUint32(cmapOffset + 4 + s * 8 + 4);
    const format = v.getUint16(o);
    if (format === 12) {
      const groups = v.getUint32(o + 12);
      const base = o + 16;
      lookups.push((cp) => {
        let lo = 0;
        let hi = groups - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const g = base + mid * 12;
          const start = v.getUint32(g);
          const end = v.getUint32(g + 4);
          if (cp < start) hi = mid - 1;
          else if (cp > end) lo = mid + 1;
          else return v.getUint32(g + 8) + (cp - start) !== 0;
        }
        return false;
      });
    } else if (format === 4) {
      const segCount = v.getUint16(o + 6) / 2;
      const endBase = o + 14;
      const startBase = endBase + segCount * 2 + 2;
      const deltaBase = startBase + segCount * 2;
      const rangeBase = deltaBase + segCount * 2;
      lookups.push((cp) => {
        if (cp > 0xffff) return false;
        for (let k = 0; k < segCount; k += 1) {
          if (cp > v.getUint16(endBase + k * 2)) continue;
          const start = v.getUint16(startBase + k * 2);
          if (cp < start) return false;
          const delta = v.getUint16(deltaBase + k * 2);
          const rangeOffset = v.getUint16(rangeBase + k * 2);
          if (rangeOffset === 0) return ((cp + delta) & 0xffff) !== 0;
          const glyphAt = rangeBase + k * 2 + rangeOffset + (cp - start) * 2;
          const glyph = v.getUint16(glyphAt);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        }
        return false;
      });
    }
  }
  return (cp) => lookups.some((has) => has(cp));
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listSourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) files.push(path);
  }
  return files;
}

/** Computes the glyph set of the repository at `root`. */
export function computeRepoGlyphSet(root: string): string[] {
  const dataset = Object.keys(
    JSON.parse(readFileSync(join(root, 'app', 'public', 'data', 'characters.json'), 'utf8')) as Record<
      string,
      unknown
    >,
  );
  const uiText = listSourceFiles(join(root, 'app', 'src')).map((f) => stripComments(readFileSync(f, 'utf8')));
  uiText.push(stripHtmlComments(readFileSync(join(root, 'app', 'index.html'), 'utf8')));
  return collectGlyphSet({
    dataset,
    keyShapes: CANGJIE_KEYS.map((k) => k.shape),
    legend: LEGEND_SOURCE.zh,
    uiText,
  });
}

export interface BuildFontOptions {
  /** Path of the source TTF. Downloaded from FONT_URL into this path when absent. */
  sourcePath: string;
  /** Path of the WOFF2 subset to write. */
  outPath: string;
  /** Repository root. Defaults to the parent of `scripts/`. */
  root?: string;
  glyphSetPath?: string;
  cssPath?: string;
}

export interface BuildFontResult {
  bytes: number;
  gzipBytes: number;
  sha256: string;
  glyphCount: number;
}

async function readOrDownload(sourcePath: string): Promise<Buffer> {
  if (existsSync(sourcePath)) return readFileSync(sourcePath);
  console.log(`Downloading ${FONT_URL}`);
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new FontBuildError(`Download failed: HTTP ${res.status} for ${FONT_URL}`);
  const data = Buffer.from(await res.arrayBuffer());
  // Verify before caching, so a bad download is never kept.
  verifySourceChecksum(data);
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, data);
  return data;
}

export async function buildFont(opts: BuildFontOptions): Promise<BuildFontResult> {
  const root = opts.root ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const glyphSetPath = opts.glyphSetPath ?? join(root, 'data', 'fonts', 'glyph-set.txt');
  const cssPath = opts.cssPath ?? join(root, 'app', 'src', 'styles', 'fonts.css');

  const source = await readOrDownload(opts.sourcePath);
  verifySourceChecksum(source);

  const set = computeRepoGlyphSet(root);
  const missing = missingGlyphs(set, cmapCoverage(source));
  if (missing.length > 0) {
    throw new FontBuildError(
      `The source font has no glyph for ${missing.length} character(s): ${missing.join(' ')} (${missing
        .map((m) => `U+${(m.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
        .join(', ')})`,
    );
  }

  const { default: subsetFont } = await import('subset-font');
  const subset = await subsetFont(source, set.join(''), { targetFormat: 'woff2' });

  mkdirSync(dirname(opts.outPath), { recursive: true });
  mkdirSync(dirname(glyphSetPath), { recursive: true });
  mkdirSync(dirname(cssPath), { recursive: true });
  writeFileSync(opts.outPath, subset);
  writeFileSync(glyphSetPath, `${set.join('')}\n`);
  writeFileSync(cssPath, renderFontsCss(set, `../assets/fonts/${SUBSET_FILE_NAME}`));

  return {
    bytes: subset.byteLength,
    gzipBytes: gzipSync(subset, { level: 9 }).byteLength,
    sha256: sha256Hex(subset),
    glyphCount: set.length,
  };
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const flag = args.indexOf('--source');
  const sourcePath =
    flag >= 0 && args[flag + 1]
      ? resolve(args[flag + 1])
      : join(root, 'data', 'raw', 'fonts', 'cache', 'LXGWWenKai-Regular.ttf');
  try {
    const r = await buildFont({
      sourcePath,
      outPath: join(root, 'app', 'src', 'assets', 'fonts', SUBSET_FILE_NAME),
      root,
    });
    console.log(`Glyphs: ${r.glyphCount}`);
    console.log(`Subset bytes: ${r.bytes}`);
    console.log(`Subset gzip bytes: ${r.gzipBytes}`);
    console.log(`Subset SHA-256: ${r.sha256}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ESM-safe execution guard: run main() only when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
