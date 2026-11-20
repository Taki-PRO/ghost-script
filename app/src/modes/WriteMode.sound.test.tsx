import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import { SoundApiContext, type SoundApi } from '../audio/SoundProvider';
import type { SoundId } from '../audio/voices';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { WriteMode } from './WriteMode';

interface QuizOpts {
  onMistake: (d: { mistakesOnStroke: number; totalMistakes: number }) => void;
  onCorrectStroke: (d: Record<string, unknown>) => void;
  onComplete: (d: { totalMistakes: number }) => void;
}

const h = vi.hoisted(() => ({
  quizOpts: null as unknown,
  creates: 0,
}));

vi.mock('hanzi-writer', () => {
  const create = () => {
    h.creates += 1;
    return {
      quiz: (q: unknown) => {
        h.quizOpts = q;
        return Promise.resolve();
      },
      cancelQuiz: () => undefined,
      animateCharacter: () => Promise.resolve(),
      showCharacter: () => Promise.resolve(),
      hideCharacter: () => Promise.resolve(),
    };
  };
  return { default: { create } };
});

const data = realDataJson as unknown as Record<string, CharacterRecord>;
const WO = data['我']!;
const dataset: CharacterDataset = new Map(Object.entries(data));
const quiz = () => h.quizOpts as QuizOpts;

let played: SoundId[] = [];

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

function setup(play: (id: SoundId) => void = (id) => void played.push(id)) {
  const onOutcome = vi.fn();
  const view = render(
    <SoundApiContext.Provider value={api(play)}>
      <WriteMode record={WO} dataset={dataset} config={DEFAULT_CONFIG} onOutcome={onOutcome} />
    </SoundApiContext.Provider>,
  );
  return { onOutcome, ...view };
}
const correct = () => act(() => quiz().onCorrectStroke({}));
const mistake = (n = 1) => act(() => quiz().onMistake({ mistakesOnStroke: n, totalMistakes: n }));
const complete = (n = 0) => act(() => quiz().onComplete({ totalMistakes: n }));
const loaded = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  played = [];
  h.quizOpts = null;
  h.creates = 0;
});
afterEach(cleanup);

describe('WriteMode sounds', () => {
  it('plays ink-sweep for each correct stroke', () => {
    setup();
    correct();
    correct();
    expect(played).toEqual(['ink-sweep', 'ink-sweep']);
  });

  it('plays nothing for a mistake or for completion', () => {
    setup();
    mistake(1);
    mistake(3);
    complete(2);
    expect(played).toEqual([]);
  });

  it('plays nothing after the ghost is resolved', () => {
    setup();
    correct();
    complete(0);
    correct();
    mistake(1);
    complete(0);
    expect(played).toEqual(['ink-sweep']);
  });

  it('plays nothing after give up', async () => {
    const user = userEvent.setup();
    setup();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Give up' }));
    correct();
    mistake(1);
    expect(played).toEqual([]);
  });

  it('does not restart the quiz when the sound API changes', () => {
    const { rerender, onOutcome } = setup();
    rerender(
      <SoundApiContext.Provider value={api(() => undefined)}>
        <WriteMode record={WO} dataset={dataset} config={DEFAULT_CONFIG} onOutcome={onOutcome} />
      </SoundApiContext.Provider>,
    );
    expect(h.creates).toBe(1);
  });

  it('a throwing play leaves the feedback, the mistakes and the outcome unchanged', () => {
    const { onOutcome } = setup(() => {
      throw new Error('audio broke');
    });
    mistake(1);
    correct();
    expect(screen.getByRole('status')).toHaveTextContent('✓ Stroke accepted');
    expect(screen.getByText('Mistakes: 1')).toBeInTheDocument();
    complete(1);
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith('clean');
  });
});
