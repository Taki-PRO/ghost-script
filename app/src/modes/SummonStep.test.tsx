import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { summonPaperSize } from '../engine/surfaceSize';
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
