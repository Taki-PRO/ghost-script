import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { DEFAULT_CONFIG } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { learningOrder } from '../engine/learningOrder';
import { pickWalkthroughGhost } from '../engine/walkthrough';
import { SoundApiContext, type SoundApi } from '../audio/SoundProvider';
import type { SoundId } from '../audio/voices';
import raw from '../../public/data/characters.json';

// Both steps are stubbed so the tests drive the outcomes directly.
const stub = vi.hoisted(() => ({
  summon: null as null | { onDone: (o: Outcome) => void },
  write: null as null | { onOutcome: (o: Outcome) => void },
}));

vi.mock('../modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: { onOutcome: (o: Outcome) => void }) => {
      stub.write = props;
      return React.createElement('div', { 'data-testid': 'write-stub' });
    },
  };
});

vi.mock('../modes/SummonStep', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('../modes/SummonStep')>();
  return {
    ...actual,
    SummonStep: (props: { onDone: (o: Outcome) => void }) => {
      stub.summon = props;
      return React.createElement('div', { 'data-testid': 'summon-stub' });
    },
  };
});

import { SeanceSession } from './SeanceSession';

const all = raw as unknown as Record<string, CharacterRecord>;
const rec = (ch: string): CharacterRecord => {
  const r = all[ch];
  if (!r) throw new Error(`missing record ${ch}`);
  return r;
};
const dataset: CharacterDataset = new Map(Object.entries(all));

const soundApi = (play: (id: SoundId) => void): SoundApi => ({
  available: true,
  soundOn: true,
  ambienceOn: false,
  reducedMotion: false,
  play,
  setSoundOn: () => undefined,
  setAmbienceOn: () => undefined,
  setAmbientScreen: () => undefined,
});

function setup(
  chars: string[],
  play: (id: SoundId) => void,
  extra: { mode?: 'nightly' | 'review'; walkthroughChar?: string | null; firstMeeting?: ReadonlySet<string> } = {},
) {
  const onOutcome = vi.fn();
  const onComplete = vi.fn();
  const onLeave = vi.fn();
  render(
    <SoundApiContext.Provider value={soundApi(play)}>
      <SeanceSession
        ghosts={chars.map(rec)}
        dataset={dataset}
        config={DEFAULT_CONFIG}
        onOutcome={onOutcome}
        onComplete={onComplete}
        onLeave={onLeave}
        savingWorks={true}
        {...extra}
      />
    </SoundApiContext.Provider>,
  );
  return { onOutcome, onComplete, onLeave };
}

/** Finish a stubbed Summon step (clean) if one shows, then report the write result. */
const emit = (o: Outcome) => {
  const s = stub.summon;
  if (s) act(() => s.onDone('clean'));
  act(() => stub.write!.onOutcome(o));
};
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

let play: ReturnType<typeof vi.fn<(id: SoundId) => void>>;
const played = () => play.mock.calls.map((c) => c[0]);

beforeEach(() => {
  stub.summon = null;
  stub.write = null;
  play = vi.fn<(id: SoundId) => void>();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SeanceSession outcome sounds (11.5)', () => {
  it('clean requests seal-thud then rest-clean', () => {
    setup(['我'], play);
    emit('clean');
    expect(played()).toEqual(['seal-thud', 'rest-clean']);
  });

  it('struggled requests rest-struggled only', () => {
    setup(['我'], play);
    emit('struggled');
    expect(played()).toEqual(['rest-struggled']);
  });

  it('gave-up requests rest-gave-up only', () => {
    setup(['我'], play);
    emit('gave-up');
    expect(played()).toEqual(['rest-gave-up']);
  });

  it('plays once per ghost even when the outcome callback fires twice', () => {
    setup(['我', '口'], play);
    emit('clean');
    act(() => stub.write!.onOutcome('clean'));
    act(() => stub.write!.onOutcome('gave-up'));
    expect(played()).toEqual(['seal-thud', 'rest-clean']);
    click('Next ghost');
    play.mockClear();
    emit('struggled');
    act(() => stub.write!.onOutcome('struggled'));
    expect(played()).toEqual(['rest-struggled']);
  });

  it('plays nothing after Leave', () => {
    const { onOutcome } = setup(['我'], play);
    act(() => stub.summon!.onDone('clean'));
    const report = stub.write!.onOutcome;
    click('Leave séance');
    click('Leave');
    act(() => report('clean'));
    expect(played()).toEqual([]);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('plays nothing on Leave séance, Stay or Leave', () => {
    setup(['我'], play);
    click('Leave séance');
    click('Stay');
    click('Leave séance');
    click('Leave');
    expect(played()).toEqual([]);
  });

  it('plays nothing on Next ghost, Finish the séance or when the summary opens', () => {
    const { onComplete } = setup(['我', '口'], play);
    emit('clean');
    play.mockClear();
    click('Next ghost');
    expect(played()).toEqual([]);
    emit('gave-up');
    play.mockClear();
    click('Finish the séance');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(played()).toEqual([]);
  });

  it('plays the same sounds in review mode', () => {
    setup(['我', '口', '爱'], play, { mode: 'review' });
    emit('clean');
    expect(played()).toEqual(['seal-thud', 'rest-clean']);
    click('Next ghost');
    play.mockClear();
    emit('struggled');
    expect(played()).toEqual(['rest-struggled']);
    click('Next ghost');
    play.mockClear();
    emit('gave-up');
    expect(played()).toEqual(['rest-gave-up']);
  });

  it('plays the same sounds for the walkthrough ghost', () => {
    const walkChar = pickWalkthroughGhost(learningOrder(dataset), dataset)!;
    setup([walkChar, '口'], play, { walkthroughChar: walkChar, firstMeeting: new Set([walkChar]) });
    emit('clean');
    expect(played()).toEqual(['seal-thud', 'rest-clean']);
    click('Next ghost');
    play.mockClear();
    expect(played()).toEqual([]);
  });

  it('a throwing play leaves onOutcome calls and the saved history as if play did nothing', () => {
    const run = (p: (id: SoundId) => void) => {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);
      const r = setup(['我', '口'], p);
      emit('clean');
      click('Next ghost');
      emit('struggled');
      click('Finish the séance');
      const result = { outcomes: r.onOutcome.mock.calls, complete: r.onComplete.mock.calls };
      cleanup();
      vi.useRealTimers();
      return result;
    };
    const quiet = run(() => undefined);
    const throwing = vi.fn<(id: SoundId) => void>(() => {
      throw new Error('boom');
    });
    const loud = run(throwing);
    expect(throwing).toHaveBeenCalled();
    expect(loud).toEqual(quiet);
    expect(loud.outcomes).toHaveLength(2);
  });
});
