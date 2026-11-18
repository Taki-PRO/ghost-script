import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
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
    { character: 'A1', pinyin: 'yī', meaning: 'one', nextDue: NOW, outcome: 'gave-up' }, // gave up
    { character: 'B2', pinyin: 'èr', meaning: 'two', nextDue: NOW + 10 * 60_000, outcome: 'struggled' }, // struggled
    { character: 'C3', pinyin: 'rén', meaning: 'person', nextDue: new Date(2026, 10, 23, 22, 0).getTime(), outcome: 'clean' }, // clean
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
    expect(items[2]).toHaveAccessibleName(expect.stringContaining('person'));
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
            { character: 'A1', pinyin: 'yī', meaning: 'one', nextDue: NOW, outcome: 'clean' },
            { character: 'B2', pinyin: 'èr', meaning: 'two', nextDue: NOW + 10 * 60_000, outcome: 'struggled' },
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

describe('SessionSummary tiles (proof-pass 4)', () => {
  const NOW = new Date(2026, 10, 20, 22, 0).getTime();
  const tomorrow = new Date(2026, 10, 21, 22, 0).getTime();
  const rows: ReturnRow[] = [
    { character: '我', pinyin: 'wǒ', meaning: 'I', nextDue: tomorrow, outcome: 'clean' },
    { character: '你', pinyin: 'nǐ', meaning: 'you', nextDue: NOW + 10 * 60_000, outcome: 'struggled' },
    { character: '他', pinyin: 'tā', meaning: 'he', nextDue: NOW, outcome: 'gave-up' },
  ];
  const renderTiles = () =>
    render(
      <SessionSummary results={{ total: 3, laidToRest: 2, returns: rows, finishedAt: NOW }} onPlayAgain={() => {}} />,
    );
  const tiles = () => screen.getAllByRole('listitem');

  it('uses the display font for the heading', () => {
    renderTiles();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('font-display');
  });

  it('names a clean tile with character, pinyin, meaning, outcome and return text, and shows a seal of its own character', () => {
    renderTiles();
    const tile = tiles()[0];
    expect(tile).toHaveAccessibleName('我, wǒ, I, laid to rest, returns tomorrow');
    expect(within(tile).getByTestId('seal-stamp')).toHaveAccessibleName('Seal: 我');
    expect(tile.textContent).toContain('Laid to rest');
    expect(tile.textContent).toContain('wǒ');
    expect(tile.textContent).toContain('returns tomorrow');
    expect(tile.textContent).not.toContain('I,');
    expect(within(tile).queryByText('I')).toBeNull();
  });

  it('names a struggled tile and draws a faint ghost with no seal', () => {
    renderTiles();
    const tile = tiles()[1];
    expect(tile).toHaveAccessibleName('你, nǐ, you, struggled, returns in 10 minutes');
    expect(within(tile).queryByTestId('seal-stamp')).toBeNull();
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.querySelector('[lang="zh"]')?.textContent).toBe('你');
    expect(tile.textContent).toContain('Struggled');
  });

  it('names a gave-up tile and draws a faint ghost with no seal', () => {
    renderTiles();
    const tile = tiles()[2];
    expect(tile).toHaveAccessibleName('他, tā, he, gave up, returns now');
    expect(within(tile).queryByTestId('seal-stamp')).toBeNull();
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.textContent).toContain('Gave up');
  });

  it('renders exactly one seal in play order and one slip-primary', () => {
    renderTiles();
    expect(screen.getAllByTestId('seal-stamp')).toHaveLength(1);
    expect(tiles().map((li) => li.querySelector('[lang="zh"]')?.textContent)).toEqual(['我', '你', '他']);
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
  });

  it('shows no tile for an empty séance', () => {
    setup(0, 0);
    expect(statusText()).toBe('No ghosts appeared this time');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByTestId('seal-stamp')).toBeNull();
  });
});
describe('SessionSummary review mode (proof-pass 10)', () => {
  const NOW = new Date(2026, 10, 20, 22, 0).getTime();
  const rows: ReturnRow[] = [
    { character: '我', pinyin: 'wǒ', meaning: 'I', nextDue: NOW + 10 * 60_000, outcome: 'clean' },
    { character: '你', pinyin: 'nǐ', meaning: 'you', nextDue: NOW + 10 * 60_000, outcome: 'struggled' },
    { character: '他', pinyin: 'tā', meaning: 'he', nextDue: NOW + 10 * 60_000, outcome: 'gave-up' },
  ];
  const renderReview = (total = 3, laidToRest = 1, returns: ReturnRow[] = rows) => {
    const onPlayAgain = vi.fn();
    render(
      <SessionSummary
        results={{ total, laidToRest, returns, finishedAt: NOW, mode: 'review' }}
        onPlayAgain={onPlayAgain}
      />,
    );
    return onPlayAgain;
  };
  it('shows "N of M ghosts remembered" with N the clean ghosts, and "1 of 1 ghost remembered"', () => {
    renderReview();
    expect(statusText()).toBe('1 of 3 ghosts remembered');
    cleanup();
    renderReview(1, 1, rows.slice(0, 1));
    expect(statusText()).toBe('1 of 1 ghost remembered');
  });
  it('says "laid to rest" nowhere, in text or accessible names', () => {
    renderReview();
    expect(document.body.textContent).not.toMatch(/laid to rest/i);
    for (const li of screen.getAllByRole('listitem')) {
      expect(li.getAttribute('aria-label')).not.toMatch(/laid to rest/i);
    }
  });
  it('names a clean tile "remembered" and keeps its seal; the Return_Text is shown', () => {
    renderReview();
    const tile = screen.getAllByRole('listitem')[0]!;
    expect(tile).toHaveAccessibleName('我, wǒ, I, remembered, returns in 10 minutes');
    expect(within(tile).getByTestId('seal-stamp')).toHaveAccessibleName('Seal: 我');
    expect(tile.textContent).toContain('Remembered');
    expect(tile.textContent).toContain('returns in 10 minutes');
  });
  it('keeps the struggled and gave-up tiles as they are, without a seal', () => {
    renderReview();
    const [, struggled, gaveUp] = screen.getAllByRole('listitem');
    expect(struggled).toHaveAccessibleName('你, nǐ, you, struggled, returns in 10 minutes');
    expect(gaveUp).toHaveAccessibleName('他, tā, he, gave up, returns in 10 minutes');
    expect(within(struggled!).queryByTestId('seal-stamp')).toBeNull();
    expect(within(gaveUp!).queryByTestId('seal-stamp')).toBeNull();
  });
  it('has "Begin another Séance" as the only slip-primary and it calls onPlayAgain', async () => {
    const onPlayAgain = renderReview();
    const button = screen.getByRole('button', { name: 'Begin another Séance' });
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
    expect(button).toHaveClass('slip-primary');
    await userEvent.setup().click(button);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
