import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntroScreen } from './IntroScreen';
import type { LegendResult } from '../data/legendStrokes';
import { GRAINS } from '../engine/grain';
import { contrastRatio, theme } from '../styles/theme';

// Validates: Requirements 1.2, 1.3, 1.6, 1.7, 1.8; proof-pass 13.6, 13.7, 13.9, 13.11 to 13.14, 13.21, 13.24

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../data/legendStrokes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/legendStrokes')>()),
  loadLegendStrokes: (...args: unknown[]) => mocks.load(...args),
}));
vi.mock('hanzi-writer', () => ({ default: { create: (...args: unknown[]) => mocks.create(...args) } }));

const FAILURE: LegendResult = { ok: false, reason: 'network' };

beforeEach(() => {
  mocks.load.mockReset();
  mocks.create.mockReset();
  // Default: the stroke file fails to load, so the intro takes the ink-reveal wipe.
  mocks.load.mockResolvedValue(FAILURE);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('IntroScreen', () => {
  it('renders the premise: Cangjie, weeping ghosts, forgotten characters are ghosts, summoned by shapes then written', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/Cangjie/);
    expect(text).toMatch(/invented\s+writing/i);
    expect(text).toMatch(/ghosts\s+wept/i);
    expect(text).toMatch(/night/i);
    expect(text).toMatch(/forgotten[\s\S]*are ghosts/i);
    expect(text.replace(/\s+/g, ' ')).toContain(
      "Type a ghost's shapes to summon it, then write it from memory.",
    );
    expect(text.replace(/\s+/g, ' ')).not.toContain('Type its shapes to summon it');
    expect(text).not.toMatch(/You lay each one to\s+rest by writing it/);
  });

  it('attributes the line to the Huainanzi and renders the original Chinese in a zh element', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getAllByText(/Huainanzi/).length).toBeGreaterThan(0);
    const zh = screen.getByText('天雨粟，鬼夜哭');
    expect(zh.closest('[lang]')?.getAttribute('lang')).toMatch(/^zh/);
    expect(container.querySelector('[lang^="zh"]')?.textContent).toBe('天雨粟，鬼夜哭');
  });

  it('makes no other historical claims: no years and no percentages', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b1[0-9]{3}\b|\b20[0-9]{2}\b/);
    expect(text).not.toMatch(/%/);
  });

  it('has a level-1 heading', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('has the Begin the Séance button and the Sources button, and no other', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Begin the Séance' })).toBeInTheDocument();
  });

  it('calls onBegin once when clicked', async () => {
    const onBegin = vi.fn();
    const user = userEvent.setup();
    render(<IntroScreen onBegin={onBegin} onOpenSources={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Begin the Séance' }));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('is keyboard operable: Tab focuses the button, Enter and Space each activate it', async () => {
    const onBegin = vi.fn();
    const user = userEvent.setup();
    render(<IntroScreen onBegin={onBegin} onOpenSources={() => {}} />);
    const button = screen.getByRole('button', { name: 'Begin the Séance' });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onBegin).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onBegin).toHaveBeenCalledTimes(2);
  });

  it('does not auto-advance without interaction', () => {
    vi.useFakeTimers();
    const onBegin = vi.fn();
    render(<IntroScreen onBegin={onBegin} onOpenSources={() => {}} />);
    vi.advanceTimersByTime(60_000);
    expect(onBegin).not.toHaveBeenCalled();
  });
});

