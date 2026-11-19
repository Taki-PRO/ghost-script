import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Outcome } from './engine/scheduler';
import { STORAGE_KEY } from './storage/storage';
import raw from '../public/data/characters.json';

const stub = vi.hoisted(() => ({
  props: [] as Array<{ onOutcome: (o: Outcome) => void }>,
  summon: null as null | { onDone: (o: Outcome) => void },
  engineCalls: [] as string[],
  created: 0,
}));

vi.mock('./modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: { onOutcome: (o: Outcome) => void }) => {
      stub.props.push(props);
      return React.createElement('div', { 'data-testid': 'write-stub' });
    },
  };
});

vi.mock('./modes/SummonStep', async () => {
  const React = await import('react');
  return {
    SummonStep: (props: { onDone: (o: Outcome) => void }) => {
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

// A fake engine behind the real provider: it records what the provider tells it.
vi.mock('./audio/engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('./audio/engine')>();
  return {
    ...original,
    createSoundEngine: () => {
      stub.created += 1;
      return {
        play: (id: string) => void stub.engineCalls.push(`play:${id}`),
        setEnabled: (on: boolean) => void stub.engineCalls.push(`enabled:${on}`),
        setAmbience: (w: boolean) => void stub.engineCalls.push(`ambience:${w}`),
        unlock: () => void stub.engineCalls.push('unlock'),
        suspend: () => void stub.engineCalls.push('suspend'),
        dispose: () => void stub.engineCalls.push('dispose'),
      };
    },
  };
});

import App from './App';

function seedReturning(extra: object = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 4,
      introSeen: true,
      cangjieIntroSeen: true,
      level: 1,
      levelChosen: true,
      soundOn: true,
      ambienceOn: true,
      history: {},
      ...extra,
    }),
  );
}

function mount() {
  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  render(<App />, { container });
  return container;
}

const toggleOf = () => screen.queryByTestId('sound-toggle');
const lastAmbience = () => {
  const calls = stub.engineCalls.filter((c) => c.startsWith('ambience:'));
  return calls[calls.length - 1];
};
const primaries = () => document.querySelectorAll('.slip-primary').length;

/** The toggle is present, is the last element of #root, and at most one primary slip shows. */
function expectToggleLast(root: HTMLElement) {
  const toggle = toggleOf();
  expect(toggle).not.toBeNull();
  expect(root.lastElementChild).toBe(toggle);
  expect(primaries()).toBeLessThanOrEqual(1);
}

beforeEach(() => {
  stub.props = [];
  stub.summon = null;
  stub.engineCalls = [];
  stub.created = 0;
  localStorage.clear();
  vi.stubGlobal('AudioContext', function FakeAudioContext() {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(raw) })),
  );
});
afterEach(() => {
  cleanup();
  document.getElementById('root')?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Sound_Toggle on every screen', () => {
  it('is on the intro, last in #root, and the intro keeps one primary slip', async () => {
    const root = mount();
    await screen.findByRole('button', { name: /^begin the séance$/i });
    expectToggleLast(root);
    expect(primaries()).toBe(1);
    expect(lastAmbience()).toBe('ambience:false');
  });

  it('is on the menu, last in #root, and the first Tab stop is still the primary slip', async () => {
    seedReturning();
    const root = mount();
    const begin = await screen.findByRole('button', { name: /begin a nightly séance/i });
    expectToggleLast(root);
    expect(primaries()).toBe(1);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(begin);
  });

  it('is on the Graveyard and on Sources & licences', async () => {
    seedReturning();
    const root = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^graveyard$/i }));
    await screen.findByRole('button', { name: /back/i });
    expectToggleLast(root);
    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(await screen.findByRole('button', { name: /sources & licences/i }));
    await screen.findByRole('heading', { name: 'Sources & licences' });
    expectToggleLast(root);
  });

  it('is on the Cangjie guide', async () => {
    seedReturning();
    const root = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /how cangjie works/i }));
    await screen.findByRole('heading', { name: /how cangjie works/i });
    expectToggleLast(root);
  });

  it('is on the séance and the summary', async () => {
    seedReturning();
    const root = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    await screen.findByText('Ghost 1 of 10');
    expectToggleLast(root);
    for (let i = 0; i < 10; i++) {
      if (stub.summon) act(() => stub.summon!.onDone('clean'));
      act(() => stub.props[stub.props.length - 1]!.onOutcome('clean'));
      await user.click(
        await screen.findByRole('button', { name: i === 9 ? /finish the séance/i : /next ghost/i }),
      );
    }
    await screen.findByText('10 of 10 ghosts laid to rest');
    expectToggleLast(root);
    expect(primaries()).toBe(1);
  });

  it('is absent on the loading screen', () => {
    seedReturning();
    mount();
    expect(screen.getByRole('status').textContent).toMatch(/summoning/i);
    expect(toggleOf()).toBeNull();
  });

  it('is absent on the error screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('net'))));
    mount();
    await screen.findByRole('alert');
    expect(toggleOf()).toBeNull();
  });
});

describe('ambient screen wish', () => {
  it('is true on the menu and the Graveyard and false on every other screen', async () => {
    seedReturning();
    mount();
    const user = userEvent.setup();
    const menu = await screen.findByRole('button', { name: /begin a nightly séance/i });
    expect(menu).toBeTruthy();
    expect(lastAmbience()).toBe('ambience:true');

    await user.click(screen.getByRole('button', { name: /^graveyard$/i }));
    await screen.findByRole('button', { name: /back/i });
    expect(lastAmbience()).toBe('ambience:true');

    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(await screen.findByRole('button', { name: /sources & licences/i }));
    await screen.findByRole('heading', { name: 'Sources & licences' });
    expect(lastAmbience()).toBe('ambience:false');

    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(await screen.findByRole('button', { name: /how cangjie works/i }));
    await screen.findByRole('heading', { name: /how cangjie works/i });
    expect(lastAmbience()).toBe('ambience:false');

    await user.click(screen.getByRole('button', { name: /continue|back|menu/i }));
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    await screen.findByText('Ghost 1 of 10');
    expect(lastAmbience()).toBe('ambience:false');
  });

  it('is false on the intro', async () => {
    seedReturning();
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /read the legend again/i }));
    await screen.findByRole('button', { name: /^begin the séance$/i });
    expect(lastAmbience()).toBe('ambience:false');
  });
});

describe('without Web Audio', () => {
  it('creates no engine and shows no toggle', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(raw) })),
    );
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
    expect((globalThis as { webkitAudioContext?: unknown }).webkitAudioContext).toBeUndefined();
    seedReturning();
    mount();
    await screen.findByRole('button', { name: /begin a nightly séance/i });
    expect(stub.created).toBe(0);
    expect(toggleOf()).toBeNull();
  });
});
