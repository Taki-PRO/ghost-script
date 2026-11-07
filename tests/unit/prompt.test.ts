// Unit tests for selectPrompt and numberedToToneMarks.
//
// Fixtures are real CC-CEDICT lines copied verbatim from
// data/raw/cc-cedict/cedict_ts.u8 (release 2026-11-06). See
// tests/fixtures/README.md for provenance. No dictionary data is invented.
// Each character is parsed by parseCcCedict and the resulting CcCedictEntry is
// fed to selectPrompt, so these tests exercise the selector end-to-end against
// real data.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseCcCedict } from '../../scripts/lib/parse-cc-cedict.js';
import type { CcCedictEntry } from '../../scripts/lib/parse-cc-cedict.js';
import {
  selectPrompt,
  numberedToToneMarks,
} from '../../scripts/lib/prompt.js';
import type { PromptOverride } from '../../scripts/lib/prompt.js';

const fixturePath = fileURLToPath(
  new URL('../fixtures/cc-cedict/sample-cedict.u8', import.meta.url),
);
const sample = readFileSync(fixturePath, 'utf8');
const parsed = parseCcCedict(sample);

/** Fetch a parsed entry or fail the test loudly if the fixture lacks it. */
function entryFor(char: string): CcCedictEntry {
  const entry = parsed.get(char);
  if (entry === undefined) {
    throw new Error(`fixture missing CC-CEDICT data for ${char}`);
  }
  return entry;
}

describe('numberedToToneMarks', () => {
  it('marks the correct vowel for single syllables', () => {
    expect(numberedToToneMarks('shang3')).toBe('shǎng');
    expect(numberedToToneMarks('hao3')).toBe('hǎo');
    expect(numberedToToneMarks('wo3')).toBe('wǒ');
    expect(numberedToToneMarks('ren2')).toBe('rén');
    expect(numberedToToneMarks('kou3')).toBe('kǒu');
  });

  it('covers all four tones using the a-priority rule', () => {
    expect(numberedToToneMarks('ba1')).toBe('bā');
    expect(numberedToToneMarks('ba2')).toBe('bá');
    expect(numberedToToneMarks('ba3')).toBe('bǎ');
    expect(numberedToToneMarks('ba4')).toBe('bà');
  });

  it('drops the digit with no diacritic for the neutral tone (5)', () => {
    expect(numberedToToneMarks('le5')).toBe('le');
  });

  it('handles ü written as u: or v in CC-CEDICT', () => {
    expect(numberedToToneMarks('lu:4')).toBe('lǜ');
    expect(numberedToToneMarks('lv4')).toBe('lǜ');
  });

  it('converts each whitespace-separated syllable independently', () => {
    expect(numberedToToneMarks('pin1 yin1')).toBe('pīn yīn');
    expect(numberedToToneMarks('qi3 chuang2')).toBe('qǐ chuáng');
  });

  it('leaves a syllable with no trailing tone digit unchanged', () => {
    expect(numberedToToneMarks('r')).toBe('r');
  });
});

