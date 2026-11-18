import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import { GhostPrompt } from '../components/GhostPrompt';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { DEFAULT_CONFIG } from '../engine/config';
import { SummonStep } from './SummonStep';

// hanzi-writer is mocked with spies: no instance should render anything before the code is complete.
const mocks = vi.hoisted(() => ({
  animateCharacter: vi.fn(),
  animateStroke: vi.fn(),
  flags: { createThrows: false, loadError: false },
}));

vi.mock('hanzi-writer', () => {
  const create = (
    _container: unknown,
    _char: string,
    opts?: { onLoadCharDataError?: (reason?: unknown) => void },
  ) => {
    if (mocks.flags.createThrows) throw new Error('create failed');
    if (mocks.flags.loadError) opts?.onLoadCharDataError?.(new Error('load failed'));
    return {
      animateCharacter: mocks.animateCharacter,
      animateStroke: mocks.animateStroke,
      cancelQuiz: vi.fn(),
      quiz: vi.fn(() => Promise.resolve()),
      showCharacter: vi.fn(() => Promise.resolve()),
      hideCharacter: vi.fn(() => Promise.resolve()),
    };
  };
  return { default: { create } };
});

beforeEach(() => {
  mocks.animateCharacter.mockReset().mockImplementation(() => new Promise<void>(() => undefined));
  mocks.animateStroke.mockReset().mockImplementation(() => Promise.resolve());
  mocks.flags.createThrows = false;
  mocks.flags.loadError = false;
});

const data = realDataJson as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(data));
const playable = Object.values(data).filter((r) => isPlayableInCangjie(r.cangjie));

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');

/** Every place the character could leak: text, all attributes, document.title. */
/** Zero-opacity stroke paths are allowed (they show nothing) and are not checked. */
function isZeroOpacityPath(el: Element): boolean {
  if (el.tagName.toLowerCase() !== 'path') return false;
  const style = (el as SVGElement).style?.opacity ?? '';
  return el.getAttribute('opacity') === '0' || (style !== '' && Number(style) === 0);
}

