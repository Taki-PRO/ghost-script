import { describe, expect, it } from 'vitest';
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
      cleanupMeaning('suffix, used to form interrogative 什麼|什么[shen2 me5], what?, indefinite 這麼|这么[zhe4 me5] thus, etc'),
    ).toBe('suffix, used to form interrogative 什麼|什么, what?, indefinite 這麼|这么 thus, etc');
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
});
