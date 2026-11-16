import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { DEFAULT_CONFIG } from '../engine/config';
import { SeanceSession } from './SeanceSession';

// Real WriteMode (no stub): only hanzi-writer is replaced so the quiz callbacks can be driven.
interface QuizOpts {
  onMistake: (d: { mistakesOnStroke: number; totalMistakes: number }) => void;
  onComplete: (d: { totalMistakes: number }) => void;
}
const h = vi.hoisted(() => ({ quiz: null as unknown }));
vi.mock('hanzi-writer', () => ({
  default: {
    create: () => ({
      quiz: (q: unknown) => {
        h.quiz = q;
        return Promise.resolve();
      },
      cancelQuiz: () => undefined,
      animateCharacter: () => Promise.resolve(),
      showCharacter: () => Promise.resolve(),
    }),
  },
}));

const all = raw as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(all));
// No Cangjie code: the ghost skips the summon step, so only the write result is combined.
const ghost: CharacterRecord = { ...all['我']!, cangjie: null, summonInk: { class: 'opaque' } };
const quiz = () => h.quiz as QuizOpts;

function setup() {
  render(
    <SeanceSession
      ghosts={[ghost]}
      dataset={dataset}
      config={DEFAULT_CONFIG}
      onOutcome={vi.fn()}
      onLeave={vi.fn()}
      savingWorks={true}
      onComplete={vi.fn()}
    />,
  );
}
afterEach(cleanup);

describe('SeanceSession result line with the real WriteMode (17.1, 17.2)', () => {
  it('a clean write shows exactly one "Laid to rest" text, from the result line', () => {
    setup();
    act(() => quiz().onComplete({ totalMistakes: 0 }));
    expect(screen.getAllByText(/laid to rest/i)).toHaveLength(1);
    expect(screen.getByText('Laid to rest')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
  });
  it('a struggled write shows exactly one "Laid to rest…" text, from the result line', () => {
    setup();
    for (let i = 0; i < 3; i += 1) act(() => quiz().onMistake({ mistakesOnStroke: 1, totalMistakes: i + 1 }));
    act(() => quiz().onComplete({ totalMistakes: 3 }));
    expect(screen.getAllByText(/laid to rest/i)).toHaveLength(1);
    expect(screen.getByText('Laid to rest — it will return soon')).toBeInTheDocument();
    expect(screen.queryByText(/but this ghost will return soon/i)).toBeNull();
  });
});
