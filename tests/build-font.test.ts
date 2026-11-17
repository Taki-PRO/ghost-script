import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FONT_SOURCE_SHA256,
  FontBuildError,
  cmapCoverage,
  collectGlyphSet,
  missingGlyphs,
  renderFontsCss,
  sha256Hex,
  stripComments,
  unicodeRange,
  verifySourceChecksum,
} from '../scripts/build-font';

const ROOT = resolve(__dirname, '..');

/** A minimal sfnt with one cmap table holding the given subtable bytes. */
function fakeFont(subtable: number[]): Uint8Array {
  const cmap = [0, 0, 0, 1, 0, 3, 0, 10, 0, 0, 0, 12, ...subtable];
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const header = [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  const record = [0x63, 0x6d, 0x61, 0x70, ...u32(0), ...u32(28), ...u32(cmap.length)];
  return Uint8Array.from([...header, ...record, ...cmap]);
}

describe('collectGlyphSet', () => {
  it('returns sorted unique code points from every source', () => {
    const set = collectGlyphSet({
      dataset: ['明', '一'],
      keyShapes: ['日', '一'],
      legend: '天，天',
      uiText: ['abc 鬼 123', '一'],
    });
    expect(set).toEqual(['一', '天', '日', '明', '鬼', '，']);
  });

  it('keeps only CJK characters and fullwidth punctuation from UI text', () => {
    const set = collectGlyphSet({
      dataset: [],
      keyShapes: [],
      legend: '',
      uiText: ['Hello, world! “quoted” — 字？'],
    });
    expect(set).toEqual(['字', '？']);
  });

  it('excludes comment text and includes string text once comments are stripped', () => {
    const source = [
      '// 么 comment',
      '/* 第 block',
      '   comment */',
      "const a = '我';",
      'const url = "https://example.com/米";',
      'const b = <p>ghost\'s 格</p>;',
      '// 字',
      '{/* ～ jsx comment */}',
    ].join('\n');
    const set = collectGlyphSet({ dataset: [], keyShapes: [], legend: '', uiText: [stripComments(source)] });
    expect(set).toEqual(['我', '格', '米']);
  });
});

describe('missingGlyphs', () => {
  it('reports the characters without a glyph, in input order', () => {
    const has = new Set(['一'.codePointAt(0), '日'.codePointAt(0)]);
    expect(missingGlyphs(['一', '難', '日', '鬼'], (cp) => has.has(cp))).toEqual(['難', '鬼']);
  });

  it('reports nothing when every glyph exists', () => {
    expect(missingGlyphs(['一'], () => true)).toEqual([]);
  });
});

describe('unicodeRange', () => {
  it('merges consecutive code points into ranges', () => {
    const chars = ['一', '中', '丮', '丯', '丰'].map((c) => c);
    // U+4E00, U+4E2D, U+4E2E, U+4E2F, U+4E30
    expect(unicodeRange(chars)).toBe('U+4E00,U+4E2D-4E30');
  });

  it('writes a single code point without a range and pads to four digits', () => {
    expect(unicodeRange(['，', '一'])).toBe('U+4E00,U+FF0C');
    expect(unicodeRange(['\u0041'])).toBe('U+0041');
  });

  it('is empty for an empty set', () => {
    expect(unicodeRange([])).toBe('');
  });
});

describe('renderFontsCss', () => {
  const css = renderFontsCss(['一', '日'], '../assets/fonts/x.woff2');
  it('has one @font-face rule with swap, the unicode-range and the one url', () => {
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css).toContain('font-family: "LXGW WenKai Subset";');
    expect(css).toContain('src: url("../assets/fonts/x.woff2") format("woff2");');
    expect(css).toContain('font-display: swap;');
    expect(css).toContain('unicode-range: U+4E00,U+65E5;');
    expect(css.match(/url\(/g)).toHaveLength(1);
    expect(css).not.toContain('@media');
  });
});

describe('cmapCoverage', () => {
  it('reads a format 12 subtable', () => {
    const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    // format 12, reserved, length, language, one group U+4E00-4E02 starting at glyph 5
    const sub = [0, 12, 0, 0, ...u32(28), ...u32(0), ...u32(1), ...u32(0x4e00), ...u32(0x4e02), ...u32(5)];
    const has = cmapCoverage(fakeFont(sub));
    expect(has(0x4e00)).toBe(true);
    expect(has(0x4e02)).toBe(true);
    expect(has(0x4e03)).toBe(false);
    expect(has(0x41)).toBe(false);
  });
});

describe('verifySourceChecksum', () => {
  it('accepts data that matches', () => {
    const data = Buffer.from('font bytes');
    expect(() => verifySourceChecksum(data, sha256Hex(data))).not.toThrow();
  });

  it('throws naming the expected and actual SHA-256 on a mismatch', () => {
    const data = Buffer.from('not the font');
    expect(() => verifySourceChecksum(data)).toThrow(FontBuildError);
    expect(() => verifySourceChecksum(data)).toThrow(FONT_SOURCE_SHA256);
    expect(() => verifySourceChecksum(data)).toThrow(sha256Hex(data));
  });

  it('pins the checksum recorded in the design', () => {
    expect(FONT_SOURCE_SHA256).toBe('2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b');
  });
});

describe('build-font CLI', () => {
  it('exits non-zero and reports both checksums when the source file does not match', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-font-'));
    try {
      const bad = join(dir, 'bad.ttf');
      writeFileSync(bad, 'not a font');
      const run = spawnSync(join(ROOT, 'node_modules', '.bin', 'tsx'), [join(ROOT, 'scripts', 'build-font.ts'), '--source', bad], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain(FONT_SOURCE_SHA256);
      expect(run.stderr).toContain(sha256Hex(Buffer.from('not a font')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
