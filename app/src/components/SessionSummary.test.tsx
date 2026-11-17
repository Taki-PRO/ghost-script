import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from './SessionSummary';
import type { ReturnRow } from '../engine/formatReturn';

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

describe('SessionSummary wrapper (Req 21.11)', () => {
  it('has no bg-background class on the wrapper', () => {
    setup(10, 7);
    expect(screen.getByRole('main')).not.toHaveClass('bg-background');
  });
});

describe('SessionSummary return times (first-meeting 9.3-9.5)', () => {
  const NOW = new Date(2026, 10, 20, 22, 0).getTime();
  const rows: ReturnRow[] = [
    { character: 'A1', pinyin: 'yī', meaning: 'one', nextDue: NOW }, // gave up
    { character: 'B2', pinyin: 'èr', meaning: 'two', nextDue: NOW + 10 * 60_000 }, // struggled
    { character: 'C3', pinyin: 'rén', meaning: 'person', nextDue: new Date(2026, 10, 23, 22, 0).getTime() }, // clean
  ];

  function renderRows(returns?: ReturnRow[], finishedAt?: number) {
    render(
      <SessionSummary
        results={{ total: 3, laidToRest: 2, returns, finishedAt }}
        onPlayAgain={() => {}}
      />,
    );
  }

  it('lists each ghost in order with glyph, pinyin, meaning and return text', () => {
    renderRows(rows, NOW);
    const list = screen.getByRole('list', { name: 'Ghosts that will return' });
    const items = Array.from(list.querySelectorAll('li'));
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('A1');
    expect(items[0].textContent).toContain('returns now');
    expect(items[1].textContent).toContain('returns in 10 minutes');
    expect(items[2].textContent).toContain('returns in 3 days');
    expect(items[2].textContent).toContain('person');
    expect(items[0].querySelector('[lang="zh"]')?.textContent).toBe('A1');
    expect(items[2].querySelector('[lang="zh-Latn-pinyin"]')?.textContent).toBe('rén');
    expect(screen.getByRole('heading', { level: 2, name: 'Ghosts that will return' })).toBeTruthy();
  });

  it('shows no list or heading when rows are empty or absent', () => {
    renderRows([], NOW);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    cleanup();
    renderRows(undefined, NOW);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows no list when finishedAt is missing or not finite', () => {
    renderRows(rows, undefined);
    expect(screen.queryByRole('list')).toBeNull();
    cleanup();
    renderRows(rows, NaN);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('keeps the count line and button with rows present', () => {
    renderRows(rows, NOW);
    expect(statusText()).toBe('2 of 3 ghosts laid to rest');
    expect(screen.getByRole('button', { name: 'Begin another Séance' })).toBeTruthy();
  });
});

describe('SessionSummary paper look (ink-and-candlelight 10.1, 10.2, 10.4)', () => {
  it('draws the count line as a paper card and the button as the one seal primary', () => {
    setup(10, 7);
    expect(screen.getByRole('status')).toHaveClass('card-slip');
    const button = screen.getByRole('button', { name: 'Begin another Séance' });
    expect(button).toHaveClass('slip-primary');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('draws every return row as a paper card', () => {
    const NOW = new Date(2026, 10, 20, 22, 0).getTime();
    render(
      <SessionSummary
        results={{
          total: 2,
          laidToRest: 2,
          finishedAt: NOW,
          returns: [
            { character: 'A1', pinyin: 'yī', meaning: 'one', nextDue: NOW },
            { character: 'B2', pinyin: 'èr', meaning: 'two', nextDue: NOW + 10 * 60_000 },
          ],
        }}
        onPlayAgain={() => {}}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    items.forEach((li) => expect(li).toHaveClass('card-slip'));
  });
});
