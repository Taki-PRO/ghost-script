import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { WALKTHROUGH_LINE_PX, summonPaperSize } from '../engine/surfaceSize';
import { contrastRatio, theme } from '../styles/theme';
import { SUMMON_FADE_MS, SUMMON_HOLD_MS, SummonStep } from './SummonStep';

// ---------------------------------------------------------------------------
// hanzi-writer mock
// ---------------------------------------------------------------------------
interface CreateCall {
  el: HTMLElement;
  char: string;
  options: { width: number; height: number };
}

const h = vi.hoisted(() => ({
  calls: [] as unknown[],
  throwOnCreate: false,
  rejectAnimate: false,
}));

vi.mock('hanzi-writer', () => {
  const create = (el: HTMLElement, char: string, options: { width: number; height: number }) => {
    if (h.throwOnCreate) throw new Error('boom');
    const svg = document.createElement('span');
    svg.setAttribute('data-testid', 'fake-svg');
    el.appendChild(svg);
    h.calls.push({ el, char, options });
    return {
      animateCharacter: () =>
        h.rejectAnimate ? Promise.reject(new Error('load failed')) : Promise.resolve(),
      animateStroke: () => Promise.resolve(),
    };
  };
  return { default: { create } };
});

const calls = () => h.calls as CreateCall[];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const data = realDataJson as unknown as Record<string, CharacterRecord>;
const WO = data['我']!; // HQI
const KOU = data['口']!; // R
const dataset: CharacterDataset = new Map(Object.entries(data));

function setup(record: CharacterRecord) {
  const onDone = vi.fn();
  const utils = render(
    <SummonStep record={record} dataset={dataset} config={DEFAULT_CONFIG} onDone={onDone} />,
  );
  return { onDone, ...utils };
}

const press = (key: string, init: Record<string, unknown> = {}) =>
  fireEvent.keyDown(window, { key, ...init });
