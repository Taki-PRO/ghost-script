import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharacterRecord } from './data/types';
import type { CharacterDataset } from './data/charDataLoader';
import { DEFAULT_CONFIG } from './engine/config';
import { learningOrder } from './engine/learningOrder';
import { applyReview, type Outcome } from './engine/scheduler';
import { getIntroSeen, loadState, STORAGE_KEY } from './storage/storage';
import raw from '../public/data/characters.json';

const stub = vi.hoisted(() => ({
  props: [] as Array<{ record: { character: string; strokeCount: number }; onOutcome: (o: Outcome) => void }>,
  summon: null as null | { record: { character: string }; onDone: (o: Outcome) => void },
}));

vi.mock('./modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: {
      record: { character: string; strokeCount: number };
      onOutcome: (o: Outcome) => void;
    }) => {
      stub.props.push(props);
      return React.createElement('div', { 'data-testid': 'write-stub' });
    },
  };
});

vi.mock('./modes/SummonStep', async () => {
  const React = await import('react');
  return {
    SummonStep: (props: { record: { character: string }; onDone: (o: Outcome) => void }) => {
      React.useEffect(() => {
        stub.summon = props;
        return () => {
          stub.summon = null;
        };
      });
      return React.createElement('div', { 'data-testid': 'summon-stub' });
    },
  };
});

import App, { buildSession } from './App';

const all = raw as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(all));
const T = 1_700_000_000_000;
const MIN = 60 * 1000;

const lastProps = () => stub.props[stub.props.length - 1]!;
/** End the stubbed Summon step if one is showing. */
const finishSummon = (o: Outcome = 'clean') => {
  const s = stub.summon;
  if (s) act(() => s.onDone(o));
};
/** Report the Lay-to-rest result; a clean Summon leaves the combined outcome equal to it. */
const emit = (o: Outcome, summon: Outcome = 'clean') => {
  finishSummon(summon);
  act(() => lastProps().onOutcome(o));
};

function seed(state: { introSeen: boolean; cangjieIntroSeen: boolean; history?: object }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 2, history: {}, ...state }),
  );
}

/** First visit: legend, then the Cangjie guide, then the first ghost. */
async function beginFirstVisit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^begin the séance$/i }));
  await user.click(await screen.findByRole('button', { name: /^continue$/i }));
}

function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(raw) })),
  );
}

