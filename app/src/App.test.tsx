import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharacterRecord } from './data/types';
import type { CharacterDataset } from './data/charDataLoader';
import { DEFAULT_CONFIG } from './engine/config';
import { learningOrder } from './engine/learningOrder';
import { pickWalkthroughGhost } from './engine/walkthrough';
import { applyReview, type Outcome, type ReviewHistory } from './engine/scheduler';
import { getIntroSeen, loadState, STORAGE_KEY } from './storage/storage';
import raw from '../public/data/characters.json';

const stub = vi.hoisted(() => ({
  props: [] as Array<{ record: { character: string; strokeCount: number }; onOutcome: (o: Outcome) => void }>,
  summon: null as null | {
    record: { character: string };
    onDone: (o: Outcome) => void;
    firstMeeting?: boolean;
    walkthroughLines?: readonly string[];
  },
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
    SummonStep: (props: {
      record: { character: string };
      onDone: (o: Outcome) => void;
      firstMeeting?: boolean;
      walkthroughLines?: readonly string[];
    }) => {
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

/** First visit: the legend leads straight to the first ghost (no forced guide). */
async function beginFirstVisit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^begin the séance$/i }));
}

const walkthroughChar = () => pickWalkthroughGhost(learningOrder(dataset), dataset)!;

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
    expect(screen.queryByRole('heading', { name: /how cangjie works/i })).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cangjieIntroSeen).toBe(false);
    expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
  });

  describe('6.12: first-ever session in Learning order', () => {
    it('buildSession on empty history returns the first 10 in Learning order', () => {
      const order = learningOrder(dataset);
      const ghosts = buildSession(dataset, {}, T, DEFAULT_CONFIG).map((r) => r.character);
      expect(ghosts).toEqual(order.slice(0, 10));
      expect(ghosts[0]).toBe('一');
    });

    it('presents transparent characters first, by ascending strokeCount', async () => {
      const user = await openApp();
      await beginFirstVisit(user);
      const presented = await playSeance(user, Array<Outcome>(10).fill('clean'));
      const walk = walkthroughChar();
      expect(presented).toHaveLength(10);
      expect(presented[0]).toBe(walk);
      expect(presented.slice(1)).toEqual(
        learningOrder(dataset)
          .slice(0, 10)
          .filter((c) => c !== walk)
          .slice(0, 9),
      );
      const rest = presented.slice(1).map((c) => all[c]!.strokeCount);
      for (let i = 0; i < rest.length - 1; i++) expect(rest[i]!).toBeLessThanOrEqual(rest[i + 1]!);
      for (const c of presented) expect(all[c]!.summonInk.class).toBe('transparent');
    });
  });

  it('3.4, 7.6: outcomes persist immediately, before pressing Next', async () => {
    const user = await openApp();
    await beginFirstVisit(user);
    emit('clean');
    const walk = walkthroughChar();
    expect(loadState().history[walk]).toEqual(applyReview(undefined, 'clean', T, DEFAULT_CONFIG));
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
    const met = new Set(first);
    const fresh = learningOrder(dataset)
      .filter((c) => !met.has(c))
      .slice(0, 10);
    expect(lastProps().record.character).toBe(fresh[0]);
    expect(buildSession(dataset, loadState().history, T, DEFAULT_CONFIG).map((r) => r.character)).toEqual(fresh);

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

    it('returning visit, guide unseen: no guide before the séance, which starts directly', async () => {
      seed({ introSeen: true, cangjieIntroSeen: false });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      expect(screen.queryByRole('heading', { name: /how cangjie works/i })).toBeNull();
      expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cangjieIntroSeen).toBe(false);
    });

    it('the guide stays on the menu and Continue still writes cangjieIntroSeen', async () => {
      seed({ introSeen: true, cangjieIntroSeen: false });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /how cangjie works/i }));
      await user.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cangjieIntroSeen).toBe(true);
      expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
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

  describe('Graveyard and Credits views', () => {
    it('Menu -> Graveyard -> Back returns to the menu', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /^graveyard$/i }));
      expect(screen.getByRole('heading', { name: /^graveyard$/i })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /back to menu/i }));
      expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
    });

    it('Menu -> Credits -> Back returns to the menu', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: 'Sources & licences' }));
      expect(screen.getByRole('heading', { name: 'Sources & licences' })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /back to menu/i }));
      expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
    });

    it('Leave séance -> Leave returns to the menu, keeping ghost 1 and not ghost 2', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      const first = stub.summon!.record.character;
      emit('clean');
      await user.click(await screen.findByRole('button', { name: /next ghost/i }));
      const second = stub.summon!.record.character;
      finishSummon();
      await user.click(screen.getByRole('button', { name: /leave séance/i }));
      await user.click(screen.getByRole('button', { name: /^leave$/i }));
      expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
      const history = loadState().history;
      expect(Object.keys(history)).toContain(first);
      expect(Object.keys(history)).not.toContain(second);
    });

    it('Leave séance -> Stay keeps the séance on screen', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      await user.click(screen.getByRole('button', { name: /leave séance/i }));
      await user.click(screen.getByRole('button', { name: /^stay$/i }));
      expect(screen.getByText('Ghost 1 of 10')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /begin a nightly séance/i })).toBeNull();
    });

    it('18.2b, 18.2c: with a throwing setItem the Leave prompt says progress is not saved', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('disabled');
      });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      emit('clean');
      await user.click(await screen.findByRole('button', { name: /leave séance/i }));
      expect(
        screen.getByRole('group', {
          name: "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost.",
        }),
      ).toBeTruthy();
    });
    it('18.2a, 18.2d: a failed write for ghost 1 keeps the not-saving text after ghost 2 saves', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const realSetItem = Storage.prototype.setItem;
      let calls = 0;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        k: string,
        v: string,
      ) {
        calls += 1;
        if (calls === 1) throw new Error('quota');
        realSetItem.call(this, k, v);
      });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      const first = stub.summon!.record.character;
      emit('clean');
      await user.click(await screen.findByRole('button', { name: /next ghost/i }));
      const second = stub.summon!.record.character;
      emit('clean');
      expect(Object.keys(loadState().history)).toEqual([second]); // ghost 1 was never persisted
      expect(Object.keys(loadState().history)).not.toContain(first);
      await user.click(await screen.findByRole('button', { name: /leave séance/i }));
      expect(
        screen.getByRole('group', {
          name: "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost.",
        }),
      ).toBeTruthy();
    });
    it('18.2c: on a first visit with a throwing setItem, the Leave prompt before any outcome says progress is not saved', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('disabled');
      });
      const user = await openApp();
      await beginFirstVisit(user);
      await user.click(await screen.findByRole('button', { name: /leave séance/i }));
      expect(
        screen.getByRole('group', {
          name: "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost.",
        }),
      ).toBeTruthy();
    });
    it('after one recorded outcome only that character shows a glyph', async () => {
      seed({ introSeen: true, cangjieIntroSeen: true });
      const user = await openApp();
      await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
      const first = stub.summon!.record.character;
      emit('clean');
      cleanup();
      await openApp();
      await user.click(await screen.findByRole('button', { name: /^graveyard$/i }));
      const graves = screen.getByRole('list', { name: 'Graves' });
      const glyphs = graves.querySelectorAll('[lang="zh"]');
      expect(glyphs).toHaveLength(1);
      expect(glyphs[0]!.textContent).toBe(first);
      expect(graves.querySelectorAll('li')).toHaveLength(dataset.size);
    });
  });
});

