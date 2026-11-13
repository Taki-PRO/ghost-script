import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG, type EngineConfig } from '../engine/config';
import { isHintTriggered, resolveCompletion, surfaceSize, WriteMode } from './WriteMode';

// ---------------------------------------------------------------------------
// hanzi-writer mock
// ---------------------------------------------------------------------------
interface QuizOpts {
  showHintAfterMisses: number;
  onMistake: (d: { mistakesOnStroke: number; totalMistakes: number }) => void;
  onCorrectStroke: (d: Record<string, unknown>) => void;
  onComplete: (d: { totalMistakes: number }) => void;
}
interface CreateOpts {
  showCharacter: boolean;
  showOutline: boolean;
  charDataLoader: unknown;
  onLoadCharDataError: (e?: unknown) => void;
}
interface FakeWriter {
  quiz: ReturnType<typeof vi.fn>;
  cancelQuiz: ReturnType<typeof vi.fn>;
  animateCharacter: ReturnType<typeof vi.fn>;
  showCharacter: ReturnType<typeof vi.fn>;
  hideCharacter: ReturnType<typeof vi.fn>;
  quizOpts?: QuizOpts;
}
interface CreateCall {
  el: HTMLElement;
  char: string;
  opts: CreateOpts;
  writer: FakeWriter;
}

const h = vi.hoisted(() => ({
  log: [] as string[],
  calls: [] as unknown[],
  throwOnCreate: false,
  /** Per-test override of what animateCharacter does after logging (default: resolve). */
  animateImpl: null as null | (() => Promise<void>),
}));

vi.mock('hanzi-writer', () => {
  const create = (el: HTMLElement, char: string, opts: unknown) => {
    if (h.throwOnCreate) throw new Error('boom');
    const writer: Record<string, unknown> = {};
    writer.quiz = vi.fn((q: unknown) => {
      writer.quizOpts = q;
      return Promise.resolve();
    });
    writer.cancelQuiz = vi.fn(() => {
      h.log.push('cancelQuiz');
    });
    writer.animateCharacter = vi.fn(() => {
      h.log.push('animateCharacter');
      return h.animateImpl ? h.animateImpl() : Promise.resolve();
    });
    writer.showCharacter = vi.fn(() => Promise.resolve());
    writer.hideCharacter = vi.fn(() => Promise.resolve());
    h.calls.push({ el, char, opts, writer });
    return writer;
  };
  return { default: { create } };
});

const calls = () => h.calls as CreateCall[];
const lastCall = () => calls()[calls().length - 1]!;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const data = realDataJson as unknown as Record<string, CharacterRecord>;
const WO = data['我']!;
const KOU = data['口']!;
const dataset: CharacterDataset = new Map(Object.entries(data));

const cfg = (over: Partial<EngineConfig>): EngineConfig => ({ ...DEFAULT_CONFIG, ...over });

function setup(config: EngineConfig = DEFAULT_CONFIG, record: CharacterRecord = WO) {
  const onOutcome = vi.fn((o: string) => {
    h.log.push(`outcome:${o}`);
  });
  const ui = (r: CharacterRecord) => (
    <WriteMode record={r} dataset={dataset} config={config} onOutcome={onOutcome} />
  );
  const view = render(ui(record));
  return { onOutcome, view, ui };
}
const quiz = () => lastCall().writer.quizOpts!;
const mistake = (mistakesOnStroke: number, totalMistakes = 0) =>
  act(() => quiz().onMistake({ mistakesOnStroke, totalMistakes }));
const complete = (totalMistakes = 0) => act(() => quiz().onComplete({ totalMistakes }));

function expectOnce(fn: ReturnType<typeof vi.fn>, arg: string) {
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(arg);
}

afterEach(cleanup);

beforeEach(() => {
  h.log.length = 0;
  h.calls.length = 0;
  h.throwOnCreate = false;
  h.animateImpl = null;
});