describe('IntroScreen look (ink and candlelight)', () => {
  it('shows the shared ghost figure, hidden from assistive technology', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets the title in the display serif at text-4xl, text-5xl from sm', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('font-display', 'text-4xl', 'sm:text-5xl');
  });

  it('keeps the legend line as real static text in an ink-reveal blockquote, with no inline mask', async () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const figure = container.querySelector('figure');
    const quote = container.querySelector('blockquote');
    // The wipe class is set once the fallback phase starts (the loader failed).
    await waitFor(() => expect(quote).toHaveClass('ink-reveal'));
    expect(figure).not.toHaveClass('ink-reveal');
    expect(figure?.getAttribute('style') ?? '').not.toMatch(/mask/i);
    expect(quote?.getAttribute('style') ?? '').not.toMatch(/mask/i);
    const zh = screen.getByText('天雨粟，鬼夜哭');
    expect(zh.getAttribute('style') ?? '').not.toMatch(/mask/i);
    expect(screen.getByText(/ghosts wept at night/)).toBeInTheDocument();
  });

  it('sets the legend on a card-slip paper slip, not the grey surface box', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const figure = container.querySelector('figure') as HTMLElement;
    expect(figure).toHaveClass('card-slip');
    expect(figure).not.toHaveClass('bg-surface');
  });

  it('sets the Chinese line large (text-3xl, sm:text-4xl) with lang zh', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const zh = screen.getByText('天雨粟，鬼夜哭');
    expect(zh).toHaveClass('text-3xl', 'sm:text-4xl');
    expect(zh).toHaveAttribute('lang', 'zh');
  });

  it('leaves no grey text class inside the legend slip, so ink on paper is inherited', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const figure = container.querySelector('figure') as HTMLElement;
    for (const el of [figure, ...Array.from(figure.querySelectorAll('*'))]) {
      expect(el).not.toHaveClass('text-ghost');
      expect(el).not.toHaveClass('text-muted');
    }
  });

  it('gives "Begin the Séance" the primary class', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getByRole('button', { name: 'Begin the Séance' })).toHaveClass('slip-primary');
  });
});

describe('IntroScreen wrapper (Req 21.11)', () => {
  it('has no bg-background class on the wrapper', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getByRole('main')).not.toHaveClass('bg-background');
  });
});

describe('IntroScreen Sources link and fit (Req 23)', () => {
  it('shows no raw URL or citation text on the intro', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(container.textContent).not.toMatch(/http/);
  });
  it('keeps the caption sentence', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(
      screen.getByText(/The Huainanzi records this line about the time Cangjie created writing\./),
    ).toBeInTheDocument();
  });
  it('has a Sources button that calls onOpenSources and is neither slip nor slip-primary', async () => {
    const onOpenSources = vi.fn();
    render(<IntroScreen onBegin={() => {}} onOpenSources={onOpenSources} />);
    const btn = screen.getByRole('button', { name: 'Sources' });
    expect(btn).toHaveClass('underline', 'min-h-[44px]');
    expect(btn).not.toHaveClass('slip');
    expect(btn).not.toHaveClass('slip-primary');
    await userEvent.setup().click(btn);
    expect(onOpenSources).toHaveBeenCalledTimes(1);
  });
  it('has no min-h-screen on the root and a responsive title', () => {
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(screen.getByRole('main').className).not.toContain('min-h-screen');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('text-4xl', 'sm:text-5xl');
  });
});

const STROKE = { strokes: ['M0 0'], medians: [[[0, 0], [100, 100]]] };
const OK: LegendResult = {
  ok: true,
  strokes: Object.fromEntries([...'天雨粟鬼夜哭'].map((c) => [c, STROKE])),
};
const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const legendFigure = (c: HTMLElement) => c.querySelector('figure') as HTMLElement;
const stub = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: matches && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

