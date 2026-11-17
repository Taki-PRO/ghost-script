import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntroScreen } from './IntroScreen';

// Validates: Requirements 1.2, 1.3, 1.6, 1.7, 1.8

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  it('keeps the legend line as real static text in an ink-reveal blockquote, with no inline mask', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} onOpenSources={() => {}} />);
    const figure = container.querySelector('figure');
    const quote = container.querySelector('blockquote');
    expect(quote).toHaveClass('ink-reveal');
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