function findLeaks(target: string): string[] {
  const leaks: string[] = [];
  if (document.title.includes(target)) leaks.push('document.title');
  for (const el of Array.from(document.querySelectorAll('*'))) {
    if (isZeroOpacityPath(el)) continue;
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes(target) || attr.name.includes(target)) {
        leaks.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`);
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent ?? '').includes(target)) leaks.push(`text: "${n.textContent}"`);
  }
  return leaks;
}

interface Variant {
  name: string;
  firstMeeting: boolean;
  withLines: boolean;
}

const VARIANTS: readonly Variant[] = [
  { name: 'returning', firstMeeting: false, withLines: false },
  { name: 'first meeting', firstMeeting: true, withLines: false },
  { name: 'first meeting with walkthrough lines', firstMeeting: true, withLines: true },
  { name: 'returning with walkthrough lines', firstMeeting: false, withLines: true },
];

function mount(record: CharacterRecord, v: Variant = VARIANTS[0]!) {
  const onDone = vi.fn();
  const lines = v.withLines
    ? record.cangjie!.split('').map((_, i) => `Walkthrough line ${i + 1}`)
    : undefined;
  render(
    <>
      <GhostPrompt record={record} />
      <SummonStep
        record={record}
        dataset={dataset}
        config={DEFAULT_CONFIG}
        onDone={onDone}
        firstMeeting={v.firstMeeting}
        walkthroughLines={lines}
      />
    </>,
  );
  return onDone;
}

describe('SummonStep + GhostPrompt never reveal the target before the code is complete', () => {
  afterEach(cleanup);

  it('covers every playable record', () => {
    expect(playable.length).toBeGreaterThan(0);
  });

  describe.each(VARIANTS)('$name', (variant) => {
    it.each(playable.map((r) => [r.character, r] as const))('%s', (_char, record) => {
      mount(record, variant);
      expect(findLeaks(record.character)).toEqual([]);

      const wrong = LETTERS.find((l) => l !== record.cangjie![0]!)!;
      for (let i = 0; i < DEFAULT_CONFIG.strokeHintAfterConsecutiveMisses; i++) {
        fireEvent.keyDown(window, { key: wrong });
      }
      expect(screen.getByRole('status').textContent).toContain('Hint: press');
      expect(findLeaks(record.character)).toEqual([]);
    });

    it.each(playable.map((r) => [r.character, r] as const))(
      '%s stays hidden after each correct key before the last',
      (_char, record) => {
        mount(record, variant);
        const code = record.cangjie!.toUpperCase();
        for (let i = 0; i < code.length - 1; i++) {
          fireEvent.keyDown(window, { key: code[i] });
          expect(findLeaks(record.character)).toEqual([]);
        }
        if (record.summonInk.class === 'opaque') {
          expect(screen.getByTestId('opaque-note').textContent).not.toContain(record.character);
        }
      },
    );
  });
});

const RETURNING = VARIANTS.filter((v) => !v.firstMeeting);
const FIRST_MEETING = VARIANTS.filter((v) => v.firstMeeting);
const CASES = playable.map((r) => [r.character, r] as const);

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function typeWholeCode(record: CharacterRecord) {
  for (const ch of record.cangjie!.toUpperCase()) fireEvent.keyDown(window, { key: ch });
}

function allowedStrokes(record: CharacterRecord): Set<number> {
  const ink = record.summonInk;
  return new Set(ink.class === 'opaque' ? [] : ink.keyStrokes.flat());
}

const SCENARIOS = [
  { name: 'normal', createThrows: false, loadError: false },
  { name: 'HanziWriter.create throws', createThrows: true, loadError: false },
  { name: 'onLoadCharDataError fires', createThrows: false, loadError: true },
] as const;

describe('returning ghost: full code typed, then 3000 ms', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe.each(RETURNING)('$name', (variant) => {
    describe.each(SCENARIOS)('$name', (scenario) => {
      it.each(CASES)('%s', async (_char, record) => {
        mocks.flags.createThrows = scenario.createThrows;
        mocks.flags.loadError = scenario.loadError;
        const onDone = mount(record, variant);
        typeWholeCode(record);
        await advance(3000);

        expect(findLeaks(record.character)).toEqual([]);
        expect(document.querySelector('p[lang="zh"]')).toBeNull();
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(mocks.animateCharacter).not.toHaveBeenCalled();
        const allowed = allowedStrokes(record);
        for (const call of mocks.animateStroke.mock.calls) {
          expect(allowed.has(call[0] as number)).toBe(true);
        }
        expect(vi.getTimerCount()).toBe(0);
      });
    });
  });
});

describe('first meeting: the plain-text fallback keeps a 1500 ms hold and a 1500 ms fade', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe.each(FIRST_MEETING)('$name', (variant) => {
    describe.each(SCENARIOS.filter((s) => s.name !== 'normal'))('$name', (scenario) => {
      it.each(CASES)('%s', async (_char, record) => {
        mocks.flags.createThrows = scenario.createThrows;
        mocks.flags.loadError = scenario.loadError;
        const onDone = mount(record, variant);
        typeWholeCode(record);
        await advance(0);

        const fallback = () => document.querySelector<HTMLElement>('p.text-6xl');
        expect(fallback()?.textContent).toBe(record.character);
        expect(fallback()?.style.opacity).toBe('1');

        await advance(1499);
        expect(fallback()?.style.opacity).toBe('1');
        expect(onDone).not.toHaveBeenCalled();

        await advance(1);
        expect(fallback()?.style.opacity).toBe('0');
        expect(onDone).not.toHaveBeenCalled();

        await advance(1499);
        expect(onDone).not.toHaveBeenCalled();
        await advance(1);
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(fallback()).toBeNull();
      });
    });
  });
});
