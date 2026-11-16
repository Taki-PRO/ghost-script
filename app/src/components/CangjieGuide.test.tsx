import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { CANGJIE_KEYS } from '../engine/cangjie';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { learningOrder } from '../engine/learningOrder';
import { CangjieGuide, pickGuideExample } from './CangjieGuide';
import raw from '../../public/data/characters.json';

const realDataset: CharacterDataset = new Map(
  Object.entries(raw as unknown as Record<string, CharacterRecord>),
);

/** Minimal real-shaped record: only the fields the guide reads are meaningful. */
function fake(strokeCount: number, cangjie: string | null): CharacterRecord {
  return { strokeCount, cangjie } as unknown as CharacterRecord;
}

function makeDataset(entries: [string, number, string | null][]): CharacterDataset {
  return new Map(entries.map(([ch, n, code]) => [ch, fake(n, code)]));
}

afterEach(cleanup);

function renderGuide(onContinue: () => void = () => {}) {
  return render(<CangjieGuide dataset={realDataset} onContinue={onContinue} />);
}

describe('CangjieGuide keys (Req 6.4)', () => {
  it('lists all 25 keys with their shapes, X as 難', () => {
    renderGuide();
    const items = screen.getByRole('list', { name: 'The 25 keys in this game' }).querySelectorAll('li');
    expect(items).toHaveLength(25);
    expect(CANGJIE_KEYS).toHaveLength(25);
    CANGJIE_KEYS.forEach(({ key, shape }, i) => {
      expect(items[i].textContent).toBe(`${key}${shape}`);
    });
    const x = CANGJIE_KEYS.find((k) => k.key === 'X');
    expect(x?.shape).toBe('難');
  });
});

describe('CangjieGuide wording (Req 10)', () => {
  it('says the rules are about this game and labels the key list with a visible heading', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).toContain('In this game, a code is one to five keys');
    const heading = screen.getByRole('heading', { name: 'The 25 keys in this game' });
    expect(heading.textContent).toBe('The 25 keys in this game');
    expect(screen.getByRole('list', { name: 'The 25 keys in this game' })).toBeTruthy();
  });

  it('no longer contains the old sentence or the old list label', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).not.toContain('A code is one to five keys');
    expect(text).not.toContain('The 25 Cangjie keys');
    expect(screen.queryByRole('list', { name: 'The 25 Cangjie keys' })).toBeNull();
    expect(container.querySelector('[aria-label="The 25 Cangjie keys"]')).toBeNull();
  });
});

describe('CangjieGuide history claims (Req 6.5, 9.4)', () => {
  it('states the four whitelisted claims', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).toContain('developed in the 1970s by Chu Bong-Foo');
    expect(text).toContain('named after Cangjie, the legendary inventor of Chinese writing');
    expect(text).toContain('first Chinese input method to use the standard QWERTY keyboard');
    expect(text).toContain('released to the public in 1982');
  });

  it('has no other year, no statistic and no "dying" wording', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    const years = text.match(/\b\d{4}s?\b/g) ?? [];
    expect([...years].sort()).toEqual(['1970s', '1982']);
    expect(text).not.toMatch(/1976/);
    expect(text).not.toMatch(/\d\s*%|percent/i);
    expect(text).not.toMatch(/\b(dead|dying|obsolete|extinct)\b/i);
    expect(text).not.toMatch(/\b(millions?|thousands?)\b/i);
  });
});

describe('CangjieGuide sources (Req 6.6, 6.7)', () => {
  it('states the Unihan source and that it is provisional', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).toContain('Unihan');
    expect(text).toContain('kCangjie');
    expect(text).toMatch(/provisional/i);
  });

  it('shows both citations with titles and URLs as text', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).toContain('Cangjie input method');
    expect(text).toContain('https://en.wikipedia.org/wiki/Cangjie_input_method');
    expect(text).toContain('Chu Bong-Foo');
    expect(text).toContain('https://en.wikipedia.org/wiki/Chu_Bong-Foo');
  });
});

