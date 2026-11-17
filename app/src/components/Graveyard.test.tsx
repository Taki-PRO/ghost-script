import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { Graveyard } from './Graveyard';
import { learningOrder } from '../engine/learningOrder';
import { applyReview } from '../engine/scheduler';
import type { ReviewHistory } from '../engine/scheduler';
import { DEFAULT_CONFIG } from '../engine/config';
import { theme } from '../styles/theme';
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
      expect(rest.className).toContain('tablet-rest');
      expect(rest.querySelector('[lang="zh"]')?.textContent).toBe(a);

      const missed = screen.getByLabelText(`${b}, restless, due again`);
      expect(missed.textContent).toContain('!');
      expect(missed.className).toContain('tablet-restless');

      // clean but overdue: restless, with its streak
      const due = screen.getByLabelText(`${c}, restless, due again, 1 clean in a row`);
      expect(due.className).toContain('tablet-restless');

      const unmet = screen.getByLabelText(`Ghost 4 of 300, never met`);
      expect(unmet.textContent).toBe('·');
      expect(unmet.className).toContain('tablet-unmet');
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
    for (const cls of ['sticky', 'sticky-below-moon', 'bg-night-top']) {
      expect(header?.classList.contains(cls)).toBe(true);
    }
    expect(header?.classList.contains('top-0')).toBe(false);
  });

  it('gives each state its own tablet classes and no old grave classes', () => {
    const history: ReviewHistory = {
      [order[0]]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
      [order[1]]: applyReview(undefined, 'struggled', NOW, DEFAULT_CONFIG),
    };
    const { container } = show(history);
    const items = screen.getByRole('list', { name: 'Graves' }).children;
    expect(items[0].classList.contains('tablet')).toBe(true);
    expect(items[0].classList.contains('tablet-rest')).toBe(true);
    expect(items[1].classList.contains('tablet-restless')).toBe(true);
    expect(items[2].classList.contains('tablet-unmet')).toBe(true);
    expect(items[2].classList.contains('tablet-rest')).toBe(false);
    expect(container.innerHTML).not.toMatch(/grave-(rest|restless|wisp)/);
  });

  it('draws an aria-hidden hillside svg with no text behind the grid', () => {
    const { container } = show({});
    const svg = screen.getByTestId('hillside');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('text')).toBeNull();
    expect(svg.textContent).toBe('');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    const list = screen.getByRole('list', { name: 'Graves' });
    expect(svg.contains(list)).toBe(false);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('draws the fixed-height hillside with the theme fills and a hillNear ground', () => {
    show({});
    const svg = screen.getByTestId('hillside');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 48');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg.getAttribute('focusable')).toBe('false');
    for (const cls of ['absolute', 'left-0', 'top-0', 'h-48', 'w-full']) {
      expect(svg.classList.contains(cls), cls).toBe(true);
    }
    const fills = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills).toEqual([theme.hillFar, theme.hillNear]);
    const wrapper = svg.parentElement as HTMLElement;
    expect(wrapper.style.backgroundImage).toContain('linear-gradient(');
    expect(wrapper.style.backgroundImage).toContain('12rem');
    // jsdom may normalise #161e38 to rgb(22, 30, 56).
    expect(wrapper.style.backgroundImage.replace(/\s/g, '').toLowerCase()).toMatch(
      /(#161e38|rgb\(22,30,56\))/,
    );
  });

  it('gives each tablet the tilt class of its position mod 5', () => {
    show({});
    const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
    items.forEach((li, i) => {
      expect(li.classList.contains(`tablet-tilt-${(i + 1) % 5}`), `position ${i + 1}`).toBe(true);
    });
  });

  it('draws never-met tablets as blank stone and the others with solid or dashed edges', () => {
    const history: ReviewHistory = {
      [order[0]]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
      [order[1]]: applyReview(undefined, 'struggled', NOW, DEFAULT_CONFIG),
    };
    show(history);
    const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
    expect(items[0].classList.contains('border-solid')).toBe(true);
    expect(items[1].classList.contains('border-dashed')).toBe(true);
    for (const li of items.slice(2)) {
      expect(li.className).not.toMatch(/border/);
      expect(li.textContent).toBe('·');
    }
  });

  it('draws Back to menu as a slip', () => {
    show({});
    expect(screen.getByRole('button', { name: 'Back to menu' }).classList.contains('slip')).toBe(true);
  });

  it('calls onBack from the Back to menu button', () => {
    const onBack = vi.fn();
    show({}, onBack);
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
