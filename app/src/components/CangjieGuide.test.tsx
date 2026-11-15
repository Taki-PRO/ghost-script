import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { CANGJIE_KEYS } from '../engine/cangjie';
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
    const items = screen.getByRole('list', { name: 'The 25 Cangjie keys' }).querySelectorAll('li');
    expect(items).toHaveLength(25);
    expect(CANGJIE_KEYS).toHaveLength(25);
    CANGJIE_KEYS.forEach(({ key, shape }, i) => {
      expect(items[i].textContent).toBe(`${key}${shape}`);
    });
    const x = CANGJIE_KEYS.find((k) => k.key === 'X');
    expect(x?.shape).toBe('難');
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

describe('CangjieGuide example (Req 6.8)', () => {
  it('shows the real dataset record\'s code for the picked character', () => {
    renderGuide();
    const picked = pickGuideExample(realDataset);
    expect(picked).not.toBeNull();
    expect(picked?.code).toBe(realDataset.get(picked!.character)?.cangjie);
    expect(picked).toEqual({ character: '七', code: 'JU' });
    const example = screen.getByTestId('guide-example');
    expect(example.textContent).toContain(picked!.character);
    expect(example.textContent).toContain(picked!.code);
  });

  it('omits the example when none is eligible', () => {
    const dataset = makeDataset([['乂', 2, 'X']]);
    render(<CangjieGuide dataset={dataset} onContinue={() => {}} />);
    expect(screen.queryByTestId('guide-example')).toBeNull();
  });
});

describe('pickGuideExample', () => {
  it('picks the first eligible in learning order', () => {
    const dataset = makeDataset([
      ['乙', 5, 'ND'],
      ['一', 1, 'M'],
      ['二', 2, 'MM'],
      ['十', 2, 'J'],
    ]);
    expect(pickGuideExample(dataset)).toEqual({ character: '二', code: 'MM' });
  });

  it('skips single-key and X-prefixed codes, and null codes', () => {
    const dataset = makeDataset([
      ['一', 1, 'M'],
      ['丶', 1, null],
      ['乂', 2, 'XK'],
      ['人', 2, 'O'],
      ['大', 3, 'KO'],
    ]);
    expect(pickGuideExample(dataset)).toEqual({ character: '大', code: 'KO' });
  });

  it('returns null when none is eligible', () => {
    expect(pickGuideExample(makeDataset([['一', 1, 'M'], ['乂', 2, 'XK']]))).toBeNull();
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