describe('selectPrompt — default rule (real data)', () => {
  it('三: skips the proper-noun surname entry and chooses "three" with sān', () => {
    const result = selectPrompt('三', entryFor('三'), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('three');
    expect(result.choice.pinyin).toBe('sān');
    expect(result.choice.fromOverride).toBe(false);
  });

  it('后: skips the surname entry and takes meaning + reading from the same usable entry', () => {
    const result = selectPrompt('后', entryFor('后'), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('empress');
    expect(result.choice.pinyin).toBe('hòu');
    expect(result.choice.fromOverride).toBe(false);
  });

  it('号: chooses a usable meaning (bound-form stripped), not a grammatical note', () => {
    const result = selectPrompt('号', entryFor('号'), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // First entry (hao2) first gloss is "(bound form) to wail; to howl".
    expect(result.choice.meaning).toBe('to wail; to howl');
    expect(result.choice.pinyin).toBe('háo');
    expect(result.choice.fromOverride).toBe(false);
  });

  it('了: default picks the first usable gloss, and its reading comes from the SAME entry', () => {
    // NOTE on real data: 了's first entry is le5 whose first gloss is
    // "(completed action marker)". The skipped-prefix list defined by
    // Requirement 6.4 (surname/variant of/used in/see/abbr./CL:/also pr./
    // Taiwan pr.) does NOT cover parenthesised grammatical notes, so this gloss
    // is "usable" by the spec and is chosen. The key regression guarantee — the
    // flaw being fixed — is that the reading is taken from the SAME entry as the
    // meaning (le5 → "le"), never crossed with the liao3 entry.
    const cc = entryFor('了');
    const result = selectPrompt('了', cc, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('(completed action marker)');
    expect(result.choice.entryIndex).toBe(0);
    // Same-entry guarantee: reading is that of entry 0 (le5 → neutral tone).
    expect(result.choice.pinyin).toBe('le');
    expect(result.choice.pinyin).toBe(numberedToToneMarks(cc.entries[0].reading));
    expect(result.choice.fromOverride).toBe(false);
  });

  it('了: an override can pin the liao3 entry so meaning + reading are liǎo (same entry)', () => {
    // Overrides are how a human steers 了 to the "to finish"/liǎo sense. This
    // demonstrates the meaning and reading still come from one entry.
    const cc = entryFor('了');
    // entries: [0] = le5, [1] = liao3 whose first gloss is "to finish".
    const override: PromptOverride = {
      character: '了',
      entryIndex: 1,
      meaningIndex: 0,
      reviewedBy: 'test',
    };
    const result = selectPrompt('了', cc, override);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('to finish');
    expect(result.choice.pinyin).toBe('liǎo');
    expect(result.choice.pinyin).toBe(numberedToToneMarks(cc.entries[1].reading));
    expect(result.choice.fromOverride).toBe(true);
  });

  it('中: produces a sensible meaning/pinyin pair from one entry', () => {
    const result = selectPrompt('中', entryFor('中'), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Zhong1 entry is a proper-noun reading → skipped; zhong1 entry's first
    // gloss "within; among; in" wins.
    expect(result.choice.meaning).toBe('within; among; in');
    expect(result.choice.pinyin).toBe('zhōng');
    expect(result.choice.fromOverride).toBe(false);
  });
});

describe('selectPrompt — override rule (real data)', () => {
  it('uses the override-selected entry + gloss and flags fromOverride', () => {
    const cc = entryFor('后');
    // 后 entries: [0] = Hou4 (surname), [1] = hou4 (empress/queen/...).
    // Pin the second gloss "queen" of entry index 1.
    const override: PromptOverride = {
      character: '后',
      entryIndex: 1,
      meaningIndex: 1,
      reviewedBy: 'test',
    };
    const result = selectPrompt('后', cc, override);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('queen');
    expect(result.choice.pinyin).toBe('hòu');
    expect(result.choice.entryIndex).toBe(1);
    expect(result.choice.meaningIndex).toBe(1);
    expect(result.choice.fromOverride).toBe(true);
  });

  it('strips a leading (bound form) prefix on an override-selected gloss', () => {
    const cc = entryFor('号');
    // 号 entry [0] = hao2 with first gloss "(bound form) to wail; to howl".
    const override: PromptOverride = {
      character: '号',
      entryIndex: 0,
      meaningIndex: 0,
      reviewedBy: 'test',
    };
    const result = selectPrompt('号', cc, override);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.meaning).toBe('to wail; to howl');
    expect(result.choice.pinyin).toBe('háo');
    expect(result.choice.fromOverride).toBe(true);
  });

  it('returns no-usable-sense defensively for an out-of-range override', () => {
    const cc = entryFor('后');
    const override: PromptOverride = {
      character: '后',
      entryIndex: 99,
      meaningIndex: 0,
      reviewedBy: 'test',
    };
    const result = selectPrompt('后', cc, override);
    expect(result).toEqual({ ok: false, reason: 'no-usable-sense' });
  });
});

describe('selectPrompt — failure', () => {
  it('returns no-usable-sense when every entry is proper-noun or skipped-prefix only', () => {
    const cc: CcCedictEntry = {
      pinyin: ['Wang2', 'bian4'],
      meanings: ['surname Wang', 'variant of 某[mou3]'],
      entries: [
        { reading: 'Wang2', meanings: ['surname Wang'] },
        { reading: 'bian4', meanings: ['variant of 某[mou3]'] },
      ],
    };
    const result = selectPrompt('x', cc, undefined);
    expect(result).toEqual({ ok: false, reason: 'no-usable-sense' });
  });
});

describe('selectPrompt — same-entry invariant (real data)', () => {
  const chars = ['三', '后', '号', '了', '中'];

  for (const char of chars) {
    it(`${char}: chosen pinyin and meaning both belong to the chosen entry`, () => {
      const cc = entryFor(char);
      const result = selectPrompt(char, cc, undefined);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { choice } = result;
      const chosenEntry = cc.entries[choice.entryIndex];
      expect(chosenEntry).toBeDefined();

      // pinyin is exactly the tone-mark form of the chosen entry's reading.
      expect(choice.pinyin).toBe(numberedToToneMarks(chosenEntry.reading));

      // The chosen meaning is a (possibly (bound form)-stripped) member of the
      // chosen entry's glosses.
      const stripped = chosenEntry.meanings.map((g) =>
        g.startsWith('(bound form) ')
          ? g.slice('(bound form) '.length).trim()
          : g.trim(),
      );
      expect(stripped).toContain(choice.meaning);
      expect(stripped[choice.meaningIndex]).toBe(choice.meaning);
    });
  }
});
