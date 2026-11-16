import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { Graveyard } from './Graveyard';
import { learningOrder } from '../engine/learningOrder';
import { applyReview } from '../engine/scheduler';
import type { ReviewHistory } from '../engine/scheduler';
import { DEFAULT_CONFIG } from '../engine/config';
import raw from '../../public/data/characters.json';

const dataset: CharacterDataset = new Map(
  Object.entries(raw as unknown as Record<string, CharacterRecord>),
);
const order = learningOrder(dataset);
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

afterEach(cleanup);

function show(history: ReviewHistory, onBack: () => void = () => {}) {
  return render(<Graveyard dataset={dataset} history={history} now={NOW} onBack={onBack} />);
}

describe('Graveyard', () => {
  it('shows one item per record', () => {
    show({});
    expect(screen.getByRole('list', { name: 'Graves' }).children).toHaveLength(dataset.size);
  });

  it('with an empty history, no character appears anywhere in the HTML', () => {
    const { container } = show({});
    const html = container.innerHTML;
    for (const ch of dataset.keys()) expect(html.includes(ch)).toBe(false);
    expect(screen.getByText(/No ghost has been met yet/)).toBeTruthy();
    expect(screen.getByText('Never met: 300')).toBeTruthy();
  });

  describe('mixed history', () => {
    const [a, b, c] = [order[0], order[1], order[2]];
    const history: ReviewHistory = {
      [a]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
      [b]: applyReview(undefined, 'struggled', NOW, DEFAULT_CONFIG),
      [c]: applyReview(undefined, 'clean', NOW - 5 * DAY, DEFAULT_CONFIG),
    };

    it('shows glyphs, markers and accessible names', () => {
      show(history);
      const rest = screen.getByLabelText(`${a}, at rest, 1 clean in a row`);
      expect(rest.textContent).toContain(a);
      expect(rest.textContent).toContain('✓');
      expect(rest.className).toContain('grave-rest');
      expect(rest.querySelector('[lang="zh"]')?.textContent).toBe(a);

      const missed = screen.getByLabelText(`${b}, restless, due again`);
      expect(missed.textContent).toContain('!');
      expect(missed.className).toContain('grave-restless');

      // clean but overdue: restless, with its streak
      const due = screen.getByLabelText(`${c}, restless, due again, 1 clean in a row`);
      expect(due.className).toContain('grave-restless');

      const unmet = screen.getByLabelText(`Ghost 4 of 300, never met`);
      expect(unmet.textContent).toBe('·');
      expect(unmet.className).toContain('grave-wisp');
    });

    it('shows the legend counts in text', () => {
      show(history);
      expect(screen.getByText('Never met: 297')).toBeTruthy();
      expect(screen.getByText('Restless: 2')).toBeTruthy();
      expect(screen.getByText('At rest: 1')).toBeTruthy();
      expect(screen.queryByText(/No ghost has been met yet/)).toBeNull();
    });

    it('puts no unmet character in any label or text of an unmet grave', () => {
      show(history);
      const unmetItems = screen
        .getAllByRole('listitem')
        .filter((li) => (li.getAttribute('aria-label') ?? '').endsWith('never met'));
      expect(unmetItems).toHaveLength(297);
      for (const li of unmetItems) {
        const text = (li.getAttribute('aria-label') ?? '') + li.innerHTML;
        for (const ch of dataset.keys()) expect(text.includes(ch)).toBe(false);
      }
    });
  });

  it('has one Back to menu button, in the sticky header with the h1', () => {
    show({});
    const buttons = screen.getAllByRole('button', { name: 'Back to menu' });
    expect(buttons).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Graveyard' });
    const header = h1.closest('header');
    expect(header).not.toBeNull();
    expect(header?.contains(buttons[0])).toBe(true);
    for (const cls of ['sticky', 'top-0', 'bg-night-top']) {
      expect(header?.classList.contains(cls)).toBe(true);
    }
  });

  it('calls onBack from the Back to menu button', () => {
    const onBack = vi.fn();
    show({}, onBack);
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
