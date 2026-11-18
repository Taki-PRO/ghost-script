import { describe, expect, it } from 'vitest';
import { maskTarget } from './mask';
import { cleanupMeaning } from './promptCleanup';

// Meanings are hard-coded from app/public/data/characters.json (source char noted).
describe('cleanupMeaning (Req 4.2, 4.4)', () => {
  it('removes a (CL:...) note — 山', () => {
    expect(cleanupMeaning('mountain; hill (CL:座[zuo4])')).toBe('mountain; hill');
  });

  it('removes a (CL:...) note with several classifiers — 歌', () => {
    expect(cleanupMeaning('song (CL:首[shou3],支[zhi1])')).toBe('song');
  });

  it('removes a bare CL: clause up to the next ; (synthetic: no real meaning has one)', () => {
    expect(cleanupMeaning('book; CL:本[ben3]; volume')).toBe('book; volume');
    expect(cleanupMeaning('book; CL:本[ben3]')).toBe('book');
  });

  it('removes [pin1 yin1] bracket references — 么', () => {
    expect(
      cleanupMeaning('suffix, used to form interrogative 什么[shen2 me5], what?, indefinite 这么[zhe4 me5] thus, etc'),
    ).toBe('suffix, used to form interrogative 什么, what?, indefinite 这么 thus, etc');
  });

  it('removes a bracket reference inside a kept parenthetical — 你', () => {
    expect(cleanupMeaning('you (informal, as opposed to courteous 您[nin2])')).toBe(
      'you (informal, as opposed to courteous 您)',
    );
  });

  it('removes a (e.g. ...) clause, including nested parens/quotes — 号', () => {
    expect(
      cleanupMeaning(
        '(after a numeral) number designation (e.g. 237號房間|237号房间[er4 san1 qi1 hao4 fang2 jian1] "Room 237")',
      ),
    ).toBe('(after a numeral) number designation');
  });

  it('removes a Taiwan pr. [...] note — 和', () => {
    expect(cleanupMeaning('(joining two nouns) and; together with; with (Taiwan pr. [han4])')).toBe(
      '(joining two nouns) and; together with; with',
    );
  });

  it('removes a colloquial pr. [...] note — 那', () => {
    expect(cleanupMeaning('(specifier) that; the; those (colloquial pr. [nei4])')).toBe(
      '(specifier) that; the; those',
    );
  });

  it('removes an unparenthesised "also pr. [...]" note (synthetic)', () => {
    expect(cleanupMeaning('thing; also pr. [wu4]')).toBe('thing');
  });

  it('collapses whitespace left by a removal', () => {
    expect(cleanupMeaning('a  (CL:个[ge4]) b')).toBe('a b');
    expect(cleanupMeaning('  road   (CL:條|条[tiao2])  ')).toBe('road');
  });

  it('tidies dangling separators', () => {
    expect(cleanupMeaning('road; (CL:條[tiao2])')).toBe('road');
    expect(cleanupMeaning('road, (CL:條[tiao2])')).toBe('road');
    expect(cleanupMeaning('a; (CL:个[ge4]); b')).toBe('a; b');
  });

  it('leaves an unchanged meaning byte-identical', () => {
    expect(cleanupMeaning('three')).toBe('three');
    expect(cleanupMeaning('(after a numeral) number designation')).toBe(
      '(after a numeral) number designation',
    );
  });

  it('falls back to the original when cleanup would leave nothing', () => {
    expect(cleanupMeaning('(CL:个[ge4])')).toBe('(CL:个[ge4])');
    expect(cleanupMeaning('   ')).toBe('   ');
    expect(cleanupMeaning('')).toBe('');
  });

  it('is pure and idempotent', () => {
    const raw = 'song (CL:首[shou3],支[zhi1])';
    const first = cleanupMeaning(raw);
    expect(cleanupMeaning(raw)).toBe(first);
    expect(cleanupMeaning(first)).toBe(first);
    expect(raw).toBe('song (CL:首[shou3],支[zhi1])');
  });
  describe('traditional|simplified pairs (display rule)', () => {
    const ME = 'suffix, used to form interrogative 什麼|什么[shen2 me5], what?, indefinite 這麼|这么[zhe4 me5] thus, etc';
    const HAO = '(after a numeral) number designation (e.g. 237號房間|237号房间[er4 san1 qi1 hao4 fang2 jian1] "Room 237")';

    it('drops the traditional half, then masks the target — 么', () => {
      const cleaned = cleanupMeaning(ME);
      expect(cleaned).toBe('suffix, used to form interrogative 什么, what?, indefinite 这么 thus, etc');
      expect(maskTarget(cleaned, '么')).toBe('suffix, used to form interrogative 什～, what?, indefinite 这～ thus, etc');
    });

    it('leaves the 号 meaning cleaned as before (digit after the pipe)', () => {
      expect(cleanupMeaning(HAO)).toBe('(after a numeral) number designation');
    });

    it('still cleans the (CL:條|条[tiao2]) note — 路, 道', () => {
      expect(cleanupMeaning('road (CL:條|条[tiao2])')).toBe('road');
      expect(cleanupMeaning('road; path (CL:條|条[tiao2],股[gu3])')).toBe('road; path');
    });

    it('drops the half outside a note', () => {
      expect(cleanupMeaning('road 條|条 here')).toBe('road 条 here');
    });

    it('leaves a pipe between non-Han characters, at the start or at the end', () => {
      expect(cleanupMeaning('a|b')).toBe('a|b');
      expect(cleanupMeaning('|条 x')).toBe('|条 x');
      expect(cleanupMeaning('x 條|')).toBe('x 條|');
      expect(cleanupMeaning('x 條|2')).toBe('x 條|2');
    });

    it('removes several pairs left to right', () => {
      expect(cleanupMeaning('x 條|条 and 這麼|这么 y')).toBe('x 条 and 这么 y');
    });

    it('keeps the last run of a chain', () => {
      expect(cleanupMeaning('x 一二|三四|五六 y')).toBe('x 五六 y');
    });

    it('is idempotent on each example', () => {
      for (const t of [ME, HAO, 'road (CL:條|条[tiao2])', 'a|b', '|条 x', 'x 條|', 'x 條|条 and 這麼|这么 y', 'x 一二|三四|五六 y']) {
        const once = cleanupMeaning(t);
        expect(cleanupMeaning(once)).toBe(once);
      }
    });

    it('leaves a meaning without a pipe unchanged', () => {
      expect(cleanupMeaning('three')).toBe('three');
    });
  });
});