async function openApp() {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

/** Play every ghost of the current séance; returns the characters presented. */
async function playSeance(user: ReturnType<typeof userEvent.setup>, outcomes: Outcome[]) {
  const presented: string[] = [];
  for (let i = 0; i < outcomes.length; i++) {
    finishSummon();
    presented.push(lastProps().record.character);
    emit(outcomes[i]!);
    const last = i === outcomes.length - 1;
    await user.click(
      await screen.findByRole('button', { name: last ? /finish the séance/i : /next ghost/i }),
    );
  }
  return presented;
}

beforeEach(() => {
  stub.props = [];
  stub.summon = null;
  localStorage.clear();
  mockFetchOk();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('App integration', () => {
  it('1.1: shows loading, then the intro on first visit', async () => {
    render(<App />);
    expect(screen.getByRole('status').textContent).toMatch(/summoning/i);
    expect(await screen.findByRole('button', { name: /begin the séance/i })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('2.4: error screen', () => {
    const cases: Array<[string, () => void]> = [
      ['fetch rejects', () => vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('net'))))],
      ['ok:false', () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })))],
      [
        'invalid JSON',
        () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'not json {' }))),
      ],
      [
        'invalid shape',
        () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '{"一":{}}' }))),
      ],
    ];
    for (const [name, setupFetch] of cases) {
      it(`renders a non-technical error when ${name}`, async () => {
        setupFetch();
        render(<App />);
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toMatch(/could not be summoned/i);
        expect(document.body.textContent).not.toMatch(/parse|fetch|json|invalid-shape/i);
        expect(screen.queryByRole('button')).toBeNull();
      });
    }
  });

  it('1.4: Begin persists introSeen and shows Ghost 1 of 10', async () => {
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin the séance/i }));
    expect(getIntroSeen()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).introSeen).toBe(true);
    expect(screen.getByRole('heading', { name: /how cangjie works/i })).toBeTruthy();
    expect(screen.queryByText('Ghost 1 of 10')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cangjieIntroSeen).toBe(true);
    expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
  });

  describe('6.12: first-ever session in Learning order', () => {
    it('buildSession on empty history returns the first 10 in Learning order', () => {
      const order = learningOrder(dataset);
      const ghosts = buildSession(dataset, {}, T, DEFAULT_CONFIG).map((r) => r.character);
      expect(ghosts).toEqual(order.slice(0, 10));
      expect(ghosts[0]).toBe('一');
    });

    it('presents the lowest-strokeCount characters, ascending', async () => {
      const user = await openApp();
      await beginFirstVisit(user);
      const presented = await playSeance(user, Array<Outcome>(10).fill('clean'));
      expect(presented).toHaveLength(10);
      expect(presented[0]).toBe('一');
      expect(presented).toEqual(learningOrder(dataset).slice(0, 10));
      const counts = presented.map((c) => all[c]!.strokeCount);
      for (let i = 0; i < counts.length - 1; i++) expect(counts[i]!).toBeLessThanOrEqual(counts[i + 1]!);
      const rest = [...dataset.keys()].filter((c) => !presented.includes(c));
      expect(Math.max(...counts)).toBeLessThanOrEqual(Math.min(...rest.map((c) => all[c]!.strokeCount)));
    });
  });

  it('3.4, 7.6: outcomes persist immediately, before pressing Next', async () => {
    const user = await openApp();
    await beginFirstVisit(user);
    emit('clean');
    expect(loadState().history['一']).toEqual(applyReview(undefined, 'clean', T, DEFAULT_CONFIG));
    expect(screen.getByRole('button', { name: /next ghost/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /next ghost/i }));
    finishSummon();
    const second = lastProps().record.character;
    emit('gave-up');
    const entry = loadState().history[second]!;
    expect(entry.step).toBe(0);
    expect(entry.nextDue).toBe(T + 10 * MIN);
    expect(entry.lastOutcome).toBe('gave-up');
  });

  it('3.3, 3.6: full session -> summary -> play again reflects updated history', async () => {
    const user = await openApp();
    await beginFirstVisit(user);
    const outcomes: Outcome[] = [
      'clean', 'clean', 'clean', 'clean', 'clean', 'clean',
      'struggled', 'struggled', 'gave-up', 'gave-up',
    ];
    const first = await playSeance(user, outcomes);
    expect(await screen.findByText('8 of 10 ghosts laid to rest')).toBeTruthy();
    const missed = first.slice(6);

    // Same clock: missed ghosts are not due yet, so a fresh session is all-new.
    await user.click(screen.getByRole('button', { name: /begin another séance/i }));
    expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
    finishSummon();
    const sameClock = stub.props.length;
    expect(sameClock).toBeGreaterThan(0);
    const order = learningOrder(dataset);
    expect(lastProps().record.character).toBe(order[10]);
    expect(buildSession(dataset, loadState().history, T, DEFAULT_CONFIG).map((r) => r.character)).toEqual(
      order.slice(10, 20),
    );

    // Advance 11 minutes: missed ghosts become due and come first.
    cleanup();
    stub.props = [];
    vi.setSystemTime(T + 11 * MIN);
    const user2 = await openApp();
    await user2.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    const presented: string[] = [];
    for (let i = 0; i < 4; i++) {
      finishSummon();
      presented.push(lastProps().record.character);
      emit('clean');
      await user2.click(await screen.findByRole('button', { name: /next ghost/i }));
    }
    expect(presented).toEqual(missed);
  });

  it('1.5: returning visitor sees the menu; legend re-readable, absent during séance', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, introSeen: true, cangjieIntroSeen: true, history: {} }),
    );
    const user = await openApp();
    const start = await screen.findByRole('button', { name: /begin a nightly séance/i });
    expect(screen.queryByRole('button', { name: /^begin the séance$/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /read the legend again/i }));
    expect(screen.getByRole('button', { name: /^begin the séance$/i })).toBeTruthy();
    cleanup();

    await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    expect(start).toBeTruthy();
    expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /legend/i })).toBeNull();
  });

  it('storage disabled: app still loads and a séance can be played', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    const user = await openApp();
    await beginFirstVisit(user);
    expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
    const presented = await playSeance(user, Array<Outcome>(10).fill('clean'));
    expect(presented).toHaveLength(10);
    expect(await screen.findByText('10 of 10 ghosts laid to rest')).toBeTruthy();
  });

  describe('6.1-6.3, 7.2, 7.4: Cangjie guide flow', () => {
    it('returning visit, guide seen: menu, and Begin starts a séance directly', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      expect(screen.queryByRole('heading', { name: /how cangjie works/i })).toBeNull();
      expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
    });

    it('returning visit, guide unseen: the guide comes first, Continue starts the séance', async () => {
      seed({ introSeen: true, cangjieIntroSeen: false });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      expect(screen.getByRole('heading', { name: /how cangjie works/i })).toBeTruthy();
      expect(screen.queryByText('Ghost 1 of 10')).toBeNull();
      await user.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cangjieIntroSeen).toBe(true);
    });

    it('"How Cangjie works" shows the guide and Continue returns to the menu', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /how cangjie works/i }));
      expect(screen.getByRole('heading', { name: /how cangjie works/i })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
      expect(screen.queryByText('Ghost 1 of 10')).toBeNull();
    });
  });

  it('8.3, 9.4: one Combined outcome per ghost reaches the saved history once', async () => {
    seed({ introSeen: true, cangjieIntroSeen: true });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));

    // Summon struggled + write clean -> struggled, saved once.
    const first = stub.summon!.record.character;
    finishSummon('struggled');
    const writesBefore = setItem.mock.calls.length;
    act(() => lastProps().onOutcome('clean'));
    expect(setItem.mock.calls.length - writesBefore).toBe(1);
    expect(loadState().history[first]).toEqual(applyReview(undefined, 'struggled', T, DEFAULT_CONFIG));
    await user.click(await screen.findByRole('button', { name: /next ghost/i }));

    // Summon clean + write gave-up -> gave-up.
    const second = stub.summon!.record.character;
    emit('gave-up', 'clean');
    expect(loadState().history[second]).toEqual(applyReview(undefined, 'gave-up', T, DEFAULT_CONFIG));
    await user.click(await screen.findByRole('button', { name: /next ghost/i }));

    // Both clean -> clean.
    const third = stub.summon!.record.character;
    emit('clean', 'clean');
    expect(loadState().history[third]).toEqual(applyReview(undefined, 'clean', T, DEFAULT_CONFIG));
    expect(Object.keys(loadState().history)).toEqual([first, second, third]);
  });

  it('7.4: a version-1 saved blob resets to the legend intro and an empty history', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        introSeen: true,
        history: { 一: { step: 2, nextDue: T + MIN, lastOutcome: 'clean' } },
      }),
    );
    await openApp();
    expect(await screen.findByRole('button', { name: /^begin the séance$/i })).toBeTruthy();
    expect(loadState().history).toEqual({});
    expect(getIntroSeen()).toBe(false);
  });
});