// ---------------------------------------------------------------------------
describe('WriteMode setup (Req 5.1, 5.2)', () => {
  it('5.1 creates the writer with hidden character/outline and the dataset loader', () => {
    setup();
    expect(calls()).toHaveLength(1);
    const c = lastCall();
    expect(c.char).toBe(WO.character);
    expect(typeof c.opts.charDataLoader).toBe('function');
    expect(c.opts.showCharacter).toBe(false);
    expect(c.opts.showOutline).toBe(false);
  });

  it('5.2 surface has touch-action none and an accessible name; character is not in the DOM', () => {
    const { view } = setup();
    const surface = screen.getByRole('group', { name: /writing area/i });
    expect(surface).toHaveStyle({ touchAction: 'none' });
    expect(surface.getAttribute('style')).toMatch(/touch-action:\s*none/);
    expect(view.container.textContent).not.toContain(WO.character);
    expect(view.container.innerHTML).not.toContain(WO.character);
  });

  it('passes strokeHintAfterConsecutiveMisses to quiz as showHintAfterMisses', () => {
    setup(cfg({ strokeHintAfterConsecutiveMisses: 4 }));
    expect(quiz().showHintAfterMisses).toBe(4);
    expect(lastCall().writer.quiz).toHaveBeenCalledTimes(1);
  });
});

describe('WriteMode feedback (Req 5.3)', () => {
  it('counts mistakes only on onMistake, not on onCorrectStroke', () => {
    setup();
    expect(screen.getByText('Mistakes: 0')).toBeInTheDocument();
    act(() => quiz().onCorrectStroke({}));
    expect(screen.getByText('Mistakes: 0')).toBeInTheDocument();
    mistake(1);
    mistake(1);
    expect(screen.getByText('Mistakes: 2')).toBeInTheDocument();
    act(() => quiz().onCorrectStroke({}));
    expect(screen.getByText('Mistakes: 2')).toBeInTheDocument();
  });

  it('shows reject and accept feedback with icon and text in role=status', () => {
    setup();
    const status = screen.getByRole('status');
    mistake(1);
    expect(status).toHaveTextContent(/✗.*try again/i);
    act(() => quiz().onCorrectStroke({}));
    expect(status).toHaveTextContent(/✓.*accepted/i);
  });
});

describe('WriteMode outcomes (Req 5.4-5.8)', () => {
  it('5.5 clean with zero mistakes, reported once', () => {
    const { onOutcome } = setup();
    complete(0);
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith('clean');
  });

  it('5.5 clean at exactly the threshold on different strokes', () => {
    const { onOutcome } = setup();
    mistake(1);
    mistake(1);
    complete(2);
    expectOnce(onOutcome, 'clean');
  });

  it('5.6 struggled when mistakes exceed the threshold (no hint)', () => {
    const { onOutcome } = setup();
    mistake(1);
    mistake(1);
    mistake(1);
    expect(screen.getByRole('status').textContent).not.toMatch(/hint/i);
    complete(3);
    expectOnce(onOutcome, 'struggled');
  });

  it('5.4/5.6 struggled when a hint was shown even if mistakes are under the threshold', () => {
    const { onOutcome } = setup(cfg({ cleanMistakeThreshold: 10 }));
    mistake(1);
    mistake(2);
    mistake(3);
    expect(screen.getByRole('status')).toHaveTextContent(/hint/i);
    complete(3);
    expectOnce(onOutcome, 'struggled');
  });

  it('5.4 boundary: two misses on one stroke show no hint and stay clean', () => {
    const { onOutcome } = setup(cfg({ cleanMistakeThreshold: 10 }));
    mistake(1);
    mistake(2);
    expect(screen.getByRole('status').textContent).not.toMatch(/hint/i);
    complete(2);
    expectOnce(onOutcome, 'clean');
  });

  it('5.8 custom config: threshold 0 makes one mistake struggled', () => {
    const { onOutcome } = setup(cfg({ strokeHintAfterConsecutiveMisses: 2, cleanMistakeThreshold: 0 }));
    mistake(1);
    complete(1);
    expectOnce(onOutcome, 'struggled');
  });

  it('5.8 custom config: hint shown at mistakesOnStroke 2', () => {
    setup(cfg({ strokeHintAfterConsecutiveMisses: 2, cleanMistakeThreshold: 0 }));
    mistake(1);
    expect(screen.getByRole('status').textContent).not.toMatch(/hint/i);
    mistake(2);
    expect(screen.getByRole('status')).toHaveTextContent(/hint/i);
  });

  it('reveals the character and shows a result message after clean and struggled', () => {
    setup();
    complete(0);
    expect(lastCall().writer.showCharacter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/laid to rest/i);
  });

  it('reveals the character after struggled with a distinct message', () => {
    setup();
    mistake(1);
    mistake(1);
    mistake(1);
    complete(3);
    expect(lastCall().writer.showCharacter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/return soon/i);
  });

  it('does not advance or recreate the writer by itself after resolving', () => {
    const { onOutcome } = setup();
    complete(0);
    expect(calls()).toHaveLength(1);
    expect(onOutcome).toHaveBeenCalledTimes(1);
  });
});

