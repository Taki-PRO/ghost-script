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

import { SeanceSession, dedupeGhosts } from './SeanceSession';

const all = raw as unknown as Record<string, CharacterRecord>;
const rec = (ch: string): CharacterRecord => {
  const r = all[ch];
  if (!r) throw new Error(`missing record ${ch}`);
  return r;
};
const dataset: CharacterDataset = new Map(Object.entries(all));

const lastProps = () => stub.props[stub.props.length - 1]!;
const emit = (o: Outcome) => act(() => lastProps().onOutcome(o));

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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SeanceSession', () => {
  it('3.2: shows Ghost 1 of N, passes first record, no Next before an outcome', () => {
    setup(['我', '口', '爱']);
    expect(screen.getByText('Ghost 1 of 3')).toBeTruthy();
    expect(lastProps().record.character).toBe('我');
    expect(screen.queryByRole('button', { name: /next ghost|finish the séance/i })).toBeNull();
  });

  it('3.4: reports the outcome immediately with the time, once; repeats ignored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { onOutcome } = setup(['我', '口']);
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
    expect(lastProps().record.character).toBe('口');
    expect(stub.mounts).toBe(1);
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
    expect(lastProps().record.character).toBe('口');
  });

  it('3.5: duplicates are collapsed, first occurrences in order', () => {
    const { onOutcome } = setup(['我', '口', '我']);
    expect(screen.getByText('Ghost 1 of 2')).toBeTruthy();
    expect(lastProps().record.character).toBe('我');
    emit('clean');
    fireEvent.click(screen.getByRole('button', { name: 'Next ghost' }));
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
