import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import { Graveyard } from './Graveyard';
import type { GraveyardProps } from './Graveyard';
import { graveyardOrder } from '../engine/graveyardOrder';
import { learningOrder } from '../engine/learningOrder';
import { applyReview } from '../engine/scheduler';
import type { ReviewHistory } from '../engine/scheduler';
import { DEFAULT_CONFIG } from '../engine/config';
import { NEAR_RIDGE_PATH, TABLET_TUFT_SCALE } from '../engine/grassPattern';
import { columnCount } from '../engine/graveyardRows';
import { theme } from '../styles/theme';
import raw from '../../public/data/characters.json';

const dataset: CharacterDataset = new Map(
  Object.entries(raw as unknown as Record<string, CharacterRecord>),
);
// Level 1 is shown in graveyardOrder: the Guided_Ghost first, then learningOrder.
const order = graveyardOrder(1, learningOrder(dataset), dataset);
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

/** A wrapper width (px) whose column count is `n`: 12 px padding twice, 8 px gaps, 48 px tracks. */
const widthFor = (n: number) => 56 * n + 16;
/** Wide enough for one row of every grave, so every grave of a level is shown. */
const ALL = widthFor(300);
let wrapperWidth = widthFor(6);
beforeEach(() => {
  wrapperWidth = widthFor(6);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => wrapperWidth);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function show(
  history: ReviewHistory,
  onBack: () => void = () => {},
  extra: Partial<GraveyardProps> = {},
) {
  return render(
    <Graveyard
      dataset={dataset}
      level={1}
      chosenLevel={1}
      history={history}
      now={NOW}
      status={{ kind: 'idle' }}
      onChangeLevel={() => {}}
      onBack={onBack}
      {...extra}
    />,
  );
}

describe('Graveyard', () => {
  it('shows one item per record when one row holds every grave', () => {
    wrapperWidth = ALL;
    show({});
    expect(screen.getByRole('list', { name: 'Graves' }).children).toHaveLength(dataset.size);
  });

  it('names graves 1 and 2 while unmet, and grave 1 carries no Han character', () => {
    show({});
    const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
    expect(items[0].getAttribute('aria-label')).toBe('Ghost 1 of 300, never met');
    expect(items[1].getAttribute('aria-label')).toBe('Ghost 2 of 300, never met');
    expect(screen.getByLabelText('Ghost 1 of 300, never met')).toBe(items[0]);
    expect(items[0].textContent).toBe('·');
    expect(items[0].outerHTML).not.toMatch(/\p{Script=Han}/u);
  });

  it('numbers the graves 1 to 300 in displayed order, the Guided_Ghost first', () => {
    const guided = order[0];
    expect(guided).not.toBe(learningOrder(dataset)[0]);
    wrapperWidth = ALL;
    show({ [guided]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG) });
    const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
    expect(items[0].getAttribute('aria-label')).toBe(`${guided}, at rest, 1 clean in a row`);
    expect(items[1].getAttribute('aria-label')).toBe('Ghost 2 of 300, never met');
    expect(items[299].getAttribute('aria-label')).toBe('Ghost 300 of 300, never met');
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
      wrapperWidth = ALL;
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
    // Grass tufts are svgs too; the hillside is the only svg outside them.
    expect(Array.from(container.querySelectorAll('svg')).filter((e) => !e.closest('[data-grass]'))).toHaveLength(1);
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
    wrapperWidth = ALL;
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

  describe('grass', () => {
    const history: ReviewHistory = {
      [order[0]]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
      [order[1]]: applyReview(undefined, 'struggled', NOW, DEFAULT_CONFIG),
    };

    it('puts two hidden, click-through tablet tufts behind the content of every li', () => {
      wrapperWidth = ALL;
      show(history);
      const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
      expect(items).toHaveLength(dataset.size);
      for (const li of items) {
        const tufts = li.querySelectorAll('[data-grass="tablet"]');
        expect(tufts).toHaveLength(2);
        for (const tuft of Array.from(tufts)) {
          expect(tuft.parentElement).toBe(li);
          expect(tuft.getAttribute('aria-hidden')).toBe('true');
          for (const cls of ['-z-10', 'pointer-events-none', 'absolute', 'bottom-0']) {
            expect(tuft.classList.contains(cls), cls).toBe(true);
          }
          expect(tuft.textContent).toBe('');
          expect(tuft.querySelectorAll('svg')).toHaveLength(1);
          const svg = tuft.querySelector('svg') as SVGElement;
          expect(svg.getAttribute('width')).toBe(String(24 * TABLET_TUFT_SCALE));
        }
        const [first, second] = Array.from(tufts) as HTMLElement[];
        const dx = (e: HTMLElement) => parseFloat(e.style.marginLeft) + 9.6;
        if (Math.abs(dx(first)) < 1e-9) expect(dx(second)).toBeGreaterThan(0);
        else expect(Math.sign(dx(first))).toBe(-Math.sign(dx(second)));
        expect(li.className).not.toMatch(/overflow/);
      }
    });

    it('gives the three tablet states the same tuft and keeps their text and Marker', () => {
      show(history);
      const items = Array.from(screen.getByRole('list', { name: 'Graves' }).children);
      const [rest, restless, unmet] = items;
      for (const li of [rest, restless, unmet]) {
        const tufts = li.querySelectorAll('[data-grass="tablet"]');
        expect(tufts).toHaveLength(2);
        for (const t of Array.from(tufts)) expect(t.className).toBe('pointer-events-none absolute bottom-0 -z-10');
      }
      expect(rest.textContent).toBe(`${order[0]}✓`);
      expect(restless.textContent).toBe(`${order[1]}!`);
      expect(unmet.textContent).toBe('·');
      expect(rest.querySelector('[lang="zh"]')?.textContent).toBe(order[0]);
      const restTufts = rest.querySelectorAll('[data-grass]');
      expect(restTufts[restTufts.length - 1].nextElementSibling?.getAttribute('lang')).toBe('zh');
    });

    it('draws 24 hill tufts between the hillside svg and the grid', () => {
      show({});
      const hill = Array.from(document.querySelectorAll('[data-grass="hill"]'));
      expect(hill).toHaveLength(24);
      const svg = screen.getByTestId('hillside');
      const list = screen.getByRole('list', { name: 'Graves' });
      for (const h of hill) {
        expect(h.getAttribute('aria-hidden')).toBe('true');
        expect(h.classList.contains('pointer-events-none')).toBe(true);
        expect(h.parentElement).toBe(svg.parentElement);
        expect(svg.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(h.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect((h as HTMLElement).style.zIndex).toBe('');
      }
    });

    it('draws the near ridge from the shared path', () => {
      show({});
      expect(screen.getByTestId('hillside').querySelectorAll('path')[1].getAttribute('d')).toBe(
        NEAR_RIDGE_PATH,
      );
    });

    it('draws the far ridge from the shared path', () => {
      show({});
      expect(screen.getByTestId('hillside').querySelectorAll('path')[0].getAttribute('d')).toBe(
        'M0 22 C18 14 34 22 52 16 C72 10 88 18 100 14 L100 48 L0 48 Z',
      );
    });

    it('keeps the list structure: 300 listitems in Graves, no extra list items', () => {
      wrapperWidth = ALL;
      show({});
      expect(screen.getByRole('list', { name: 'Graves' }).querySelectorAll('li')).toHaveLength(dataset.size);
      expect(screen.getAllByRole('listitem')).toHaveLength(dataset.size + 3);
    });
  });

  describe('levels', () => {
    // A smaller dataset of real records stands in for another level.
    const smaller: CharacterDataset = new Map(Array.from(dataset.entries()).slice(0, 40));
    const smallOrder = learningOrder(smaller);

    it('shows level 1 pressed with the "showing" cue by default and the others not', () => {
      show({});
      const group = screen.getByRole('group', { name: 'Level' });
      const slips = Array.from(group.querySelectorAll('button'));
      expect(slips.map((b) => b.textContent)).toEqual(['Level 1showing', 'Level 2', 'Level 3']);
      expect(slips.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
      expect(screen.getByRole('button', { name: 'Level 1' }).classList.contains('slip')).toBe(true);
      expect(screen.getAllByText('showing')).toHaveLength(1);
    });

    it('marks the shown level, which can differ from the chosen level', () => {
      show({}, undefined, { level: 3, chosenLevel: 1, dataset: smaller });
      expect(screen.getByRole('button', { name: 'Level 3' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Level 1' }).getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByText(/ghosts of level 3/)).toBeTruthy();
      expect(screen.getByText(/draw new ghosts from level 1/)).toBeTruthy();
    });

    it('calls onChangeLevel with the level of the activated slip', () => {
      const onChangeLevel = vi.fn();
      show({}, undefined, { onChangeLevel });
      fireEvent.click(screen.getByRole('button', { name: 'Level 2' }));
      expect(onChangeLevel).toHaveBeenCalledWith(2);
    });

    it('says the graves are the ghosts of the shown level', () => {
      show({});
      expect(screen.getByText(/These graves are the ghosts of level 1/)).toBeTruthy();
    });

    it('level 1 explains that the guided first ghost comes first', () => {
      show({});
      expect(
        screen.getByText(
          'These graves are the ghosts of level 1. The guided first ghost comes first, then the rest in the order you will meet them. A ghost you have not met stays hidden.',
        ),
      ).toBeTruthy();
    });

    it('levels 2 and 3 keep the plain explanation', () => {
      for (const n of [2, 3] as const) {
        const { unmount } = show({}, undefined, { level: n, dataset: smaller });
        expect(
          screen.getByText(
            `These graves are the ghosts of level ${n}, in the order you will meet them. A ghost you have not met stays hidden.`,
          ),
        ).toBeTruthy();
        expect(screen.queryByText(/guided first ghost/)).toBeNull();
        unmount();
      }
    });

    it('counts add up to the shown level count and labels use that count', () => {
      const history: ReviewHistory = {
        [smallOrder[0]]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
        [smallOrder[1]]: applyReview(undefined, 'struggled', NOW, DEFAULT_CONFIG),
      };
      wrapperWidth = widthFor(40);
      show(history, undefined, { level: 2, dataset: smaller });
      expect(screen.getByText('Never met: 38')).toBeTruthy();
      expect(screen.getByText('Restless: 1')).toBeTruthy();
      expect(screen.getByText('At rest: 1')).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Graves' }).children).toHaveLength(40);
      expect(screen.getByLabelText('Ghost 3 of 40, never met')).toBeTruthy();
    });

    it('carries no never-met character in text or attributes and shows met glyphs of the shown level', () => {
      const history: ReviewHistory = {
        [smallOrder[0]]: applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG),
      };
      const { container } = show(history, undefined, { level: 2, dataset: smaller });
      const html = container.innerHTML;
      expect(html.includes(smallOrder[0])).toBe(true);
      for (const ch of smaller.keys()) {
        if (ch !== smallOrder[0]) expect(html.includes(ch), ch).toBe(false);
      }
      const rest = screen.getByLabelText(`${smallOrder[0]}, at rest, 1 clean in a row`);
      expect(rest.textContent).toContain(smallOrder[0]);
    });

    it('shows the loading status in place of the graves while the dataset is null', () => {
      show({}, undefined, { level: 2, dataset: null, status: { kind: 'loading', level: 2 } });
      expect(screen.getByRole('status').textContent).toBe('Loading level 2…');
      expect(screen.queryByRole('list', { name: 'Graves' })).toBeNull();
      expect(screen.queryByTestId('hillside')).toBeNull();
    });

    it('on failure shows the alert and keeps the previous level and its graves', () => {
      wrapperWidth = ALL;
      show({}, undefined, { level: 1, status: { kind: 'failed', level: 2 } });
      expect(screen.getByRole('alert').textContent).toBe(
        'Level 2 could not be loaded. Check your connection and try again.',
      );
      expect(screen.getByRole('button', { name: 'Level 1' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Level 2' }).getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('list', { name: 'Graves' }).children).toHaveLength(dataset.size);
    });
  });
});

describe('Graveyard shown rows (proof-pass Req 12)', () => {
  const metAt = (...idx: number[]): ReviewHistory =>
    Object.fromEntries(idx.map((i) => [order[i], applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG)]));
  const items = () => Array.from(screen.getByRole('list', { name: 'Graves' }).children);
  const paragraph = (re: RegExp) => screen.queryByText(re);

  it('with no Met_Ghost shows one blank row and the paragraph for the rest', () => {
    show({});
    expect(items()).toHaveLength(6);
    expect(screen.getByText('294 ghosts not yet met')).toBeTruthy();
  });

  it('keeps the paragraph after and outside the list and the hillside wrapper', () => {
    show({});
    const p = screen.getByText('294 ghosts not yet met');
    const list = screen.getByRole('list', { name: 'Graves' });
    expect(p.tagName).toBe('P');
    expect(list.contains(p)).toBe(false);
    expect(screen.getByTestId('hillside').parentElement?.contains(p)).toBe(false);
    expect(list.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a Met_Ghost in the first row shows that row and one more', () => {
    show(metAt(0));
    expect(items()).toHaveLength(12);
    expect(screen.getByText('288 ghosts not yet met')).toBeTruthy();
  });

  it('a Met_Ghost in the second row shows three rows', () => {
    show(metAt(0, 7));
    expect(items()).toHaveLength(18);
    expect(screen.getByText('282 ghosts not yet met')).toBeTruthy();
  });

  it('shows blank rows between Met_Ghosts and the last one', () => {
    show(metAt(2, 40));
    // index 40 is in row 7 (6 per row), so rows 1 to 8 show.
    expect(items()).toHaveLength(48);
    expect(items()[20].getAttribute('aria-label')).toBe('Ghost 21 of 300, never met');
  });

  it('shows a last row that is not full and the plural paragraph', () => {
    wrapperWidth = widthFor(7);
    show(metAt(280)); // row 40 (0-based) of 7 columns, so 42 rows = 294 graves
    expect(items()).toHaveLength(294);
    expect(screen.getByText('6 ghosts not yet met')).toBeTruthy();
  });

  it('says "1 ghost not yet met" when exactly one grave collapses', () => {
    wrapperWidth = widthFor(13);
    show(metAt(273)); // row 21 of 13 columns, so 23 rows = 299 graves
    expect(items()).toHaveLength(299);
    expect(screen.getByText('1 ghost not yet met')).toBeTruthy();
    expect(paragraph(/1 ghosts/)).toBeNull();
  });

  it('shows no paragraph when nothing is collapsed', () => {
    wrapperWidth = ALL;
    show({});
    expect(items()).toHaveLength(300);
    expect(paragraph(/not yet met/)).toBeNull();
  });

  it('renders no li and no glyph for a collapsed grave, and keeps the full position and total in names', () => {
    const { container } = show(metAt(0));
    expect(screen.queryByLabelText('Ghost 13 of 300, never met')).toBeNull();
    expect(screen.getByLabelText('Ghost 12 of 300, never met')).toBeTruthy();
    expect(container.querySelectorAll('li[aria-label^="Ghost"]')).toHaveLength(11);
    for (const ch of order.slice(1)) expect(container.innerHTML.includes(ch)).toBe(false);
    expect(container.querySelectorAll('[data-grass="tablet"]')).toHaveLength(24);
  });

  it('keeps the legend counts over all graves of the level', () => {
    show(metAt(0, 1));
    expect(screen.getByText('Never met: 298')).toBeTruthy();
    expect(screen.getByText('At rest: 2')).toBeTruthy();
    expect(screen.getByText('Restless: 0')).toBeTruthy();
    expect(items()).toHaveLength(12);
  });

  it('updates the shown graves and the paragraph in the same render when the width changes', () => {
    show({});
    expect(items()).toHaveLength(6);
    wrapperWidth = widthFor(10);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(items()).toHaveLength(10);
    expect(screen.getByText('290 ghosts not yet met')).toBeTruthy();
  });

  it('follows a ResizeObserver where there is one, and disconnects it on unmount', () => {
    let callback: () => void = () => {};
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const { unmount } = show({});
    expect(items()).toHaveLength(6);
    wrapperWidth = widthFor(8);
    act(() => callback());
    expect(items()).toHaveLength(8);
    expect(columnCount(wrapperWidth)).toBe(8);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('Graveyard review slip (proof-pass Req 10.4, 10.5, 10.7, 10.8, 10.9, 10.32)', () => {
  const NAME = 'Review restless ghosts (4)';
  it('shows the slip with the count and calls onReviewRestless', () => {
    const onReviewRestless = vi.fn();
    show({}, () => {}, { restlessCount: 4, onReviewRestless });
    fireEvent.click(screen.getByRole('button', { name: NAME }));
    expect(onReviewRestless).toHaveBeenCalledTimes(1);
  });
  it('is absent when the count is 0', () => {
    show({}, () => {}, { restlessCount: 0, onReviewRestless: () => {} });
    expect(screen.queryByRole('button', { name: /Review restless ghosts/ })).toBeNull();
  });
  it('is a slip, not a slip-primary, at least 44 px high', () => {
    show({}, () => {}, { restlessCount: 4, onReviewRestless: () => {} });
    const slip = screen.getByRole('button', { name: NAME });
    expect(slip.classList.contains('slip')).toBe(true);
    expect(slip.className).not.toContain('slip-primary');
    expect(slip.className).toContain('min-h-[44px]');
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(0);
  });
  it('shows the alert text after a failed start', () => {
    show({}, () => {}, { reviewError: true });
    expect(screen.getByRole('alert').textContent).toBe(
      'The review could not start. Check your connection and try again.',
    );
  });
});