describe('WriteMode give up (Req 5.7)', () => {
  it('cancels the quiz, then animates, then reports gave-up; button disables', async () => {
    const user = userEvent.setup();
    const { onOutcome } = setup();
    const btn = screen.getByRole('button', { name: 'Give up' });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(h.log).toEqual(['cancelQuiz', 'animateCharacter', 'outcome:gave-up']);
    expectOnce(onOutcome, 'gave-up');
    expect(btn).toBeDisabled();
  });
});

describe('WriteMode give up when the reveal animation fails (Req 5.7, 3.4)', () => {
  const unhandled: unknown[] = [];
  const onNode = (reason: unknown) => {
    unhandled.push(reason);
  };
  const onWindow = (e: Event) => {
    unhandled.push(e);
  };

  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', onNode);
    window.addEventListener('unhandledrejection', onWindow);
  });
  afterEach(() => {
    process.removeListener('unhandledRejection', onNode);
    window.removeEventListener('unhandledrejection', onWindow);
    h.animateImpl = null;
  });

  const flush = () =>
    act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

  const failures: Array<[string, () => Promise<void>]> = [
    ['rejects', () => Promise.reject(new Error('animation failed'))],
    [
      'throws synchronously',
      () => {
        throw new Error('animation threw');
      },
    ],
  ];

  for (const [label, impl] of failures) {
    it(`records gave-up exactly once and raises no unhandled rejection when animateCharacter ${label}`, async () => {
      h.animateImpl = impl;
      const user = userEvent.setup();
      const { onOutcome } = setup();
      const btn = screen.getByRole('button', { name: 'Give up' });
      await user.click(btn);
      await flush();

      expect(h.log).toEqual(['cancelQuiz', 'animateCharacter', 'outcome:gave-up']);
      expectOnce(onOutcome, 'gave-up');
      expect(btn).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('The ghost reveals itself');
      expect(unhandled).toEqual([]);
    });

    it(`late onComplete/onMistake after a failed animation (${label}) add no outcome`, async () => {
      h.animateImpl = impl;
      const user = userEvent.setup();
      const { onOutcome } = setup();
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await flush();
      complete(0);
      mistake(1);
      complete(3);
      await flush();
      expectOnce(onOutcome, 'gave-up');
      expect(h.log.filter((e) => e.startsWith('outcome:'))).toEqual(['outcome:gave-up']);
      expect(screen.getByText('Mistakes: 0')).toBeInTheDocument();
      expect(unhandled).toEqual([]);
    });
  }
});

