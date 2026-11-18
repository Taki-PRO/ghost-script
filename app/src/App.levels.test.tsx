import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharacterRecord } from './data/types';
import type { CharacterDataset } from './data/charDataLoader';
import { DEFAULT_CONFIG } from './engine/config';
import { learningOrder } from './engine/learningOrder';
import { crossLevelLine } from './engine/crossLevel';
import type { Outcome, ReviewHistory } from './engine/scheduler';
import { loadState, STORAGE_KEY } from './storage/storage';
import level1Raw from '../public/data/characters.json';
import level2Raw from '../public/data/characters-level2.json';
import level3Raw from '../public/data/characters-level3.json';
import manifestRaw from '../public/data/levels.json';

const stub = vi.hoisted(() => ({
  props: [] as Array<{ record: { character: string }; onOutcome: (o: Outcome) => void }>,
  summon: null as null | { record: { character: string }; onDone: (o: Outcome) => void },
}));

vi.mock('./modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: { record: { character: string }; onOutcome: (o: Outcome) => void }) => {
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

import App, { planSeance, type SeanceScope } from './App';

const toSet = (raw: unknown): CharacterDataset =>
  new Map(Object.entries(raw as Record<string, CharacterRecord>));
const data = { 1: toSet(level1Raw), 2: toSet(level2Raw), 3: toSet(level3Raw) } as const;
const T = 1_700_000_000_000;

let failing: Set<string>;
let requested: string[];

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(url);
      if ([...failing].some((f) => url.includes(f))) return { ok: false, text: async () => '' };
      const body = url.includes('characters-level2')
        ? level2Raw
        : url.includes('characters-level3')
          ? level3Raw
          : url.includes('levels.json')
            ? manifestRaw
            : level1Raw;
      return { ok: true, text: async () => JSON.stringify(body) };
    }),
  );
}

function seedV3(state: { level: 1 | 2 | 3; history?: ReviewHistory }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 3,
      introSeen: true,
      cangjieIntroSeen: true,
      levelChosen: true,
      history: {},
      ...state,
    }),
  );
}

const entry = { step: 1, nextDue: T + 10 * 86_400_000, lastOutcome: 'clean' } as const;
const historyOf = (chars: Iterable<string>): ReviewHistory =>
  Object.fromEntries([...chars].map((c) => [c, { ...entry }]));

const finishSummon = (o: Outcome = 'clean') => {
  const s = stub.summon;
  if (s) act(() => s.onDone(o));
};

/** Play `count` ghosts cleanly; returns the characters presented. */
async function play(user: ReturnType<typeof userEvent.setup>, count: number) {
  const presented: string[] = [];
  for (let i = 0; i < count; i++) {
    finishSummon();
    presented.push(stub.props[stub.props.length - 1]!.record.character);
    act(() => stub.props[stub.props.length - 1]!.onOutcome('clean'));
    const last = i === count - 1;
    await user.click(
      await screen.findByRole('button', { name: last ? /finish the séance/i : /next ghost/i }),
    );
  }
  return presented;
}