describe('CangjieGuide family-of-shapes statement (Req 6.9)', () => {
  it('states the family-of-shapes sentence, covered by the citation line naming "Cangjie input method"', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).toContain(
      'Each key stands for a family of related shapes. Only the base shape of the family is shown on the key.',
    );
    expect(text).toMatch(
      /Sources for the statements about keys, shapes and history above \(English Wikipedia\):.*“Cangjie input method”.*“Chu Bong-Foo”/,
    );
  });

  it('has no "difficult" or "no base shape" text', () => {
    const { container } = renderGuide();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/difficult/i);
    expect(text).not.toMatch(/no base shape/i);
  });
});

describe('CangjieGuide example (Req 6.8)', () => {
  it('shows the code of the record for the last eligible character in the real dataset', () => {
    renderGuide();
    const order = learningOrder(realDataset);
    const expected = [...order].reverse().find((ch) => {
      const code = realDataset.get(ch)?.cangjie ?? null;
      return code !== null && isPlayableInCangjie(code) && (code.length === 2 || code.length === 3);
    });
    expect(expected).toBeDefined();
    const picked = pickGuideExample(realDataset);
    expect(picked).not.toBeNull();
    expect(picked?.character).toBe(expected);
    expect(picked?.code).toBe(realDataset.get(expected!)?.cangjie);
    const example = screen.getByTestId('guide-example');
    expect(example.textContent).toContain(picked!.character);
    expect(example.textContent).toContain(picked!.code);
  });

  it('is not among the first 30 characters of the Learning order (Answer_Leak)', () => {
    const picked = pickGuideExample(realDataset);
    expect(picked).not.toBeNull();
    const index = learningOrder(realDataset).indexOf(picked!.character);
    expect(index).toBeGreaterThanOrEqual(30);
  });

  it('is 想 with DUP on the current dataset', () => {
    expect(pickGuideExample(realDataset)).toEqual({ character: '想', code: 'DUP' });
  });

  it('omits the example when none is eligible', () => {
    const dataset = makeDataset([['乂', 2, 'X']]);
    render(<CangjieGuide dataset={dataset} onContinue={() => {}} />);
    expect(screen.queryByTestId('guide-example')).toBeNull();
  });
});

describe('pickGuideExample', () => {
  it('picks the last eligible in learning order', () => {
    const dataset = makeDataset([
      ['乙', 5, 'ND'],
      ['一', 1, 'M'],
      ['二', 2, 'MM'],
      ['十', 2, 'J'],
    ]);
    expect(pickGuideExample(dataset)).toEqual({ character: '乙', code: 'ND' });
  });

  it('skips 1-key, 4-key, 5-key, X-prefixed and null codes', () => {
    const dataset = makeDataset([
      ['大', 3, 'KO'],
      ['一', 4, 'M'],
      ['丶', 5, null],
      ['乂', 6, 'XK'],
      ['人', 7, 'OIAB'],
      ['天', 8, 'OIABC'],
    ]);
    expect(pickGuideExample(dataset)).toEqual({ character: '大', code: 'KO' });
  });

  it('accepts a 3-key code', () => {
    const dataset = makeDataset([
      ['二', 2, 'MM'],
      ['想', 13, 'DUP'],
    ]);
    expect(pickGuideExample(dataset)).toEqual({ character: '想', code: 'DUP' });
  });

  it('returns null when none is eligible and for an empty dataset', () => {
    expect(
      pickGuideExample(
        makeDataset([
          ['一', 1, 'M'],
          ['乂', 2, 'XK'],
          ['丶', 3, null],
          ['人', 4, 'OIAB'],
          ['天', 5, 'OIABC'],
        ]),
      ),
    ).toBeNull();
    expect(pickGuideExample(new Map())).toBeNull();
  });
});

describe('CangjieGuide Continue', () => {
  it('calls onContinue when pressed', () => {
    const onContinue = vi.fn();
    renderGuide(onContinue);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
