import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { DEFAULT_CONFIG } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import raw from '../../public/data/characters.json';

const stub = vi.hoisted(() => ({
  mounts: 0,
  /** When true SummonStep is replaced by a stub whose onDone the tests call; otherwise the real one runs. */
  fastSummon: true,
  summon: null as null | { record: { character: string }; onDone: (o: Outcome) => void },
  props: [] as Array<{ record: { character: string }; onOutcome: (o: Outcome) => void }>,
}));

vi.mock('../modes/WriteMode', async () => {
  const React = await import('react');
  return {
    WriteMode: (props: { record: { character: string }; onOutcome: (o: Outcome) => void }) => {
      stub.props.push(props);
      React.useEffect(() => {
        stub.mounts += 1;
      }, []);
      return React.createElement('div', { 'data-testid': 'write-stub' });
    },
  };
});

vi.mock('hanzi-writer', () => ({
  default: {
    create: (el: HTMLElement) => {
      const svg = document.createElement('span');
      svg.setAttribute('data-testid', 'fake-svg');
      el.appendChild(svg);
      return { animateCharacter: () => Promise.resolve() };
    },
  },
}));

vi.mock('../modes/SummonStep', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('../modes/SummonStep')>();
  return {
    ...actual,
    SummonStep: (props: { record: { character: string }; onDone: (o: Outcome) => void }) => {
      React.useEffect(() => {
        if (!stub.fastSummon) return undefined;
        stub.summon = props;
        return () => {
          stub.summon = null;
        };
      });
      if (!stub.fastSummon) return React.createElement(actual.SummonStep, props as never);
      return React.createElement('div', { 'data-testid': 'summon-stub' });
    },
  };
});

import { SUMMON_FADE_MS, SUMMON_HOLD_MS } from '../modes/SummonStep';
import { SeanceSession, dedupeGhosts } from './SeanceSession';

const all = raw as unknown as Record<string, CharacterRecord>;
const rec = (ch: string): CharacterRecord => {
  const r = all[ch];
  if (!r) throw new Error(`missing record ${ch}`);
  return r;
};
const dataset: CharacterDataset = new Map(Object.entries(all));

const lastProps = () => stub.props[stub.props.length - 1]!;
/** Fast path: end the stubbed Summon step if one is showing (clean). */
const finishSummon = () => {
  const s = stub.summon;
  if (s) act(() => s.onDone('clean'));
};
/** Report the Lay-to-rest result, finishing a stubbed Summon step first (clean, so the result is unchanged). */
const emit = (o: Outcome) => {
  finishSummon();
  act(() => lastProps().onOutcome(o));
};

function setup(chars: string[], strict = false) {
  const onOutcome = vi.fn();
  const onComplete = vi.fn();
  const ui = (
    <SeanceSession
      ghosts={chars.map(rec)}
      dataset={dataset}
      config={DEFAULT_CONFIG}
      onOutcome={onOutcome}
      onComplete={onComplete}
    />
  );
  render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { onOutcome, onComplete };
}