const clickKey = (letter: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Key ${letter}`) }));
const slots = () => screen.getByRole('list', { name: 'Cangjie code' }).querySelectorAll('li');
const filledCount = () => Array.from(slots()).filter((li) => li.textContent !== '').length;
const status = () => screen.getByRole('status');
const fallbackEl = () => document.querySelector('p.text-6xl');
const surface = () => screen.getByTestId('ink-surface');
const flush = () => act(async () => {});

/** Complete the code with the physical keyboard. */
const typeCode = (code: string) => code.split('').forEach((c) => press(c));

beforeEach(() => {
  h.calls.length = 0;
  h.throwOnCreate = false;
  h.rejectAnimate = false;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SummonStep constants', () => {
  it('hold and fade are 1.5 s each', () => {
    expect(SUMMON_HOLD_MS).toBe(1500);
    expect(SUMMON_FADE_MS).toBe(1500);
  });
});

describe('SummonStep typing', () => {
  it('renders one slot per code letter', () => {
    setup(WO);
    expect(slots()).toHaveLength(WO.cangjie!.length);
    cleanup();
    setup(KOU);
    expect(slots()).toHaveLength(KOU.cangjie!.length);
  });

  it('physical keys fill slots in order, case-insensitively', () => {
    setup(WO);
    press('h');
    expect(filledCount()).toBe(1);
    press('Q');
    expect(filledCount()).toBe(2);
    expect(status().textContent).toContain('✓');
  });

  it('on-screen keys fill slots', () => {
    setup(WO);
    clickKey('H');
    clickKey('Q');
    expect(filledCount()).toBe(2);
  });

  it('a wrong key adds one mistake and leaves the slots unchanged', () => {
    setup(WO);
    press('B');
    expect(filledCount()).toBe(0);
    expect(status().textContent).toContain('✗');
    expect(status().textContent).toContain('Mistakes: 1');
    clickKey('B');
    expect(filledCount()).toBe(0);
    expect(status().textContent).toContain('Mistakes: 2');
  });

  it('mistake count is inside the polite live region with a symbol', () => {
    setup(WO);
    const el = status();
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.textContent).toContain('Mistakes: 0');
    press('B');
    expect(el.textContent).toMatch(/✗.*Mistakes: 1/);
  });

  it('ignores Z, modified keys and composing events', () => {
    setup(WO);
    press('Z');
    press('H', { ctrlKey: true });
    press('H', { metaKey: true });
    press('H', { altKey: true });
    press('H', { isComposing: true });
    press('Process');
    expect(filledCount()).toBe(0);
    expect(status().textContent).toContain('Mistakes: 0');
  });

  it('skips key events whose target is an editable element', () => {
    setup(WO);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'H' });
    expect(filledCount()).toBe(0);
    const area = document.createElement('div');
    area.setAttribute('contenteditable', 'true');
    document.body.appendChild(area);
    fireEvent.keyDown(area, { key: 'H' });
    expect(filledCount()).toBe(0);
    input.remove();
    area.remove();
  });
});

describe('SummonStep Key hint', () => {
  it('appears after 3 consecutive wrong keys, has no control, and goes when the slot is filled', () => {
    setup(WO);
    const buttonsBefore = screen.getAllByRole('button').length;
    press('B');
    press('B');
    expect(status().textContent).not.toContain('Hint');
    press('B');
    expect(status().textContent).toContain('Hint: press H');
    expect(screen.getAllByRole('button')).toHaveLength(buttonsBefore);
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
    press('H');
    expect(status().textContent).not.toContain('Hint');
  });

  it('wrong keys on different slots do not trigger the hint', () => {
    setup(WO);
    press('B');
    press('B');
    press('H');
    press('B');
    press('B');
    expect(status().textContent).not.toContain('Hint');
  });
});

describe('SummonStep results', () => {
  it('clean code gives onDone("clean") once after form, hold and fade', async () => {
    const { onDone } = setup(WO);
    // 我 is a partial character: its writer exists from mount (summon-ink).
    expect(calls()).toHaveLength(1);
    typeCode(WO.cangjie!);
    await flush();
    expect(calls()).toHaveLength(1);
    expect(calls()[0]!.char).toBe(WO.character);

    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // Fading now: the writer is still in the DOM and fully transparent target set.
    expect(surface().style.opacity).toBe('0');
    expect(calls()[0]!.el.querySelector('[data-testid="fake-svg"]')).not.toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SUMMON_FADE_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
    expect(calls()[0]!.el.childElementCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a struggled code (hint shown) gives "struggled"', async () => {
    const { onDone } = setup(WO);
    press('B');
    press('B');
    press('B');
    typeCode(WO.cangjie!);
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledWith('struggled');
  });

  it('Give up shows the full code and gives "gave-up"', async () => {
    const { onDone } = setup(WO);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    expect(filledCount()).toBe(WO.cangjie!.length);
    const text = slots()[0]!.textContent!;
    expect(text).toContain('H');
    await flush();
    expect(calls()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('gave-up');
  });

  it('17.6: Give up is present while typing and absent in the forming and fading phases', async () => {
    setup(KOU);
    expect(screen.getByRole('button', { name: 'Give up' })).toBeInTheDocument();
    typeCode(KOU.cangjie!);
    expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS);
    });
    expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SUMMON_FADE_MS);
    });
  });
  it('17.6: Give up removes itself after use and the on-screen keys are disabled', () => {
    setup(WO);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Key Q/ })).toBeDisabled();
  });
  it('ignores later keys once the step has ended', async () => {
    const { onDone } = setup(KOU);
    typeCode(KOU.cangjie!);
    press('B');
    clickKey('B');
    expect(status().textContent).toContain('Mistakes: 0');
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    press('R');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('shows a plain-text fallback when hanzi-writer throws, and still calls onDone', async () => {
    h.throwOnCreate = true;
    const { onDone } = setup(KOU);
    typeCode(KOU.cangjie!);
    await flush();
    expect(fallbackEl()?.textContent).toBe(KOU.character);
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fallbackEl()).toBeNull();
  });

  it('shows the fallback when the animation rejects, and still calls onDone', async () => {
    h.rejectAnimate = true;
    const { onDone } = setup(KOU);
    typeCode(KOU.cangjie!);
    await flush();
    expect(fallbackEl()?.textContent).toBe(KOU.character);
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
  });
});

describe('SummonStep keyboard and notes', () => {
  it('shows the IME note and the source note', () => {
    setup(WO);
    expect(screen.getByText(/turn off your system Chinese input method/i)).toBeTruthy();
    expect(screen.getByText(/Unihan kCangjie/)).toBeTruthy();
  });

  it('shows shapes on keys (and in labels) for a non-key-face target', () => {
    setup(WO);
    const a = screen.getByRole('button', { name: /^Key A/ });
    expect(a.getAttribute('aria-label')).toBe('Key A, 日');
    expect(a.textContent).toContain('日');
    expect(screen.getAllByRole('button', { name: /^Key / })).toHaveLength(25);
  });

  it('shows letters only for a key-face target', () => {
    setup(KOU);
    const a = screen.getByRole('button', { name: /^Key A/ });
    expect(a.getAttribute('aria-label')).toBe('Key A');
    expect(a.textContent).toBe('A');
    for (const b of screen.getAllByRole('button', { name: /^Key / })) {
      expect(b.textContent).toMatch(/^[A-Y]$/);
    }
  });

  it('labels a shape key with its shape when that shape is not the target', () => {
    setup(WO);
    expect(screen.getByRole('button', { name: /^Key R/ }).getAttribute('aria-label')).toBe(
      'Key R, 口',
    );
  });
});

describe('SummonStep never reveals the target before completion', () => {
  const attrs = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('*'))
      .flatMap((el) => Array.from(el.attributes).map((a) => a.value))
      .join('|');

  for (const rec of [WO, KOU]) {
    it(`${rec.character} is absent from text and attributes while typing`, () => {
      const { container } = setup(rec);
      expect(container.textContent).not.toContain(rec.character);
      expect(attrs(container)).not.toContain(rec.character);
      press('B');
      press('B');
      press('B');
      expect(container.textContent).not.toContain(rec.character);
      expect(attrs(container)).not.toContain(rec.character);
      // Ink classes create the (stroke-only) writer at mount; opaque ones only when forming.
      expect(calls()).toHaveLength(rec.summonInk.class === 'opaque' ? 0 : 1);
    });
  }
});

describe('SummonStep layout', () => {
  it('has three row groups of 10, 9 and 6 keys in order, without flex-wrap', () => {
    const { container } = setup(WO);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="group"][data-row]'));
    expect(rows.map((r) => r.querySelectorAll('button').length)).toEqual([10, 9, 6]);
    const letters = rows.map((r) =>
      Array.from(r.querySelectorAll('button'))
        .map((b) => b.getAttribute('aria-label')!.charAt(4))
        .join(''),
    );
    expect(letters).toEqual(['QWERTYUIOP', 'ASDFGHJKL', 'XCVBNM']);
    expect(container.innerHTML).not.toContain('flex-wrap');
    for (const b of container.querySelectorAll('[role="group"] button')) {
      expect(b.className).toContain('min-h-[44px]');
    }
    // The key width now comes from the `.summon-keys` class in index.css (task 24.3),
    // not from an inline `--key-w` style.
    const wrapper = rows[0]!.parentElement!;
    expect(wrapper.classList.contains('summon-keys')).toBe(true);
    expect(wrapper.style.getPropertyValue('--key-w')).toBe('');
  });

  it('keeps the surface size in every phase and never uses the hidden class', async () => {
    setup(KOU);
    const expected = `${summonPaperSize(window.innerWidth, window.innerHeight)}px`;
    const size = () => surface().style.width;
    expect(size()).toBe(expected);
    expect(surface().className).not.toContain('hidden');
    typeCode(KOU.cangjie!);
    await flush();
    expect(size()).toBe(expected);
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS);
    });
    expect(size()).toBe(expected);
  });

  describe('paper size follows the viewport', () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    afterEach(() => {
      window.innerWidth = origW;
      window.innerHeight = origH;
    });

    for (const [w, hgt] of [
      [375, 812],
      [1024, 768],
    ] as const) {
      it(`uses summonPaperSize at ${w} x ${hgt} for the surface and hanzi-writer`, async () => {
        window.innerWidth = w;
        window.innerHeight = hgt;
        const side = summonPaperSize(w, hgt);
        setup(KOU);
        expect(surface().style.width).toBe(`${side}px`);
        typeCode(KOU.cangjie!);
        await flush();
        expect(calls()).toHaveLength(1);
        expect(calls()[0]!.options.width).toBe(side);
        expect(calls()[0]!.options.height).toBe(side);
      });
    }
  });

  it('gives Give up a 44px minimum height', () => {
    setup(WO);
    expect(screen.getByRole('button', { name: 'Give up' }).className).toContain('min-h-[44px]');
  });

  it('keeps the writer container empty while typing an opaque character', () => {
    setup(KOU);
    press('B');
    expect(KOU.summonInk.class).toBe('opaque');
    expect(screen.getByTestId('ink-container').childElementCount).toBe(0);
  });

  it('puts the fallback character inside the surface wrapper', async () => {
    h.throwOnCreate = true;
    setup(KOU);
    typeCode(KOU.cangjie!);
    await flush();
    expect(surface().parentElement!.contains(fallbackEl())).toBe(true);
  });

  it('reserves 2.5rem for the status and keeps slots on one line', () => {
    setup(WO);
    expect(status().className).toContain('min-h-[2.5rem]');
    expect(status().className).toContain('text-sm');
    expect(screen.getByRole('list', { name: 'Cangjie code' }).className).toContain('flex-nowrap');
  });
});

// ---------------------------------------------------------------------------
// first-meeting
// ---------------------------------------------------------------------------
function setupFM(
  record: CharacterRecord,
  opts: { firstMeeting?: boolean; walkthroughLines?: readonly string[] } = {},
) {
  const onDone = vi.fn();
  const utils = render(
    <SummonStep
      record={record}
      dataset={dataset}
      config={DEFAULT_CONFIG}
      onDone={onDone}
      firstMeeting={opts.firstMeeting ?? true}
      walkthroughLines={opts.walkthroughLines}
    />,
  );
  return { onDone, ...utils };
}

const slotAt = (i: number) => slots()[i]!;
const keyButton = (letter: string) => screen.getByRole('button', { name: new RegExp(`^Key ${letter}`) });
const CODE = WO.cangjie!; // HQI
const LINES = ['Line one', 'Line two', 'Line three'];

describe('SummonStep first meeting: faint code', () => {
  it('shows each letter faint, hidden from assistive tech, with a named slot', () => {
    setupFM(WO);
    CODE.split('').forEach((letter, i) => {
      const li = slotAt(i);
      expect(li.getAttribute('aria-label')).toBe(`Slot ${i + 1}, type ${letter}`);
      const span = li.querySelector('span')!;
      expect(span.textContent).toBe(letter);
      expect(span.getAttribute('aria-hidden')).toBe('true');
      expect(span.className).toContain('text-muted');
    });
  });

  it('uses a dashed border on unfilled slots other than the next one', () => {
    setupFM(WO);
    expect(slotAt(0).className).not.toContain('border-dashed');
    expect(slotAt(1).className).toContain('border-dashed');
    expect(slotAt(2).className).toContain('border-dashed');
  });

  it('starts with the copy-the-letters status text', () => {
    setupFM(WO);
    expect(status().textContent).toContain('Copy the faint letters, one key at a time');
  });

  it('a filled slot shows the key letter and shape, no faint label', () => {
    setupFM(WO);
    press(CODE[0]!);
    expect(slotAt(0).getAttribute('aria-label')).toBeNull();
    expect(slotAt(0).textContent).toContain(CODE[0]!);
    expect(slotAt(1).getAttribute('aria-label')).toBe(`Slot 2, type ${CODE[1]}`);
  });

  it('removes the faint letters once the code is complete', () => {
    setupFM(WO);
    typeCode(CODE);
    for (const li of Array.from(slots())) {
      expect(li.getAttribute('aria-label')).toBeNull();
      expect(li.querySelector('[aria-hidden="true"]')).toBeNull();
    }
  });

  it('has a faint text colour that meets WCAG AA on the surface', () => {
    expect(contrastRatio(theme.muted, theme.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('SummonStep returning ghost is unchanged', () => {
  it('shows no faint letters, highlight, walkthrough line or first-meeting text', () => {
    setupFM(WO, { firstMeeting: false });
    CODE.split('').forEach((_, i) => {
      expect(slotAt(i).getAttribute('aria-label')).toBe(`Slot ${i + 1}, empty`);
      expect(slotAt(i).textContent).toBe('');
      expect(slotAt(i).getAttribute('aria-current')).toBeNull();
      expect(slotAt(i).className).not.toContain('border-dashed');
    });
    expect(status().textContent).toContain('Type the first key of the code');
    expect(status().textContent).not.toContain('Copy the faint letters');
    expect(screen.queryByTestId('walkthrough-line')).toBeNull();
    for (const b of screen.getAllByRole('button', { name: /^Key / })) {
      expect(b.getAttribute('aria-label')).not.toMatch(/, next$/);
    }
    expect(document.querySelector('.underline')).toBeNull();
  });

  it('omitting the prop behaves like firstMeeting={false}', () => {
    setup(WO);
    expect(slotAt(0).getAttribute('aria-label')).toBe('Slot 1, empty');
    expect(slotAt(0).getAttribute('aria-current')).toBeNull();
    expect(status().textContent).toContain('Type the first key of the code');
  });

  it('ignores walkthroughLines styling of the code but still shows the line', () => {
    setupFM(WO, { firstMeeting: false, walkthroughLines: LINES });
    expect(slotAt(0).getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('walkthrough-line').textContent).toBe('Line one');
  });
});

describe('SummonStep first meeting: next slot and next key highlight', () => {
  it('marks the first slot and key, and moves on after each correct key', () => {
    setupFM(WO);
    CODE.split('').forEach((letter, i) => {
      const current = Array.from(slots()).filter((li) => li.getAttribute('aria-current') === 'true');
      expect(current).toEqual([slotAt(i)]);
      expect(slotAt(i).className).toContain('ring-2');
      const nextButtons = screen
        .getAllByRole('button', { name: /^Key / })
        .filter((b) => /, next$/.test(b.getAttribute('aria-label')!));
      expect(nextButtons).toEqual([keyButton(letter)]);
      expect(nextButtons[0]!.className).toContain('ring-2');
      const glyph = nextButtons[0]!.querySelector('span')!;
      expect(glyph.className).toContain('font-bold');
      expect(glyph.className).toContain('underline');
      press(letter);
    });
  });

  it('shows no highlight once the code is complete', () => {
    setupFM(WO);
    typeCode(CODE);
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(document.querySelector('.underline')).toBeNull();
    for (const b of screen.getAllByRole('button', { name: /^Key / })) {
      expect(b.getAttribute('aria-label')).not.toMatch(/, next$/);
    }
  });

  it('shows no highlight after Give up', () => {
    setupFM(WO);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(document.querySelector('.underline')).toBeNull();
  });

  it('a key-face ghost gets a next key named "Key R, next" and a letter-only face', () => {
    setupFM(KOU);
    const r = keyButton('R');
    expect(r.getAttribute('aria-label')).toBe('Key R, next');
    expect(r.textContent).toBe('R');
  });

  it('on-screen keys advance the highlight too', () => {
    setupFM(WO);
    clickKey(CODE[0]!);
    expect(slotAt(1).getAttribute('aria-current')).toBe('true');
  });
});

describe('SummonStep first meeting: walkthrough line', () => {
  it('shows the line of the first unfilled key and advances with each key', () => {
    setupFM(WO, { walkthroughLines: LINES });
    const line = () => screen.getByTestId('walkthrough-line').textContent;
    expect(line()).toBe('Line one');
    press(CODE[0]!);
    expect(line()).toBe('Line two');
    press(CODE[1]!);
    expect(line()).toBe('Line three');
  });

  it('keeps the line while a wrong key is pressed', () => {
    setupFM(WO, { walkthroughLines: LINES });
    press('B');
    expect(screen.getByTestId('walkthrough-line').textContent).toBe('Line one');
  });

  it('empties the line once the code is complete but keeps the element', () => {
    setupFM(WO, { walkthroughLines: LINES });
    typeCode(CODE);
    expect(screen.getByTestId('walkthrough-line').textContent).toBe('');
  });

  it('renders no line element when walkthroughLines is not given', () => {
    setupFM(WO);
    expect(screen.queryByTestId('walkthrough-line')).toBeNull();
  });

  describe('reserved paper height', () => {
    const origH = window.innerHeight;
    afterEach(() => {
      window.innerHeight = origH;
    });

    it('shrinks the paper and hanzi-writer by the line height', () => {
      window.innerHeight = 768;
      const plain = summonPaperSize(window.innerWidth, 768);
      const reserved = summonPaperSize(window.innerWidth, 768, WALKTHROUGH_LINE_PX);
      expect(reserved).toBeLessThan(plain);
      setupFM(WO, { walkthroughLines: LINES });
      expect(surface().style.width).toBe(`${reserved}px`);
      expect(calls()[0]!.options.width).toBe(reserved);
    });

    it('keeps today\'s size without walkthroughLines', () => {
      window.innerHeight = 768;
      setupFM(WO);
      expect(surface().style.width).toBe(`${summonPaperSize(window.innerWidth, 768)}px`);
    });
  });
});

describe('SummonStep first meeting: mistakes, hint and clean', () => {
  it('wrong keys still count as mistakes and do not move the highlight', () => {
    setupFM(WO);
    press('B');
    clickKey('B');
    expect(status().textContent).toContain('✗');
    expect(status().textContent).toContain('Mistakes: 2');
    expect(slotAt(0).getAttribute('aria-current')).toBe('true');
  });

  it('shows the Key hint after 3 wrong keys, and not before', () => {
    setupFM(WO);
    press('B');
    press('B');
    expect(status().textContent).not.toContain('Hint');
    press('B');
    expect(status().textContent).toContain(`Hint: press ${CODE[0]}`);
    press(CODE[0]!);
    expect(status().textContent).not.toContain('Hint');
  });

  it('a first-meeting ghost typed correctly gives "clean": the faint code is not a hint', async () => {
    const { onDone } = setupFM(WO, { walkthroughLines: LINES });
    typeCode(CODE);
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('a first-meeting ghost with a Key hint gives "struggled"', async () => {
    const { onDone } = setupFM(WO);
    press('B');
    press('B');
    press('B');
    typeCode(CODE);
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledWith('struggled');
  });

  it('Give up on a first-meeting ghost gives "gave-up"', async () => {
    const { onDone } = setupFM(WO);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await flush();
    act(() => {
      vi.advanceTimersByTime(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    });
    expect(onDone).toHaveBeenCalledWith('gave-up');
  });
});

describe('SummonStep first meeting never reveals the target', () => {
  const attrs = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('*'))
      .flatMap((el) => Array.from(el.attributes).map((a) => a.value))
      .join('|');

  for (const rec of [WO, KOU]) {
    it(`${rec.character} is absent from text and attributes, including after a hint`, () => {
      const { container } = setupFM(rec, { walkthroughLines: LINES });
      expect(container.textContent).not.toContain(rec.character);
      expect(attrs(container)).not.toContain(rec.character);
      press('B');
      press('B');
      press('B');
      expect(container.textContent).not.toContain(rec.character);
      expect(attrs(container)).not.toContain(rec.character);
    });
  }
});
