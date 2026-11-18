import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { learningOrder } from '../engine/learningOrder';
import {
  INKLESS_KEY_TEXT,
  OPAQUE_NOTE,
  SUMMON_FADE_MS,
  SUMMON_HOLD_MS,
  SUMMON_INK_SPEED,
  SUMMON_REDUCED_SPEED,
  SummonStep,
} from './SummonStep';

// ---------------------------------------------------------------------------
// hanzi-writer mock: records create options and animateStroke calls, tracks
// concurrency, and can hold strokes open (manual) or reject them.
// ---------------------------------------------------------------------------
interface CreateCall {
  el: HTMLElement;
  char: string;
  options: { showCharacter?: boolean; strokeAnimationSpeed?: number };
}

const h = vi.hoisted(() => ({
  creates: [] as unknown[],
  strokes: [] as number[],
  chars: 0,
  active: 0,
  maxActive: 0,
  manual: false,
  pending: [] as Array<() => void>,
  throwOnCreate: false,
  rejectStroke: false,
  loadError: false,
}));

vi.mock('hanzi-writer', () => {
  const create = (
    el: HTMLElement,
    char: string,
    options: { onLoadCharDataError?: (reason?: unknown) => void },
  ) => {
    if (h.throwOnCreate) throw new Error('boom');
    el.innerHTML = '<svg><path d="M0 0"></path></svg>';
    h.creates.push({ el, char, options });
    // Like hanzi-writer: the load error arrives after create has returned.
    if (h.loadError) queueMicrotask(() => options.onLoadCharDataError?.(new Error('no data')));
    return {
      animateCharacter: () => {
        h.chars += 1;
        return Promise.resolve();
      },
      animateStroke: (n: number) => {
        h.strokes.push(n);
        h.active += 1;
        h.maxActive = Math.max(h.maxActive, h.active);
        return new Promise<void>((resolve, reject) => {
          if (h.rejectStroke) {
            h.active -= 1;
            reject(new Error('stroke failed'));
            return;
          }
          const finish = () => {
            h.active -= 1;
            resolve();
          };
          if (h.manual) h.pending.push(finish);
          else finish();
        });
      },
    };
  };
  return { default: { create } };
});

const creates = () => h.creates as CreateCall[];

// ---------------------------------------------------------------------------
// Real records
// ---------------------------------------------------------------------------
const data = realDataJson as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(data));
const order = learningOrder(dataset);
const firstOf = (pred: (r: CharacterRecord) => boolean): CharacterRecord => {
  const ch = order.find((c) => pred(dataset.get(c)!));
  if (ch === undefined) throw new Error('no record found');
  return dataset.get(ch)!;
};
const keyStrokesOf = (r: CharacterRecord): number[][] =>
  r.summonInk.class === 'opaque' ? [] : r.summonInk.keyStrokes;

/** First transparent record in the learning order (一, one key). */
const TRANSPARENT = firstOf((r) => r.summonInk.class === 'transparent');
/** First transparent record with a code of two or more keys, for tests that need several keys. */
const TRANSPARENT_MULTI = firstOf(
  (r) => r.summonInk.class === 'transparent' && (r.cangjie ?? '').length >= 2,
);
/** First partial record with an Inkless_Key. */
const PARTIAL = firstOf(
  (r) => r.summonInk.class === 'partial' && keyStrokesOf(r).some((k) => k.length === 0),
);
/** First opaque record. */
const OPAQUE = firstOf((r) => r.summonInk.class === 'opaque');

const code = (r: CharacterRecord) => r.cangjie!;
const allStrokes = (r: CharacterRecord) => Array.from({ length: r.strokeCount }, (_, i) => i);
/** A letter that is not the record's next key at position `i`. */
const wrongLetter = (r: CharacterRecord, i = 0) => (code(r)[i] === 'B' ? 'C' : 'B');

function setup(record: CharacterRecord) {
  const onDone = vi.fn();
  const utils = render(
    <SummonStep record={record} dataset={dataset} config={DEFAULT_CONFIG} onDone={onDone} firstMeeting />,
  );
  return { onDone, ...utils };
}

const press = (key: string) => fireEvent.keyDown(window, { key });
const status = () => screen.getByRole('status');
const flush = () => act(async () => {});
/** Let the promise queue run to its end (many chained microtasks). */
const settle = async () => {
  for (let i = 0; i < 12; i++) await flush();
};
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const inkContainer = () => screen.getByTestId('ink-container');
const fallbackEl = () => document.querySelector('p.text-6xl');