describe('IntroScreen legend ink-in (proof-pass Requirement 13)', () => {
  it('reduced motion: inked at the first render, plain text, no fetch and no overlay', () => {
    stub(true);
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const fig = legendFigure(container);
    expect(fig).toHaveAttribute('data-legend-state', 'inked');
    expect(screen.getByText('天雨粟，鬼夜哭')).toBeInTheDocument();
    expect(container.querySelector('[data-legend-cell]')).toBeNull();
    expect(container.querySelector('blockquote')).not.toHaveClass('ink-reveal');
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(['network', 'status', 'json', 'empty'] as const)(
    'a %s failure takes the ink-reveal wipe, reaches inked and shows no message',
    async (reason) => {
      stub(false);
      vi.useFakeTimers();
      mocks.load.mockResolvedValue({ ok: false, reason });
      const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
      expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inking');
      await flush();
      expect(legendFigure(container)).toHaveAttribute('data-legend-phase', 'wipe');
      expect(container.querySelector('blockquote')).toHaveClass('ink-reveal');
      expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inking');
      await flush(700);
      expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inked');
      expect(container.querySelector('blockquote')).toHaveClass('ink-reveal');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(container.textContent).not.toMatch(/error|fail|could not|try again/i);
      await flush(10_000);
      expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inked');
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it('success: inks the characters one at a time in order, wipes the comma, and ends inked', async () => {
    stub(false);
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(OK);
    const finishers: Array<() => void> = [];
    mocks.create.mockImplementation(() => ({
      animateCharacter: () => new Promise<void>((resolve) => finishers.push(resolve)),
    }));
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const fig = legendFigure(container);
    const cells = () => [...container.querySelectorAll('[data-legend-cell]')];
    await flush();
    expect(fig).toHaveAttribute('data-legend-phase', 'ink');
    expect(cells().map((c) => c.getAttribute('data-legend-cell')).join('')).toBe('天雨粟，鬼夜哭');
    const seen: string[] = [];
    const order = [...'天雨粟'];
    for (let n = 0; n < order.length; n += 1) {
      expect(mocks.create).toHaveBeenCalledTimes(n + 1);
      expect(mocks.create.mock.calls[n]?.[1]).toBe(order[n]);
      expect(cells()[n]).toHaveAttribute('data-ink', 'active');
      expect(cells()[n + 1]).toHaveAttribute('data-ink', 'pending');
      expect(fig).toHaveAttribute('data-legend-state', 'inking');
      seen.push(cells()[n]?.getAttribute('data-ink') ?? '');
      await act(async () => finishers[n]?.());
      await flush();
      expect(cells()[n]).toHaveAttribute('data-ink', 'done');
    }
    // The comma is a wipe: the existing 600 ms ink-reveal, no writer.
    expect(cells()[3]).toHaveAttribute('data-ink', 'active');
    expect(cells()[3]).toHaveClass('ink-reveal');
    expect(mocks.create).toHaveBeenCalledTimes(3);
    await flush(599);
    expect(cells()[3]).toHaveAttribute('data-ink', 'active');
    await flush(1);
    expect(cells()[3]).toHaveAttribute('data-ink', 'done');
    for (let n = 0; n < 3; n += 1) {
      expect(mocks.create).toHaveBeenCalledTimes(4 + n);
      await act(async () => finishers[3 + n]?.());
      await flush();
    }
    expect(fig).toHaveAttribute('data-legend-state', 'inked');
    expect(fig).toHaveAttribute('data-legend-phase', 'done');
    await flush(10_000);
    expect(fig).toHaveAttribute('data-legend-state', 'inked');
    expect(screen.getByText('天雨粟，鬼夜哭')).toHaveAttribute('lang', 'zh');
    expect(container.querySelector('blockquote')).not.toHaveClass('ink-reveal');
  });

  it('hands hanzi-writer the file data, the plan speed, no stroke delay and no fade', async () => {
    stub(false);
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(OK);
    mocks.create.mockImplementation(() => ({ animateCharacter: () => Promise.resolve() }));
    render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    await flush();
    const opts = mocks.create.mock.calls[0]?.[2] as {
      delayBetweenStrokes: number;
      strokeFadeDuration: number;
      strokeAnimationSpeed: number;
      showCharacter: boolean;
      charDataLoader: (c: string, ok: (d: unknown) => void, err: (e?: unknown) => void) => void;
    };
    expect(opts.delayBetweenStrokes).toBe(0);
    expect(opts.strokeFadeDuration).toBe(0);
    expect(opts.showCharacter).toBe(false);
    expect(opts.strokeAnimationSpeed).toBeGreaterThan(0);
    const onLoad = vi.fn();
    opts.charDataLoader('天', onLoad, () => {});
    expect(onLoad).toHaveBeenCalledWith(STROKE);
  });

  it('a writer that throws wipes its cell and the line still reaches inked', async () => {
    stub(false);
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(OK);
    mocks.create.mockImplementation(() => {
      throw new Error('boom');
    });
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    for (let i = 0; i < 8; i += 1) await flush(600);
    expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inked');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reaches inked within 6000 ms even if the file never loads', async () => {
    stub(false);
    vi.useFakeTimers();
    mocks.load.mockReturnValue(new Promise(() => {}));
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    await flush(5999);
    expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inking');
    await flush(1);
    expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inked');
  });

  it('exposes the whole line once as text and the drawn strokes as nothing', async () => {
    stub(false);
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(OK);
    mocks.create.mockImplementation(() => ({ animateCharacter: () => new Promise<void>(() => {}) }));
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    await flush();
    expect(screen.getAllByText('天雨粟，鬼夜哭')).toHaveLength(1);
    const cell = container.querySelector('[data-legend-cell]') as HTMLElement;
    expect(cell.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll('p[lang="zh"]')).toHaveLength(1);
    expect(container.querySelector('p[lang="zh"]')?.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps both buttons focusable and activatable while the ink runs', async () => {
    stub(false);
    mocks.load.mockResolvedValue(OK);
    mocks.create.mockImplementation(() => ({ animateCharacter: () => new Promise<void>(() => {}) }));
    const onBegin = vi.fn();
    const onOpenSources = vi.fn();
    const { container } = render(<IntroScreen onBegin={onBegin} onOpenSources={onOpenSources} />);
    await waitFor(() => expect(legendFigure(container)).toHaveAttribute('data-legend-phase', 'ink'));
    expect(legendFigure(container)).toHaveAttribute('data-legend-state', 'inking');
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Begin the Séance' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sources' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Begin the Séance' }));
    await user.click(screen.getByRole('button', { name: 'Sources' }));
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onOpenSources).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.slip-primary')).toHaveLength(1);
    expect(container.querySelector('[data-legend-cell]')?.closest('button')).toBeNull();
  });
});

describe('IntroScreen Grain_Fall (proof-pass Requirement 13, ACs 16 to 19, 22, 25)', () => {
  const grains = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.legend-grain .grain')];

  it('reduced motion renders no grain at all', () => {
    stub(true);
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    expect(container.querySelector('.legend-grain')).toBeNull();
    expect(grains(container)).toHaveLength(0);
  });

  it('renders at most 24 grains from the fixed table inside one aria-hidden, inert layer', () => {
    stub(false);
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const layer = container.querySelector('.legend-grain') as HTMLElement;
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('main')?.firstElementChild).toBe(layer);
    expect(grains(container)).toHaveLength(GRAINS.length);
    expect(grains(container).length).toBeLessThanOrEqual(24);
  });

  it('draws each grain in the ink token at its alpha (0.35 at most), never seal or candle', () => {
    stub(false);
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const ink = theme.ink.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(ink.slice(i, i + 2), 16));
    grains(container).forEach((el, i) => {
      const grain = GRAINS[i]!;
      expect(el).toHaveClass(`grain-${grain.speed}`);
      expect(el.style.backgroundColor).toBe(`rgba(${r}, ${g}, ${b}, ${grain.alpha})`);
      expect(grain.alpha).toBeLessThanOrEqual(0.35);
      expect(el.getAttribute('style') ?? '').not.toMatch(/#|candle|seal/i);
      expect(el.style.animationDelay).toBe(`${grain.delayS}s`);
    });
  });

  it('keeps the legend text at 4.5:1 with a grain at maximum alpha behind it', () => {
    const maxAlpha = Math.max(...GRAINS.map((g) => g.alpha));
    expect(maxAlpha).toBeLessThanOrEqual(0.35);
    const hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
    const over = (ground: string) =>
      '#' +
      hex(theme.ink)
        .map((c, k) =>
          Math.round(c * maxAlpha + (hex(ground)[k] ?? 0) * (1 - maxAlpha)).toString(16).padStart(2, '0'),
        )
        .join('');
    // The ink text sits on the dark page (design: about 5.35:1) or the lightest sky stop.
    for (const ground of [theme.background, theme.nightLow]) {
      expect(contrastRatio(theme.ink, over(ground)), ground).toBeGreaterThanOrEqual(4.5);
    }
  });
});