beforeEach(() => {
  stub.mounts = 0;
  stub.props = [];
  stub.fastSummon = true;
  stub.summon = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SeanceSession', () => {
  it('3.2: shows Ghost 1 of N, passes first record, no Next before an outcome', () => {
    setup(['我', '口', '爱']);
    expect(screen.getByText('Ghost 1 of 3')).toBeTruthy();
    expect(stub.summon?.record.character).toBe('我');
    finishSummon();
    expect(lastProps().record.character).toBe('我');
    expect(screen.queryByRole('button', { name: /next ghost|finish the séance/i })).toBeNull();
  });

  it('3.4: reports the outcome immediately with the time, once; repeats ignored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { onOutcome } = setup(['我', '口']);
    finishSummon();
    const first = lastProps();
    act(() => first.onOutcome('clean'));
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith('我', 'clean', 1_700_000_000_000);
    act(() => first.onOutcome('gave-up'));
    act(() => first.onOutcome('clean'));
    expect(onOutcome).toHaveBeenCalledTimes(1);
  });

  it('3.2: revealed state kept (same record, no remount) until Next; result shown', () => {
    setup(['我', '口']);
    emit('clean');
    expect(lastProps().record.character).toBe('我');
    expect(stub.mounts).toBe(1);
    expect(screen.getByText('Laid to rest')).toBeTruthy();
  });

  it('3.2: Next ghost gets focus, advances without remount, then disappears', async () => {
    setup(['我', '口']);
    emit('clean');
    const btn = screen.getByRole('button', { name: 'Next ghost' });
    expect(document.activeElement).toBe(btn);
    await userEvent.click(btn);
    expect(screen.getByText('Ghost 2 of 2')).toBeTruthy();
    expect(stub.summon?.record.character).toBe('口');
    finishSummon();
    expect(lastProps().record.character).toBe('口');
    // WriteMode unmounts during the next ghost's Summon step, so each ghost mounts it once.
    expect(stub.mounts).toBe(2);
    expect(screen.queryByRole('button', { name: /next ghost|finish the séance/i })).toBeNull();
  });

  it('8.4: Enter and Space activate the focused Next button', async () => {
    const user = userEvent.setup();
    setup(['我', '口', '爱']);
    emit('clean');
    await user.keyboard('{Enter}');
    expect(screen.getByText('Ghost 2 of 3')).toBeTruthy();
    emit('struggled');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next ghost' }));
    await user.keyboard(' ');
    expect(screen.getByText('Ghost 3 of 3')).toBeTruthy();
  });

  it('3.3: last ghost finishes with correct tallies (gave-up not counted), once', async () => {
    const { onOutcome, onComplete } = setup(['我', '口', '爱', '人']);
    const outcomes: Outcome[] = ['clean', 'struggled', 'gave-up', 'clean'];
    for (let i = 0; i < 4; i++) {
      emit(outcomes[i]!);
      if (i < 3) {
        expect(screen.queryByRole('button', { name: 'Finish the séance' })).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Next ghost' }));
      }
    }
    expect(screen.queryByRole('button', { name: 'Next ghost' })).toBeNull();
    const finish = screen.getByRole('button', { name: 'Finish the séance' });
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(finish);
    fireEvent.click(finish);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ total: 4, laidToRest: 3 });
    expect(onOutcome.mock.calls.map((c) => c[0])).toEqual(['我', '口', '爱', '人']);
  });

  it('double-click on Next ghost advances exactly one ghost', () => {
    setup(['我', '口', '爱']);
    emit('clean');
    const btn = screen.getByRole('button', { name: 'Next ghost' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByText('Ghost 2 of 3')).toBeTruthy();
    finishSummon();
    expect(lastProps().record.character).toBe('口');
  });

  it('3.5: duplicates are collapsed, first occurrences in order', () => {
    const { onOutcome } = setup(['我', '口', '我']);
    expect(screen.getByText('Ghost 1 of 2')).toBeTruthy();
    finishSummon();
    expect(lastProps().record.character).toBe('我');
    emit('clean');
    fireEvent.click(screen.getByRole('button', { name: 'Next ghost' }));
    finishSummon();
    expect(lastProps().record.character).toBe('口');
    emit('clean');
    expect(screen.getByRole('button', { name: 'Finish the séance' })).toBeTruthy();
    expect(onOutcome.mock.calls.map((c) => c[0])).toEqual(['我', '口']);
  });

  it('dedupeGhosts keeps first occurrences in order', () => {
    const out = dedupeGhosts([rec('我'), rec('口'), rec('我'), rec('爱'), rec('口')]);
    expect(out.map((r) => r.character)).toEqual(['我', '口', '爱']);
  });

  it.each([false, true])('empty list completes once with zeros (strict=%s)', (strict) => {
    const { onComplete } = setup([], strict);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ total: 0, laidToRest: 0 });
  });

  it('has no legend or menu control during the session', () => {
    setup(['我', '口']);
    expect(screen.queryByRole('button', { name: /legend|menu/i })).toBeNull();
    emit('clean');
    expect(screen.queryByRole('button', { name: /legend|menu/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Two-step flow with the real SummonStep (hanzi-writer mocked, fake timers)
// ---------------------------------------------------------------------------
describe('SeanceSession two-step flow', () => {
  beforeEach(() => {
    stub.fastSummon = false;
    vi.useFakeTimers();
  });

  const press = (key: string) => fireEvent.keyDown(window, { key });
  const typeCode = (code: string) => code.split('').forEach(press);
  /** Hold and fade of the Summon step, with the promise queue flushed between. */
  const runFade = async () => {
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUMMON_HOLD_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUMMON_FADE_MS);
    });
  };
  const summonShown = () => screen.queryByRole('region', { name: 'Summon step' }) !== null;
  const writeShown = () => screen.queryByTestId('write-stub') !== null;
  const nextShown = () => screen.queryByRole('button', { name: /next ghost|finish the séance/i }) !== null;

  it('clean summon then clean write: one clean Outcome, nothing at the end of the Summon step', async () => {
    const { onOutcome } = setup(['口']);
    typeCode('R');
    await runFade();
    expect(summonShown()).toBe(false);
    expect(writeShown()).toBe(true);
    expect(onOutcome).not.toHaveBeenCalled();
    emit('clean');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['口', 'clean']);
  });

  it('struggled summon then clean write records struggled', async () => {
    const { onOutcome } = setup(['口']);
    ['B', 'B', 'B', 'R'].forEach(press);
    await runFade();
    expect(onOutcome).not.toHaveBeenCalled();
    emit('clean');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['口', 'struggled']);
  });

  it('clean summon then struggled write records struggled', async () => {
    const { onOutcome } = setup(['口']);
    typeCode('R');
    await runFade();
    emit('struggled');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['口', 'struggled']);
  });

  it('Give up in the Summon step still proceeds to writing and records gave-up', async () => {
    const { onOutcome } = setup(['口']);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    await runFade();
    expect(writeShown()).toBe(true);
    expect(onOutcome).not.toHaveBeenCalled();
    emit('clean');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['口', 'gave-up']);
  });

  it('Give up in the Lay-to-rest step records gave-up', async () => {
    const { onOutcome } = setup(['口']);
    typeCode('R');
    await runFade();
    emit('gave-up');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['口', 'gave-up']);
  });

  it('别 and 错 skip the Summon step; 身 has one', () => {
    setup(['别', '错']);
    expect(summonShown()).toBe(false);
    expect(writeShown()).toBe(true);
    expect(screen.getByText('Lay to rest')).toBeTruthy();
    expect(screen.queryByText(/Step \d of 2/)).toBeNull();
    cleanup();
    setup(['身']);
    expect(summonShown()).toBe(true);
    expect(writeShown()).toBe(false);
  });

  it('别 then 错: each is recorded once from the write step alone', () => {
    const { onOutcome } = setup(['别', '错']);
    emit('clean');
    expect(onOutcome.mock.calls[0]!.slice(0, 2)).toEqual(['别', 'clean']);
    fireEvent.click(screen.getByRole('button', { name: 'Next ghost' }));
    expect(screen.getByText('Lay to rest')).toBeTruthy();
    emit('struggled');
    expect(onOutcome.mock.calls[1]!.slice(0, 2)).toEqual(['错', 'struggled']);
  });

  it('the step label changes from Summon to Lay to rest', async () => {
    setup(['身']);
    expect(screen.getByText('Step 1 of 2: Summon')).toBeTruthy();
    typeCode('HXH');
    await runFade();
    expect(screen.queryByText('Step 1 of 2: Summon')).toBeNull();
    expect(screen.getByText('Step 2 of 2: Lay to rest')).toBeTruthy();
  });

  it('the target is absent from the DOM from the end of the fade until the write step ends; Next ghost only after', async () => {
    setup(['身']);
    typeCode('HXH');
    expect(nextShown()).toBe(false);
    await runFade();
    expect(document.body.innerHTML).not.toContain('身');
    expect(nextShown()).toBe(false);
    emit('clean');
    expect(nextShown()).toBe(true);
  });

  it('Next ghost is not shown at the end of the Summon step', async () => {
    setup(['口', '我']);
    typeCode('R');
    await runFade();
    expect(nextShown()).toBe(false);
    emit('clean');
    expect(screen.getByRole('button', { name: 'Next ghost' })).toBeTruthy();
  });

  it('the last ghost leads to the summary via Finish, with a fresh Summon step per ghost', async () => {
    const { onOutcome, onComplete } = setup(['口', '别']);
    typeCode('R');
    await runFade();
    emit('clean');
    fireEvent.click(screen.getByRole('button', { name: 'Next ghost' }));
    expect(summonShown()).toBe(false);
    emit('clean');
    expect(onOutcome).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Finish the séance' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ total: 2, laidToRest: 2 });
  });
});
