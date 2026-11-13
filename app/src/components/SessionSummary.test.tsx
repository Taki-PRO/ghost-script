import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from './SessionSummary';

afterEach(cleanup);

function setup(total: number, laidToRest: number) {
  const onPlayAgain = vi.fn();
  render(<SessionSummary results={{ total, laidToRest }} onPlayAgain={onPlayAgain} />);
  return { onPlayAgain, user: userEvent.setup() };
}

const statusText = () => screen.getByRole('status').textContent ?? '';

describe('SessionSummary counts (Req 3.3)', () => {
  it('shows 7 of 10', () => {
    setup(10, 7);
    expect(statusText()).toBe('7 of 10 ghosts laid to rest');
  });

  it('uses singular for one ghost', () => {
    setup(1, 1);
    expect(statusText()).toBe('1 of 1 ghost laid to rest');
  });

  it('renders all and none laid to rest', () => {
    setup(10, 10);
    expect(statusText()).toBe('10 of 10 ghosts laid to rest');
    cleanup();
    setup(10, 0);
    expect(statusText()).toBe('0 of 10 ghosts laid to rest');
  });

  it('renders an empty message for 0 of 0', () => {
    setup(0, 0);
    expect(statusText()).toBe('No ghosts appeared this time');
    expect(statusText()).not.toMatch(/NaN|Infinity/);
  });
});

describe('SessionSummary defensive inputs', () => {
  const cases: Array<[string, number, number, string]> = [
    ['laidToRest > total', 5, 9, '5 of 5 ghosts laid to rest'],
    ['negative laidToRest', 5, -3, '0 of 5 ghosts laid to rest'],
    ['negative total', -4, -2, 'No ghosts appeared this time'],
    ['non-integers', 5.9, 2.7, '2 of 5 ghosts laid to rest'],
    ['NaN laidToRest', 5, NaN, '0 of 5 ghosts laid to rest'],
    ['NaN total', NaN, 3, 'No ghosts appeared this time'],
    ['Infinity', Infinity, Infinity, 'No ghosts appeared this time'],
  ];

  it.each(cases)('%s', (_name, total, laid, expected) => {
    setup(total, laid);
    const text = statusText();
    expect(text).toBe(expected);
    expect(text).not.toMatch(/NaN|Infinity|-\d/);
  });
});

describe('SessionSummary controls (Req 3.6)', () => {
  it('has a heading', () => {
    setup(10, 7);
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('calls onPlayAgain once on click', async () => {
    const { onPlayAgain, user } = setup(10, 7);
    await user.click(screen.getByRole('button', { name: 'Begin another Séance' }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('calls onPlayAgain once on Enter', async () => {
    const { onPlayAgain, user } = setup(10, 7);
    screen.getByRole('button', { name: 'Begin another Séance' }).focus();
    await user.keyboard('{Enter}');
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