beforeEach(() => {
  stub.props = [];
  stub.summon = null;
  failing = new Set();
  requested = [];
  localStorage.clear();
  stubFetch();
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

describe('App levels', () => {
  for (const level of [1, 2, 3] as const) {
    it(`first run at level ${level}: guided first ghost, the rest from the chosen level`, async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: /^begin the séance$/i }));
      await user.click(await screen.findByRole('button', { name: new RegExp(`^level ${level}`, 'i') }));
      expect(await screen.findByText('Ghost 1 of 10')).toBeTruthy();
      const presented = await play(user, 10);
      expect(presented[0]).toBe('明');
      for (const ch of presented.slice(1)) expect(data[level].has(ch)).toBe(true);
      expect(loadState().level).toBe(level);
      expect(loadState().levelChosen).toBe(true);
    });
  }

  it('level 2 with three due level 1 ghosts: the line shows above ghost 1 only, not on the summary', async () => {
    const dueChars = [...data[1].keys()].filter((c) => c !== '明').slice(0, 3);
    seedV3({
      level: 2,
      history: Object.fromEntries(dueChars.map((c) => [c, { step: 0, nextDue: T - 1, lastOutcome: 'struggled' as const }])),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^begin a nightly séance$/i }));
    expect(await screen.findByText('Ghost 1 of 10')).toBeTruthy();
    const line = () => screen.queryByTestId('cross-level-line');
    expect(line()?.textContent).toBe('3 ghosts from level 1 return first.');
    finishSummon();
    act(() => stub.props[stub.props.length - 1]!.onOutcome('clean'));
    expect(line()?.textContent).toBe('3 ghosts from level 1 return first.');
    await user.click(await screen.findByRole('button', { name: /next ghost/i }));
    expect(await screen.findByText('Ghost 2 of 10')).toBeTruthy();
    expect(line()).toBeNull();
    await play(user, 9);
    expect(await screen.findByRole('button', { name: /begin another séance/i })).toBeTruthy();
    expect(line()).toBeNull();
    expect(screen.queryByText(/return first\./)).toBeNull();
  });

  it('a brand-new player at level 2 starts with the guided ghost and sees no line', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^begin the séance$/i }));
    await user.click(await screen.findByRole('button', { name: /^level 2/i }));
    expect(await screen.findByText('Ghost 1 of 10')).toBeTruthy();
    expect(screen.queryByTestId('cross-level-line')).toBeNull();
  });

  it('loads a saved level 2 at start-up and shows it on the menu', async () => {
    seedV3({ level: 2 });
    render(<App />);
    expect(await screen.findByText('Starting level: 2')).toBeTruthy();
    expect(requested.some((u) => u.includes('characters-level2'))).toBe(true);
    expect(requested.some((u) => u.includes('levels.json'))).toBe(false);
  });

  it('loads level 3 at start-up when the history holds a level 3 ghost and the level is 1', async () => {
    const level3Char = [...data[3].keys()][0]!;
    seedV3({ level: 1, history: historyOf([level3Char]) });
    render(<App />);
    await screen.findByText('Starting level: 1');
    expect(requested.some((u) => u.includes('characters-level3'))).toBe(true);
    // Trial loading: level 2 is tried before level 3 (design, start-up load plan).
    expect(requested.some((u) => u.includes('characters-level2'))).toBe(true);
  });

  it('shows the error screen when a saved level fails to load at start-up', async () => {
    seedV3({ level: 2 });
    failing.add('characters-level2');
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be summoned/i);
  });

  it('changing level from the menu keeps the history and returns to the menu', async () => {
    const history = historyOf([[...data[1].keys()][0]!]);
    seedV3({ level: 1, history });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /starting level: 1/i }));
    expect(requested.some((u) => u.includes('levels.json'))).toBe(true);
    await user.click(await screen.findByRole('button', { name: /^level 2/i }));
    expect(await screen.findByText('Starting level: 2')).toBeTruthy();
    expect(loadState().level).toBe(2);
    expect(loadState().history).toEqual(history);
  });

  it('a failed level load shows an alert and keeps the saved level', async () => {
    seedV3({ level: 1 });
    failing.add('characters-level3');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /starting level: 1/i }));
    await user.click(await screen.findByRole('button', { name: /^level 3/i }));
    expect((await screen.findByText(/level 3 could not be loaded/i)).getAttribute('role')).toBe('alert');
    expect(loadState().level).toBe(1);
  });

  it('a finished level 1 shows the notice and a move-on slip that sets level 2', async () => {
    seedV3({ level: 1, history: historyOf(data[1].keys()) });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('You have met every ghost of level 1.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move on to level 2' }));
    expect(await screen.findByText('Starting level: 2')).toBeTruthy();
    expect(loadState().level).toBe(2);
    expect(screen.queryByText('You have met every ghost of level 1.')).toBeNull();
  });

  it('a finished level 3 shows the line and no move-on slip', async () => {
    seedV3({ level: 3, history: historyOf(data[3].keys()) });
    render(<App />);
    expect(await screen.findByText('You have met every ghost of level 3.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /move on to level/i })).toBeNull();
  });

  it('the Graveyard switches level and loads it on demand', async () => {
    seedV3({ level: 1 });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^graveyard$/i }));
    await user.click(screen.getByRole('button', { name: /level 2/i }));
    expect(await screen.findByLabelText(/Ghost 1 of 400, never met/)).toBeTruthy();
    expect(requested.some((u) => u.includes('characters-level2'))).toBe(true);
  });
});

