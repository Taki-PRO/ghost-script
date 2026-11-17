import { describe, expect, it } from 'vitest';
import { CANGJIE_CITATIONS, LEGEND_SOURCE } from './citations';
import { CODE_LICENCE, COMBINED_WORK_NOTE, DATA_SOURCES, FONTS } from './credits';

describe('credits data', () => {
  it('lists the five README data sources with non-empty fields and https URLs', () => {
    expect(DATA_SOURCES).toHaveLength(5);
    for (const s of DATA_SOURCES) {
      for (const v of [s.name, s.version, s.use, s.licence]) expect(v.trim()).not.toBe('');
      expect(s.url.startsWith('https://')).toBe(true);
    }
  });

  it('has the combined-work note, MIT code licence and the font', () => {
    expect(COMBINED_WORK_NOTE).toContain('combined work');
    expect(CODE_LICENCE).toBe('MIT');
    expect(FONTS).toHaveLength(2);
    expect(FONTS[0].name).toBe('Cormorant Garamond');
    expect(FONTS[0].licence).toBe('SIL Open Font License 1.1');
    expect(FONTS[0].copyright).toContain('The Cormorant Project Authors');
    const wenkai = FONTS[1];
    expect(wenkai.name).toBe('LXGW WenKai Regular');
    expect(wenkai.version).toBe('v1.530');
    expect(wenkai.licence).toBe('SIL Open Font License 1.1');
    expect(wenkai.copyright).toContain('Copyright 2021-2026 LXGW (https://github.com/lxgw/LxgwWenKai)');
    expect(wenkai.copyright).toContain('Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)');
  });
});

describe('citations data', () => {
  it('cites both Wikipedia articles with https URLs', () => {
    expect(CANGJIE_CITATIONS).toEqual([
      { title: 'Cangjie input method', url: 'https://en.wikipedia.org/wiki/Cangjie_input_method' },
      { title: 'Chu Bong-Foo', url: 'https://en.wikipedia.org/wiki/Chu_Bong-Foo' },
    ]);
    for (const c of CANGJIE_CITATIONS) expect(c.url.startsWith('https://')).toBe(true);
  });

  it('has the legend line, an English rendering saying "wept", and the citation', () => {
    expect(LEGEND_SOURCE.zh).toBe('天雨粟，鬼夜哭');
    expect(LEGEND_SOURCE.english).toContain('wept');
    expect(LEGEND_SOURCE.citation).toContain('Commercial Press, Hong Kong, 1992');
    expect(LEGEND_SOURCE.citation).toContain('https://scholar.harvard.edu/');
  });
});