describe('WriteMode exactly-once (Req 3.4)', () => {
  it('ignores a second completion and later mistakes after clean', () => {
    const { onOutcome } = setup();
    complete(0);
    complete(0);
    mistake(1);
    mistake(2);
    mistake(3);
    complete(5);
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith('clean');
  });

  it('a late onComplete after give-up does not produce another outcome', async () => {
    const user = userEvent.setup();
    const { onOutcome } = setup();
    await user.click(screen.getByRole('button', { name: 'Give up' }));
    complete(0);
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith('gave-up');
    expect(h.log.filter((e) => e.startsWith('outcome:'))).toEqual(['outcome:gave-up']);
  });

  it('clicking Give up after a clean resolution does nothing', async () => {
    const user = userEvent.setup();
    const { onOutcome } = setup();
    complete(0);
    const btn = screen.getByRole('button', { name: 'Give up' });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expectOnce(onOutcome, 'clean');
    expect(h.log).not.toContain('animateCharacter');
  });
});

describe('WriteMode lifecycle', () => {
  it('changing record cancels the old writer, recreates, resets, and resolves the new record', () => {
    const { onOutcome, view, ui } = setup();
    const first = lastCall();
    mistake(1);
    expect(screen.getByText('Mistakes: 1')).toBeInTheDocument();
    view.rerender(ui(KOU));
    expect(first.writer.cancelQuiz).toHaveBeenCalled();
    expect(calls()).toHaveLength(2);
    expect(lastCall().char).toBe(KOU.character);
    expect(screen.getByText('Mistakes: 0')).toBeInTheDocument();
    complete(0);
    expectOnce(onOutcome, 'clean');
  });

  it('unmount cancels the quiz', () => {
    const { view } = setup();
    const w = lastCall().writer;
    view.unmount();
    expect(w.cancelQuiz).toHaveBeenCalled();
  });
});

describe('WriteMode failure', () => {
  it('onLoadCharDataError shows a message and reports gave-up once', () => {
    const { onOutcome } = setup();
    act(() => lastCall().opts.onLoadCharDataError(new Error('x')));
    act(() => lastCall().opts.onLoadCharDataError(new Error('x')));
    expect(screen.getByRole('status')).toHaveTextContent(/could not be summoned/i);
    expectOnce(onOutcome, 'gave-up');
  });

  it('create throwing is handled without crashing', () => {
    h.throwOnCreate = true;
    const { onOutcome } = setup();
    expect(screen.getByRole('status')).toHaveTextContent(/could not be summoned/i);
    expectOnce(onOutcome, 'gave-up');
  });
});

describe('pure helpers', () => {
  it('resolveCompletion boundaries with default config', () => {
    expect(resolveCompletion(false, 0, DEFAULT_CONFIG)).toBe('clean');
    expect(resolveCompletion(false, 2, DEFAULT_CONFIG)).toBe('clean');
    expect(resolveCompletion(false, 3, DEFAULT_CONFIG)).toBe('struggled');
    expect(resolveCompletion(true, 0, DEFAULT_CONFIG)).toBe('struggled');
  });

  it('resolveCompletion honours a custom threshold', () => {
    expect(resolveCompletion(false, 0, cfg({ cleanMistakeThreshold: 0 }))).toBe('clean');
    expect(resolveCompletion(false, 1, cfg({ cleanMistakeThreshold: 0 }))).toBe('struggled');
    expect(resolveCompletion(false, 5, cfg({ cleanMistakeThreshold: 5 }))).toBe('clean');
  });

  it('isHintTriggered boundaries', () => {
    expect(isHintTriggered(2, DEFAULT_CONFIG)).toBe(false);
    expect(isHintTriggered(3, DEFAULT_CONFIG)).toBe(true);
    const c = cfg({ strokeHintAfterConsecutiveMisses: 2 });
    expect(isHintTriggered(1, c)).toBe(false);
    expect(isHintTriggered(2, c)).toBe(true);
  });

  it('surfaceSize clamps to 420 and scales to 80% of the viewport', () => {
    expect(surfaceSize(375)).toBe(300);
    expect(surfaceSize(1440)).toBe(420);
  });
});