describe('planSeance with a scope', () => {
  const merged: CharacterDataset = new Map([...data[1], ...data[2], ...data[3]]);
  const scopeFor = (level: 1 | 2 | 3): SeanceScope => ({
    chosenOrder: learningOrder(data[level]),
    otherOrders: ([1, 2, 3] as const).filter((l) => l !== level).map((l) => learningOrder(data[l])),
    walkthrough: { order: learningOrder(data[1]), dataset: data[1] },
    chosenLevel: level,
    levelOf: new Map(([1, 2, 3] as const).flatMap((l) => [...data[l].keys()].map((c): [string, 1 | 2 | 3] => [c, l]))),
  });

  it('level 1 brand-new player gets the same session as without a scope', () => {
    const plain = planSeance(data[1], {}, T, DEFAULT_CONFIG);
    const scoped = planSeance(merged, {}, T, DEFAULT_CONFIG, scopeFor(1));
    expect(scoped.ghosts.map((g) => g.character)).toEqual(plain.ghosts.map((g) => g.character));
    expect(scoped.walkthroughChar).toBe(plain.walkthroughChar);
  });

  it('a level 2 pool keeps due level 1 ghosts and leaves never-met other levels out', () => {
    const dueChar = [...data[1].keys()].find((c) => c !== '明')!;
    const history: ReviewHistory = { [dueChar]: { step: 0, nextDue: T - 1, lastOutcome: 'struggled' } };
    const plan = planSeance(merged, history, T, DEFAULT_CONFIG, scopeFor(2));
    const chars = plan.ghosts.map((g) => g.character);
    expect(chars).toContain(dueChar);
    for (const c of chars.filter((c) => c !== dueChar)) expect(data[2].has(c)).toBe(true);
  });

  it('reports the level and due flag of each planned ghost: three due level 1 entries, level 2 chosen', () => {
    const dueChars = [...data[1].keys()].filter((c) => c !== '明').slice(0, 3);
    const history: ReviewHistory = Object.fromEntries(
      dueChars.map((c) => [c, { step: 0, nextDue: T - 1, lastOutcome: 'struggled' as const }]),
    );
    const plan = planSeance(merged, history, T, DEFAULT_CONFIG, scopeFor(2));
    expect(plan.report.map((p) => p.character)).toEqual(plan.ghosts.map((g) => g.character));
    for (const p of plan.report) {
      expect(p.level).toBe(data[1].has(p.character) ? 1 : 2);
      expect(p.due).toBe(dueChars.includes(p.character));
    }
    expect(plan.report.filter((p) => p.level === 1 && p.due).map((p) => p.character).sort()).toEqual([...dueChars].sort());
    expect(crossLevelLine(plan.report, 2, plan.walkthroughChar !== null, false)).toBe('3 ghosts from level 1 return first.');
  });

  it('a not-yet-due entry is reported as not due and makes no line', () => {
    const c = [...data[1].keys()].find((k) => k !== '明')!;
    const history: ReviewHistory = { [c]: { step: 1, nextDue: T + 86_400_000, lastOutcome: 'clean' } };
    const plan = planSeance(merged, history, T, DEFAULT_CONFIG, scopeFor(2));
    for (const p of plan.report) expect(p.due).toBe(false);
    expect(crossLevelLine(plan.report, 2, false, false)).toBeNull();
  });

  it('without a scope every level is null and no line follows', () => {
    const plan = planSeance(data[1], {}, T, DEFAULT_CONFIG);
    expect(plan.report.length).toBe(plan.ghosts.length);
    for (const p of plan.report) expect(p.level).toBeNull();
    expect(crossLevelLine(plan.report, 1, plan.walkthroughChar !== null, false)).toBeNull();
  });
});
