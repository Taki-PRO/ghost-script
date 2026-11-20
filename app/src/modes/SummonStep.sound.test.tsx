import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import { SoundApiContext, type SoundApi } from '../audio/SoundProvider';
import type { SoundId } from '../audio/voices';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { learningOrder } from '../engine/learningOrder';
import { SUMMON_FADE_MS, SUMMON_HOLD_MS, SummonStep } from './SummonStep';

// hanzi-writer mock: strokes finish at once; can be told to reject or throw on create.
const h = vi.hoisted(() => ({
  strokes: [] as number[],
  chars: 0,
  rejectStroke: false,
  throwOnCreate: false,
}));

vi.mock('hanzi-writer', () => {
  const create = (el: HTMLElement) => {
    if (h.throwOnCreate) throw new Error('boom');
    el.innerHTML = '<svg><path d="M0 0"></path></svg>';
    return {
      animateCharacter: () => {
        h.chars += 1;
        return Promise.resolve();
      },
      animateStroke: (n: number) => {
        h.strokes.push(n);
        return h.rejectStroke ? Promise.reject(new Error('stroke failed')) : Promise.resolve();
      },
    };
  };
  return { default: { create } };
});

const data = realDataJson as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(data));
const order = learningOrder(dataset);
const recordsWhere = (pred: (r: CharacterRecord) => boolean): CharacterRecord[] =>
  order.map((c) => dataset.get(c)!).filter(pred);
const keyStrokesOf = (r: CharacterRecord): number[][] =>
  r.summonInk.class === 'opaque' ? [] : r.summonInk.keyStrokes;
const code = (r: CharacterRecord) => r.cangjie!;
const wrongLetter = (r: CharacterRecord, i = 0) => (code(r)[i] === 'B' ? 'C' : 'B');

const TRANSPARENT_MULTI = recordsWhere(
  (r) => r.summonInk.class === 'transparent' && (r.cangjie ?? '').length >= 2,
)[0]!;
const PARTIAL = recordsWhere((r) => r.summonInk.class === 'partial')[0]!;
const OPAQUES = recordsWhere((r) => r.summonInk.class === 'opaque' && (r.cangjie ?? '').length >= 2);
const OPAQUE = OPAQUES[0]!;
const OPAQUE_TWIN = OPAQUES.find(
  (r) => r.character !== OPAQUE.character && code(r).length === code(OPAQUE).length,
)!;

let played: SoundId[] = [];
const recordingPlay = (id: SoundId) => {
  played.push(id);
};

function api(play: (id: SoundId) => void): SoundApi {
  const noop = () => undefined;
  return {
    available: true,
    soundOn: true,
    ambienceOn: false,
    reducedMotion: false,
    play,
    setSoundOn: noop,
    setAmbienceOn: noop,
    setAmbientScreen: noop,
  };
}

function setup(
  record: CharacterRecord,
  opts: { firstMeeting?: boolean; play?: (id: SoundId) => void } = {},
) {
  const onDone = vi.fn();
  const utils = render(
    <SoundApiContext.Provider value={api(opts.play ?? recordingPlay)}>
      <SummonStep
        record={record}
        dataset={dataset}
        config={DEFAULT_CONFIG}
        onDone={onDone}
        firstMeeting={opts.firstMeeting ?? true}
      />
    </SoundApiContext.Provider>,
  );
  return { onDone, ...utils };
}

const press = (key: string) => fireEvent.keyDown(window, { key });
const flush = () => act(async () => {});
const settle = async () => {
  for (let i = 0; i < 12; i++) await flush();
};
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const status = () => screen.getByRole('status').textContent;
const screenKey = (letter: string) =>
  screen.getByRole('button', { name: new RegExp(`^Key ${letter}\\b`) });

const originalMatchMedia = window.matchMedia;
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

