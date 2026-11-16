/**
 * The saved-progress flag is sticky for the page session and lives in the default
 * store, so the "saving works" Leave text is checked in its own file (its own
 * module graph), away from the tests in App.test.tsx that make writes fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Outcome } from './engine/scheduler';
import { STORAGE_KEY } from './storage/storage';
import raw from '../public/data/characters.json';

const stub = vi.hoisted(() => ({
  onOutcome: null as null | ((o: Outcome) => void),
  summon: null as null | { onDone: (o: Outcome) => void },
}));

vi.mock('./modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: { onOutcome: (o: Outcome) => void }) => {
      stub.onOutcome = props.onOutcome;
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

import App from './App';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 2, introSeen: true, cangjieIntroSeen: true, history: {} }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(raw) })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('App Leave prompt with working storage', () => {
  it('18.2a, 18.2c: says finished ghosts are saved when no write has failed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /begin a nightly séance/i }));
    const s = stub.summon;
    if (s) act(() => s.onDone('clean'));
    act(() => stub.onOutcome!('clean'));
    await user.click(await screen.findByRole('button', { name: /leave séance/i }));
    expect(
      screen.getByRole('group', { name: "Leave now? Ghosts you've finished are saved." }),
    ).toBeTruthy();
  });
});