/** Resolve held strokes one at a time until none is left. */
async function drainManual() {
  for (let guard = 0; guard < 200; guard++) {
    await settle();
    const next = h.pending.shift();
    if (!next) return;
    next();
  }
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  h.creates.length = 0;
  h.strokes.length = 0;
  h.chars = 0;
  h.pending.length = 0;
  h.active = 0;
  h.maxActive = 0;
  h.manual = false;
  h.throwOnCreate = false;
  h.rejectStroke = false;
  h.loadError = false;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

function stubReducedMotion() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('the test records', () => {
  it('are the intended real ones', () => {
    expect(TRANSPARENT.summonInk.class).toBe('transparent');
    expect(TRANSPARENT_MULTI.summonInk.class).toBe('transparent');
    expect(code(TRANSPARENT_MULTI).length).toBeGreaterThanOrEqual(2);
    expect(PARTIAL.summonInk.class).toBe('partial');
    expect(OPAQUE.summonInk.class).toBe('opaque');
    expect(code(OPAQUE).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Ink_Writer lifetime', () => {
  for (const [name, rec] of [
    ['transparent', TRANSPARENT],
    ['partial', PARTIAL],
  ] as const) {
    it(`a ${name} character creates the writer at mount with nothing shown`, () => {
      setup(rec);
      expect(creates()).toHaveLength(1);
      expect(creates()[0]!.char).toBe(rec.character);
      expect(creates()[0]!.options.showCharacter).toBe(false);
      expect(h.strokes).toEqual([]);
      expect(screen.getByTestId('ink-surface')).toBeInTheDocument();
    });
  }

  it('an opaque character creates no writer while typing, and one when forming starts', async () => {
    setup(OPAQUE);
    press(wrongLetter(OPAQUE));
    press(code(OPAQUE)[0]!);
    await settle();
    expect(creates()).toHaveLength(0);
    for (const c of code(OPAQUE).slice(1)) press(c);
    await settle();
    expect(creates()).toHaveLength(1);
    expect(h.strokes).toEqual([]);
  });
});

describe('inking per key', () => {
  for (const rec of [TRANSPARENT_MULTI, PARTIAL]) {
    it(`${rec.summonInk.class}: each correct key draws exactly its own strokes`, async () => {
      setup(rec);
      const perKey = keyStrokesOf(rec);
      const expected: number[] = [];
      const letters = code(rec).split('');
      // Stop before the last key: completing the code also forms the rest.
      for (let i = 0; i < letters.length - 1; i++) {
        press(letters[i]!);
        await settle();
        expected.push(...perKey[i]!);
        expect(h.strokes).toEqual(expected);
      }
    });
  }

  it('a wrong key draws nothing and leaves earlier ink alone', async () => {
    setup(TRANSPARENT_MULTI);
    press(wrongLetter(TRANSPARENT_MULTI));
    await settle();
    expect(h.strokes).toEqual([]);
    press(code(TRANSPARENT_MULTI)[0]!);
    await settle();
    const drawn = [...h.strokes];
    expect(drawn).toEqual(keyStrokesOf(TRANSPARENT_MULTI)[0]);
    press(wrongLetter(TRANSPARENT_MULTI, 1));
    await settle();
    expect(h.strokes).toEqual(drawn);
  });

  it('quick keys never overlap: strokes are drawn one at a time, in key order', async () => {
    h.manual = true;
    setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    // Only the first stroke has started while it is still drawing.
    expect(h.strokes).toHaveLength(1);
    await drainManual();
    expect(h.maxActive).toBe(1);
    expect(h.strokes).toEqual(keyStrokesOf(TRANSPARENT_MULTI).flat());
  });
});

describe('forming', () => {
  it('completion draws only the strokes not yet inked, in ascending order, then holds and fades', async () => {
    const { onDone } = setup(PARTIAL);
    const inked = keyStrokesOf(PARTIAL).flat();
    for (const c of code(PARTIAL)) press(c);
    await settle();
    const rest = allStrokes(PARTIAL).filter((s) => !inked.includes(s));
    expect(rest.length).toBeGreaterThan(0);
    expect(h.strokes).toEqual([...inked, ...rest]);
    expect(new Set(h.strokes).size).toBe(PARTIAL.strokeCount);

    advance(SUMMON_HOLD_MS - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).not.toHaveBeenCalled();
    advance(SUMMON_FADE_MS - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('a transparent character has nothing left to draw at completion', async () => {
    const { onDone } = setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    expect(h.strokes).toEqual(keyStrokesOf(TRANSPARENT_MULTI).flat());
    expect(new Set(h.strokes).size).toBe(TRANSPARENT_MULTI.strokeCount);
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not start the hold before the last stroke has finished drawing', async () => {
    h.manual = true;
    const { onDone } = setup(PARTIAL);
    for (const c of code(PARTIAL)) press(c);
    await settle();
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS + 100);
    expect(onDone).not.toHaveBeenCalled();
    await drainManual();
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Give up inks nothing for untyped keys and forms every undrawn stroke in ascending order', async () => {
    const { onDone } = setup(TRANSPARENT_MULTI);
    const perKey = keyStrokesOf(TRANSPARENT_MULTI);
    press(code(TRANSPARENT_MULTI)[0]!);
    await settle();
    expect(h.strokes).toEqual(perKey[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    const rest = allStrokes(TRANSPARENT_MULTI).filter((s) => !perKey[0]!.includes(s));
    expect(h.strokes).toEqual([...perKey[0]!, ...rest]);
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('gave-up');
  });

  it('Give up straight away draws every stroke once, in ascending order', async () => {
    setup(PARTIAL);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    expect(h.strokes).toEqual(allStrokes(PARTIAL));
  });
});

describe('reduced motion', () => {
  it('draws with the fast speed and skips the fade', async () => {
    setup(PARTIAL);
    const normalSpeed = creates()[0]!.options.strokeAnimationSpeed;
    expect(normalSpeed).toBe(SUMMON_INK_SPEED);
    cleanup();
    h.creates.length = 0;

    stubReducedMotion();
    const { onDone } = setup(PARTIAL);
    const reducedSpeed = creates()[0]!.options.strokeAnimationSpeed!;
    expect(reducedSpeed).toBeGreaterThan(normalSpeed!);
    for (const c of code(PARTIAL)) press(c);
    await settle();
    expect(h.strokes).toHaveLength(PARTIAL.strokeCount);
    advance(SUMMON_HOLD_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ink-surface').style.opacity).not.toBe('0');
  });
});

describe('failures lead to the text fallback', () => {
  it('create throws: keys are still accepted, nothing is inked, the fallback forms and onDone follows', async () => {
    h.throwOnCreate = true;
    const { onDone } = setup(TRANSPARENT_MULTI);
    const letters = code(TRANSPARENT_MULTI).split('');
    press(letters[0]!);
    expect(status().textContent).toContain('✓ Key accepted');
    expect(fallbackEl()).toBeNull();
    for (const c of letters.slice(1)) press(c);
    await settle();
    expect(h.strokes).toEqual([]);
    expect(fallbackEl()?.textContent).toBe(TRANSPARENT_MULTI.character);
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
    expect(fallbackEl()).toBeNull();
  });

  it('animateStroke rejects: keys are still accepted, the fallback forms and onDone follows', async () => {
    h.rejectStroke = true;
    const { onDone, container } = setup(TRANSPARENT_MULTI);
    const letters = code(TRANSPARENT_MULTI).split('');
    press(letters[0]!);
    await settle();
    expect(status().textContent).toContain('✓ Key accepted');
    expect(container.textContent).not.toContain(TRANSPARENT_MULTI.character);
    for (const c of letters.slice(1)) press(c);
    await settle();
    expect(fallbackEl()?.textContent).toBe(TRANSPARENT_MULTI.character);
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
  });
});

describe('unmount', () => {
  it('stops drawing, clears timers, empties the paper and never calls onDone', async () => {
    h.manual = true;
    const { onDone, unmount } = setup(PARTIAL);
    const container = inkContainer();
    for (const c of code(PARTIAL)) press(c);
    await settle();
    const drawnBefore = h.strokes.length;
    unmount();
    expect(container.childElementCount).toBe(0);
    await drainManual();
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS + 1000);
    await settle();
    expect(h.strokes).toHaveLength(drawnBefore);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('unmounting during the hold prevents onDone', async () => {
    const { onDone, unmount } = setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    advance(SUMMON_HOLD_MS - 1);
    unmount();
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Inkless_Key text', () => {
  it('appears for an inkless key of a partial character only, and the next key replaces it', () => {
    setup(PARTIAL);
    const perKey = keyStrokesOf(PARTIAL);
    const letters = code(PARTIAL).split('');
    expect(INKLESS_KEY_TEXT).toBe("This key's shape is one the game doesn't show yet.");
    for (let i = 0; i < letters.length; i++) {
      press(letters[i]!);
      const has = status().textContent!.includes(INKLESS_KEY_TEXT);
      expect(has).toBe(perKey[i]!.length === 0);
      expect(status().textContent).toMatch(/✓ (Key accepted|Code complete)/);
    }
  });

  it('is replaced by the next key press and not shown for a wrong key', () => {
    setup(PARTIAL);
    const letters = code(PARTIAL).split('');
    expect(keyStrokesOf(PARTIAL)[0]).toEqual([0]);
    press(letters[0]!);
    expect(status().textContent).not.toContain(INKLESS_KEY_TEXT);
    press(letters[1]!);
    expect(status().textContent).toContain(INKLESS_KEY_TEXT);
    press(wrongLetter(PARTIAL, 2));
    expect(status().textContent).not.toContain(INKLESS_KEY_TEXT);
    expect(status().textContent).toContain('✗');
    press(letters[2]!);
    expect(status().textContent).toContain('✓ Code complete');
    expect(status().textContent).toContain(INKLESS_KEY_TEXT);
  });

  for (const rec of [TRANSPARENT_MULTI, OPAQUE]) {
    it(`${rec.summonInk.class} character never shows it`, () => {
      setup(rec);
      for (const c of code(rec)) {
        press(c);
        expect(status().textContent).not.toContain(INKLESS_KEY_TEXT);
      }
    });
  }
});

describe('Opaque_Note', () => {
  const note = () => screen.queryByTestId('opaque-note');

  it('is present from mount for an opaque character, as plain static text', () => {
    setup(OPAQUE);
    expect(OPAQUE_NOTE).toBe("This code uses shapes the game doesn't show yet.");
    const el = note()!;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe(OPAQUE_NOTE);
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-live')).toBe(false);
    expect(status().contains(el)).toBe(false);
    expect(el.closest('[role]:not(section)')).toBeNull();
    expect(el.closest('[aria-live]')).toBeNull();
  });

  it('is unchanged by correct and wrong keys and adds no per-key text', () => {
    setup(OPAQUE);
    const el = note()!;
    const letters = code(OPAQUE).split('');
    press(wrongLetter(OPAQUE));
    expect(note()).toBe(el);
    expect(el.textContent).toBe(OPAQUE_NOTE);
    for (const c of letters.slice(0, -1)) {
      press(c);
      expect(note()).toBe(el);
      expect(el.textContent).toBe(OPAQUE_NOTE);
      expect(status().textContent).toBe(`✓ Key accepted · Mistakes: 1`);
      expect(status().textContent).not.toContain("doesn't show");
    }
  });

  it('is gone once forming starts, by completion or by giving up', async () => {
    setup(OPAQUE);
    for (const c of code(OPAQUE)) press(c);
    await settle();
    expect(note()).toBeNull();
    cleanup();

    setup(OPAQUE);
    expect(note()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    expect(note()).toBeNull();
  });

  for (const rec of [TRANSPARENT_MULTI, PARTIAL]) {
    it(`a ${rec.summonInk.class} character never shows it`, async () => {
      setup(rec);
      expect(note()).toBeNull();
      expect(document.body.textContent).not.toContain(OPAQUE_NOTE);
      for (const c of code(rec)) {
        press(c);
        expect(document.body.textContent).not.toContain(OPAQUE_NOTE);
      }
      await settle();
      expect(document.body.textContent).not.toContain(OPAQUE_NOTE);
    });
  }

  it('a transparent character shows neither line', () => {
    setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    expect(document.body.textContent).not.toContain(OPAQUE_NOTE);
    expect(document.body.textContent).not.toContain(INKLESS_KEY_TEXT);
  });
});

describe('the paper is empty when onDone runs', () => {
  for (const rec of [TRANSPARENT_MULTI, PARTIAL, OPAQUE]) {
    it(`${rec.summonInk.class}: no path element remains`, async () => {
      const container = { el: null as HTMLElement | null };
      const onDone = vi.fn(() => {
        container.el = inkContainer();
        expect(container.el.querySelector('path')).toBeNull();
        expect(container.el.childElementCount).toBe(0);
      });
      render(<SummonStep record={rec} dataset={dataset} config={DEFAULT_CONFIG} onDone={onDone} firstMeeting />);
      for (const c of code(rec)) press(c);
      await settle();
      advance(SUMMON_HOLD_MS);
      // During the fade the mock's path is still on the paper, so the check below is meaningful.
      expect(inkContainer().querySelector('path')).not.toBeNull();
      advance(SUMMON_FADE_MS);
      expect(onDone).toHaveBeenCalledTimes(1);
    });
  }
});

// ---------------------------------------------------------------------------
// Returning ghost: only the strokes of the accepted keys, no hold, no fade,
// no animateCharacter, no plain-text fallback.
// ---------------------------------------------------------------------------
describe('returning ghost', () => {
  /** Timers alive after mount (not ours); the step must add none. */
  let baseTimers = 0;
  function setupReturning(record: CharacterRecord) {
    const onDone = vi.fn();
    const utils = render(
      <SummonStep record={record} dataset={dataset} config={DEFAULT_CONFIG} onDone={onDone} />,
    );
    baseTimers = vi.getTimerCount();
    return { onDone, ...utils };
  }
  const typeAll = (r: CharacterRecord) => {
    for (const c of code(r)) press(c);
  };
  const noFallback = () => {
    expect(fallbackEl()).toBeNull();
    expect(document.querySelector('p[lang="zh"]')).toBeNull();
  };

  it('finishes once after the queued strokes with no timer and no animateCharacter', async () => {
    const { onDone } = setupReturning(TRANSPARENT_MULTI);
    typeAll(TRANSPARENT_MULTI);
    await settle();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
    expect(h.chars).toBe(0);
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
    expect(inkContainer().childElementCount).toBe(0);
  });

  it('draws only the strokes of the typed keys, in the order the keys were typed', async () => {
    const rec = PARTIAL;
    const { onDone } = setupReturning(rec);
    typeAll(rec);
    await settle();
    const expected = [...new Set(keyStrokesOf(rec).flat())];
    expect(h.strokes).toEqual(expected);
    expect(h.strokes.length).toBeLessThan(rec.strokeCount);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('waits for a stroke that is still drawing before it finishes', async () => {
    h.manual = true;
    const { onDone } = setupReturning(TRANSPARENT_MULTI);
    typeAll(TRANSPARENT_MULTI);
    await settle();
    expect(onDone).not.toHaveBeenCalled();
    await drainManual();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(baseTimers);
  });

  it('an opaque ghost creates no writer, calls no animation and finishes once', async () => {
    const { onDone } = setupReturning(OPAQUE);
    typeAll(OPAQUE);
    await settle();
    expect(h.creates).toHaveLength(0);
    expect(h.chars).toBe(0);
    expect(h.strokes).toEqual([]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('clean');
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('create throwing still finishes once, with nothing shown and no fallback', async () => {
    h.throwOnCreate = true;
    const { onDone } = setupReturning(TRANSPARENT_MULTI);
    typeAll(TRANSPARENT_MULTI);
    await settle();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(h.chars).toBe(0);
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('onLoadCharDataError still finishes once, with nothing shown and no fallback', async () => {
    h.loadError = true;
    const { onDone } = setupReturning(TRANSPARENT_MULTI);
    typeAll(TRANSPARENT_MULTI);
    await settle();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(h.chars).toBe(0);
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('a rejected stroke still finishes once, with nothing shown and no fallback', async () => {
    h.rejectStroke = true;
    const { onDone } = setupReturning(TRANSPARENT_MULTI);
    typeAll(TRANSPARENT_MULTI);
    await settle();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(h.chars).toBe(0);
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('Give up with zero keys draws no stroke and finishes with gave-up', async () => {
    const { onDone } = setupReturning(PARTIAL);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    expect(h.strokes).toEqual([]);
    expect(h.chars).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('gave-up');
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('Give up after one key lets that key\'s strokes finish and adds none', async () => {
    h.manual = true;
    const rec = TRANSPARENT_MULTI;
    const first = keyStrokesOf(rec)[0]!;
    expect(first.length).toBeGreaterThan(0);
    const { onDone } = setupReturning(rec);
    press(code(rec)[0]!);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await drainManual();
    expect(h.strokes).toEqual([...new Set(first)]);
    expect(h.chars).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('gave-up');
    expect(vi.getTimerCount()).toBe(baseTimers);
    noFallback();
  });

  it('reduced motion draws at SUMMON_REDUCED_SPEED and starts no timer', async () => {
    stubReducedMotion();
    expect(SUMMON_REDUCED_SPEED).toBe(1000);
    const { onDone } = setupReturning(PARTIAL);
    typeAll(PARTIAL);
    await settle();
    expect(creates()[0]!.options.strokeAnimationSpeed).toBe(SUMMON_REDUCED_SPEED);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(baseTimers);
  });
});