beforeEach(() => {
  played = [];
  h.strokes.length = 0;
  h.chars = 0;
  h.rejectStroke = false;
  h.throwOnCreate = false;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

describe('the test records', () => {
  it('are the intended real ones', () => {
    expect(code(OPAQUE).length).toBeGreaterThanOrEqual(2);
    expect(OPAQUE_TWIN.summonInk.class).toBe('opaque');
    expect(code(OPAQUE_TWIN)).toHaveLength(code(OPAQUE).length);
    expect(keyStrokesOf(TRANSPARENT_MULTI)[0]!.length).toBeGreaterThan(0);
  });
});

describe('key sounds', () => {
  it('an accepted physical key requests one key-tap', () => {
    setup(OPAQUE);
    press(code(OPAQUE)[0]!);
    expect(played).toEqual(['key-tap']);
  });

  it('a wrong physical key requests one key-wrong', () => {
    setup(OPAQUE);
    press(wrongLetter(OPAQUE));
    expect(played).toEqual(['key-wrong']);
  });

  it('on-screen keys request the same sounds', () => {
    setup(OPAQUE);
    fireEvent.click(screenKey(wrongLetter(OPAQUE)));
    expect(played).toEqual(['key-wrong']);
    fireEvent.click(screenKey(code(OPAQUE)[0]!));
    expect(played).toEqual(['key-wrong', 'key-tap']);
  });

  it('a non-letter key requests nothing', () => {
    setup(OPAQUE);
    for (const k of ['1', 'Enter', ' ', 'Escape', 'Shift']) press(k);
    expect(played).toEqual([]);
  });

  it('a key after completion requests nothing', async () => {
    setup(OPAQUE);
    for (const c of code(OPAQUE)) press(c);
    await settle();
    const before = [...played];
    press(code(OPAQUE)[0]!);
    press(wrongLetter(OPAQUE));
    expect(played).toEqual(before);
  });

  it('the last key requests one key-tap and nothing during the hold and the fade', async () => {
    const { onDone } = setup(OPAQUE);
    const letters = code(OPAQUE).split('');
    for (const c of letters) press(c);
    await settle();
    expect(played).toEqual(letters.map(() => 'key-tap'));
    advance(SUMMON_HOLD_MS);
    advance(SUMMON_FADE_MS - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(played).toEqual(letters.map(() => 'key-tap'));
  });

  it('give up requests nothing', async () => {
    setup(OPAQUE);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    expect(played).toEqual([]);
  });

  it('two characters with equally long codes request the same list', async () => {
    const run = async (r: CharacterRecord) => {
      played = [];
      const view = setup(r);
      press(wrongLetter(r));
      for (const c of code(r)) press(c);
      await settle();
      advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
      view.unmount();
      return played;
    };
    const a = await run(OPAQUE);
    const b = await run(OPAQUE_TWIN);
    expect(a).toEqual(['key-wrong', ...code(OPAQUE).split('').map(() => 'key-tap')]);
    expect(b).toEqual(a);
  });
});

describe('ink-sweep', () => {
  const sweeps = () => played.filter((p) => p === 'ink-sweep').length;

  it('plays one sweep right after the key-tap, per key-driven stroke', async () => {
    setup(TRANSPARENT_MULTI);
    press(code(TRANSPARENT_MULTI)[0]!);
    expect(played).toEqual(['key-tap']);
    await settle();
    const first = keyStrokesOf(TRANSPARENT_MULTI)[0]!;
    expect(played).toEqual(['key-tap', ...first.map(() => 'ink-sweep')]);
    expect(h.strokes).toEqual(first);
  });

  it('a wrong key plays no sweep', async () => {
    setup(TRANSPARENT_MULTI);
    press(wrongLetter(TRANSPARENT_MULTI));
    await settle();
    expect(played).toEqual(['key-wrong']);
  });

  for (const rec of [TRANSPARENT_MULTI, PARTIAL]) {
    it(`${rec.summonInk.class}: the first-meeting forming draws more strokes with no sweep`, async () => {
      setup(rec);
      for (const c of code(rec)) press(c);
      await settle();
      const keyDriven = new Set(keyStrokesOf(rec).flat()).size;
      expect(sweeps()).toBe(keyDriven);
      expect(h.strokes.length).toBe(rec.strokeCount);
      if (rec.summonInk.class === 'partial') expect(h.strokes.length).toBeGreaterThan(keyDriven);
    });
  }

  it('give up on a first meeting forms every stroke with no sweep', async () => {
    setup(PARTIAL);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await settle();
    expect(h.strokes).toHaveLength(PARTIAL.strokeCount);
    expect(played).toEqual([]);
  });

  it('a returning ghost plays one sweep per key-driven stroke and nothing more', async () => {
    setup(TRANSPARENT_MULTI, { firstMeeting: false });
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    expect(sweeps()).toBe(new Set(keyStrokesOf(TRANSPARENT_MULTI).flat()).size);
    expect(played.filter((p) => p === 'key-tap')).toHaveLength(code(TRANSPARENT_MULTI).length);
  });

  it('plays no sweep after an animation failed', async () => {
    h.rejectStroke = true;
    setup(TRANSPARENT_MULTI);
    const letters = code(TRANSPARENT_MULTI).split('');
    press(letters[0]!);
    await settle();
    for (const c of letters.slice(1)) {
      press(c);
      await settle();
    }
    expect(sweeps()).toBe(1);
    expect(played.filter((p) => p === 'key-tap')).toHaveLength(letters.length);
  });

  it('plays no sweep when the writer could not be created', async () => {
    h.throwOnCreate = true;
    setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    expect(sweeps()).toBe(0);
    expect(played.filter((p) => p === 'key-tap')).toHaveLength(code(TRANSPARENT_MULTI).length);
  });

  it('plays one sweep per stroke under reduced motion as well', async () => {
    stubReducedMotion();
    setup(TRANSPARENT_MULTI);
    for (const c of code(TRANSPARENT_MULTI)) press(c);
    await settle();
    expect(sweeps()).toBe(new Set(keyStrokesOf(TRANSPARENT_MULTI).flat()).size);
  });
});

describe('a throwing play', () => {
  async function run(play: (id: SoundId) => void) {
    h.strokes.length = 0;
    const { onDone, unmount } = setup(TRANSPARENT_MULTI, { play });
    const texts: Array<string | null> = [];
    texts.push(status());
    press(wrongLetter(TRANSPARENT_MULTI));
    texts.push(status());
    for (const c of code(TRANSPARENT_MULTI)) {
      press(c);
      texts.push(status());
      await settle();
    }
    advance(SUMMON_HOLD_MS + SUMMON_FADE_MS);
    const result = {
      texts,
      strokes: [...h.strokes],
      done: onDone.mock.calls.map((c) => c as unknown[]),
    };
    unmount();
    return result;
  }

  it('leaves the state, the status text, the ink and the onDone result unchanged', async () => {
    const quiet = await run(() => undefined);
    const throwing = await run(() => {
      throw new Error('audio broke');
    });
    expect(throwing).toEqual(quiet);
    expect(throwing.done).toEqual([['clean']]);
  });
});