describe('screen-change scroll reset and compact séance shell', () => {
  const home = () => seed({ introSeen: true, cangjieIntroSeen: true });
  const spyScroll = () => vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const mainOf = () => document.querySelector('main')!;

  it('scrolls to (0, 0) on menu -> Graveyard and Graveyard -> menu', async () => {
    home();
    const scroll = spyScroll();
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /^graveyard$/i }));
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
    const afterOpen = scroll.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /back to menu/i }));
    expect(scroll.mock.calls.length).toBeGreaterThan(afterOpen);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
  });

  it('scrolls to (0, 0) on menu -> Sources & licences', async () => {
    home();
    const scroll = spyScroll();
    const user = await openApp();
    const before = (await screen.findByRole('button', { name: 'Sources & licences' }), scroll.mock.calls.length);
    await user.click(screen.getByRole('button', { name: 'Sources & licences' }));
    expect(scroll.mock.calls.length).toBeGreaterThan(before);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
  });

  it('scrolls on menu -> séance, and the séance shell is compact while the menu is not', async () => {
    home();
    const scroll = spyScroll();
    const user = await openApp();
    const button = await screen.findByRole('button', { name: /begin a nightly séance/i });
    expect(mainOf().className).toContain('px-4');
    const before = scroll.mock.calls.length;
    await user.click(button);
    expect(scroll.mock.calls.length).toBeGreaterThan(before);
    expect(scroll).toHaveBeenCalledWith(0, 0);
    expect(mainOf().className).toContain('px-2');
    expect(mainOf().className).not.toContain('px-4');
  });

  it('scrolls on séance -> menu via Leave', async () => {
    home();
    const scroll = spyScroll();
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    await user.click(screen.getByRole('button', { name: /leave séance/i }));
    const before = scroll.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(screen.getByRole('button', { name: /begin a nightly séance/i })).toBeTruthy();
    expect(scroll.mock.calls.length).toBeGreaterThan(before);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
  });

  it('scrolls when the summary screen opens and when "Begin another Séance" leaves it', async () => {
    home();
    const scroll = spyScroll();
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    const beforeSummary = scroll.mock.calls.length;
    await playSeance(user, Array<Outcome>(10).fill('clean'));
    expect(scroll.mock.calls.length).toBeGreaterThan(beforeSummary);
    const beforeAgain = scroll.mock.calls.length;
    await user.click(await screen.findByRole('button', { name: /begin another séance/i }));
    expect(scroll.mock.calls.length).toBeGreaterThan(beforeAgain);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
  });
});

describe('first meeting: walkthrough, first-meeting set and return rows', () => {
  const home = () => seed({ introSeen: true, cangjieIntroSeen: true });

  it('an empty history starts with the walkthrough ghost; ten ghosts, no duplicate', async () => {
    home();
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    expect(stub.summon!.record.character).toBe(walkthroughChar());
    expect(stub.summon!.walkthroughLines?.length).toBeGreaterThan(0);
    const presented = await playSeance(user, Array<Outcome>(10).fill('clean'));
    expect(presented[0]).toBe(walkthroughChar());
    expect(presented).toHaveLength(10);
    expect(new Set(presented).size).toBe(10);
  });

  it('an empty history with failing storage still starts with the walkthrough ghost', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    const user = await openApp();
    await beginFirstVisit(user);
    expect(stub.summon!.record.character).toBe(walkthroughChar());
    expect(stub.summon!.firstMeeting).toBe(true);
  });

  it('a returning player gets the normal session with no walkthrough', async () => {
    const order = learningOrder(dataset);
    const history: ReviewHistory = { [order[0]!]: { step: 1, nextDue: 0, lastOutcome: 'clean' } };
    seed({ introSeen: true, cangjieIntroSeen: true, history });
    const expected = buildSession(dataset, history, T, DEFAULT_CONFIG).map((r) => r.character);
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    const seen: Array<string | undefined> = [];
    const presented: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      presented.push(stub.summon!.record.character);
      seen.push(stub.summon!.walkthroughLines?.join('|'));
      emit('clean');
      await user.click(
        await screen.findByRole('button', { name: i === expected.length - 1 ? /finish/i : /next ghost/i }),
      );
    }
    expect(presented).toEqual(expected);
    expect(seen.every((x) => x === undefined)).toBe(true);
  });

  it('passes the first-meeting set: saved ghosts are returning, new ones are first meetings', async () => {
    const order = learningOrder(dataset);
    const history: ReviewHistory = { [order[0]!]: { step: 1, nextDue: 0, lastOutcome: 'clean' } };
    seed({ introSeen: true, cangjieIntroSeen: true, history });
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    expect(stub.summon!.record.character).toBe(order[0]);
    expect(stub.summon!.firstMeeting).toBe(false);
    emit('clean');
    await user.click(await screen.findByRole('button', { name: /next ghost/i }));
    expect(stub.summon!.record.character).not.toBe(order[0]);
    expect(stub.summon!.firstMeeting).toBe(true);
  });

  it('the summary lists a return row for every ghost', async () => {
    home();
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    const outcomes = Array<Outcome>(10).fill('clean');
    outcomes[3] = 'gave-up';
    const presented = await playSeance(user, outcomes);
    const list = await screen.findByRole('list', { name: 'Ghosts that will return' });
    const rows = list.querySelectorAll('li');
    expect(rows).toHaveLength(10);
    expect(Array.from(rows).map((li) => li.querySelector('[lang="zh"]')?.textContent)).toEqual(presented);
    expect(rows[3]!.textContent).toMatch(/returns in 10 minutes/);
    for (const li of rows) expect(li.textContent).toMatch(/returns/);
  });
});
