import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartMenu } from './StartMenu';
import { SoundProvider } from '../audio/SoundProvider';
import type { SoundEngine } from '../audio/engine';
import { STORAGE_KEY } from '../storage/storage';
import App from '../App';
import raw from '../../public/data/characters.json';

const wind = vi.hoisted(() => ({ calls: [] as string[] }));

// A fake engine behind the real provider (used by the App tests below only).
vi.mock('../audio/engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('../audio/engine')>();
  return {
    ...original,
    createSoundEngine: () => ({
      play: () => undefined,
      setEnabled: () => undefined,
      setAmbience: (w: boolean) => void wind.calls.push(`ambience:${w}`),
      unlock: () => undefined,
      suspend: () => undefined,
      dispose: () => undefined,
    }),
  };
});

const BEGIN = 'Begin a Nightly Séance';
const LEGEND = 'Read the legend again';
const GUIDE = 'How Cangjie works';
const GRAVEYARD = 'Graveyard';
const CREDITS = 'Sources & licences';
const CAPTION = 'Where the words, strokes, codes and fonts come from.';

type Notice = React.ComponentProps<typeof StartMenu>['finishedNotice'];

function setup(opts: { level?: 1 | 2 | 3; finishedNotice?: Notice } = {}) {
  const onChooseLevel = vi.fn();
  const onStartSeance = vi.fn();
  const onReviewLegend = vi.fn();
  const onReviewCangjieGuide = vi.fn();
  const onOpenGraveyard = vi.fn();
  const onOpenCredits = vi.fn();
  render(
    <StartMenu
      onStartSeance={onStartSeance}
      onReviewLegend={onReviewLegend}
      onReviewCangjieGuide={onReviewCangjieGuide}
      onOpenGraveyard={onOpenGraveyard}
      onOpenCredits={onOpenCredits}
      level={opts.level ?? 1}
      onChooseLevel={onChooseLevel}
      finishedNotice={opts.finishedNotice ?? null}
    />,
  );
  return {
    onStartSeance,
    onReviewLegend,
    onReviewCangjieGuide,
    onOpenGraveyard,
    onOpenCredits,
    onChooseLevel,
    user: userEvent.setup(),
  };
}

afterEach(() => cleanup());

describe('StartMenu (Req 1.5, 3.6, 7.1, 7.2, 9.4)', () => {
  it('renders a heading and exactly six named buttons in order', () => {
    setup();
    expect(screen.getByRole('heading')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      BEGIN,
      'Starting level: 1',
      LEGEND,
      GUIDE,
      GRAVEYARD,
      CREDITS,
    ]);
  });

  it('shows a hidden ghost figure before the single display-font h1', () => {
    setup();
    const h1s = document.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    const h1 = h1s[0];
    expect(h1.className).toContain('font-display');
    expect(h1.className).toContain('text-5xl');
    const svg = document.querySelector('svg.menu-figure');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(
      svg!.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(svg!.closest('.moon-glow')).toBe(h1.closest('.moon-glow'));
  });

  it('gives only the first button the seal-red primary class; the other five are paper slips', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('slip-primary');
    expect(buttons[0].className).not.toMatch(/candle/);
    expect(buttons[0].className).toContain('focus-visible:ring-2');
    for (const b of buttons.slice(1)) {
      expect(b.classList.contains('slip')).toBe(true);
      expect(b.className).not.toContain('slip-primary');
      expect(b.className).not.toMatch(/candle/);
    }
    expect(document.querySelector('main')?.className).not.toContain('bg-background');
  });

  it('shows the exact Sources caption and describes the button with it', () => {
    setup();
    expect(screen.getByText(CAPTION).textContent).toBe(CAPTION);
    const button = screen.getByRole('button', { name: CREDITS });
    expect(button.getAttribute('aria-describedby')).toBe('menu-sources-hint');
    expect(document.getElementById('menu-sources-hint')?.textContent).toBe(CAPTION);
  });

  it('shows no visible text or accessible name containing "credits"', () => {
    setup();
    expect(document.body.textContent ?? '').not.toMatch(/\bcredits\b/i);
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('aria-label') ?? '').not.toMatch(/\bcredits\b/i);
    }
  });

  it('offers no mode choice', () => {
    setup();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByText(/write mode|build mode|cangjie mode/i)).toBeNull();
  });

  it('Begin calls only onStartSeance', async () => {
    const { onStartSeance, onReviewLegend, onReviewCangjieGuide, user } = setup();
    await user.click(screen.getByRole('button', { name: BEGIN }));
    expect(onStartSeance).toHaveBeenCalledTimes(1);
    expect(onReviewLegend).not.toHaveBeenCalled();
    expect(onReviewCangjieGuide).not.toHaveBeenCalled();
  });

  it('Read the legend again calls only onReviewLegend', async () => {
    const { onStartSeance, onReviewLegend, onReviewCangjieGuide, user } = setup();
    await user.click(screen.getByRole('button', { name: LEGEND }));
    expect(onReviewLegend).toHaveBeenCalledTimes(1);
    expect(onStartSeance).not.toHaveBeenCalled();
    expect(onReviewCangjieGuide).not.toHaveBeenCalled();
  });

  it('How Cangjie works calls only onReviewCangjieGuide', async () => {
    const { onStartSeance, onReviewLegend, onReviewCangjieGuide, user } = setup();
    await user.click(screen.getByRole('button', { name: GUIDE }));
    expect(onReviewCangjieGuide).toHaveBeenCalledTimes(1);
    expect(onStartSeance).not.toHaveBeenCalled();
    expect(onReviewLegend).not.toHaveBeenCalled();
  });

  it('Graveyard calls only onOpenGraveyard', async () => {
    const m = setup();
    await m.user.click(screen.getByRole('button', { name: GRAVEYARD }));
    expect(m.onOpenGraveyard).toHaveBeenCalledTimes(1);
    expect(m.onOpenCredits).not.toHaveBeenCalled();
    expect(m.onStartSeance).not.toHaveBeenCalled();
    expect(m.onReviewLegend).not.toHaveBeenCalled();
    expect(m.onReviewCangjieGuide).not.toHaveBeenCalled();
  });

  it('Sources & licences calls only onOpenCredits', async () => {
    const m = setup();
    await m.user.click(screen.getByRole('button', { name: CREDITS }));
    expect(m.onOpenCredits).toHaveBeenCalledTimes(1);
    expect(m.onOpenGraveyard).not.toHaveBeenCalled();
    expect(m.onStartSeance).not.toHaveBeenCalled();
    expect(m.onReviewLegend).not.toHaveBeenCalled();
    expect(m.onReviewCangjieGuide).not.toHaveBeenCalled();
  });

  it('is keyboard operable in order, Enter fires the right callback', async () => {
    const { onStartSeance, onReviewLegend, onReviewCangjieGuide, onOpenGraveyard, onOpenCredits, user } =
      setup();
    const begin = screen.getByRole('button', { name: BEGIN });
    const legend = screen.getByRole('button', { name: LEGEND });
    const guide = screen.getByRole('button', { name: GUIDE });
    const graveyard = screen.getByRole('button', { name: GRAVEYARD });
    const credits = screen.getByRole('button', { name: CREDITS });

    await user.tab();
    expect(document.activeElement).toBe(begin);
    await user.keyboard('{Enter}');
    expect(onStartSeance).toHaveBeenCalledTimes(1);
    expect(onReviewLegend).not.toHaveBeenCalled();

    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(legend);
    await user.keyboard('{Enter}');
    expect(onReviewLegend).toHaveBeenCalledTimes(1);
    expect(onStartSeance).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(document.activeElement).toBe(guide);
    await user.keyboard('{Enter}');
    expect(onReviewCangjieGuide).toHaveBeenCalledTimes(1);
    expect(onStartSeance).toHaveBeenCalledTimes(1);
    expect(onReviewLegend).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(document.activeElement).toBe(graveyard);
    await user.keyboard('{Enter}');
    expect(onOpenGraveyard).toHaveBeenCalledTimes(1);
    expect(onOpenCredits).not.toHaveBeenCalled();

    await user.tab();
    expect(document.activeElement).toBe(credits);
    await user.keyboard('{Enter}');
    expect(onOpenCredits).toHaveBeenCalledTimes(1);
    expect(onOpenGraveyard).toHaveBeenCalledTimes(1);
  });

  it('all buttons are type="button" with a 44px minimum height', () => {
    setup();
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.className).toContain('min-h-[44px]');
      expect(b.className).toContain('focus-visible:ring-2');
    }
  });
});

describe('StartMenu level slip and finished notice (Req 7.1, 7.5, 8.6, 8.7)', () => {
  it('shows "Starting level: N" directly under Begin and calls onChooseLevel', async () => {
    const m = setup({ level: 2 });
    const slip = screen.getByRole('button', { name: 'Starting level: 2' });
    const begin = screen.getByRole('button', { name: BEGIN });
    expect(begin.nextElementSibling).toBe(slip);
    expect(slip.classList.contains('slip')).toBe(true);
    expect(slip.className).not.toContain('slip-primary');
    await m.user.click(slip);
    expect(m.onChooseLevel).toHaveBeenCalledTimes(1);
    expect(m.onStartSeance).not.toHaveBeenCalled();
  });

  it('shows no notice when finishedNotice is null', () => {
    setup({ level: 1 });
    expect(screen.queryByText(/You have met every ghost/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Move on to level/ })).toBeNull();
  });

  it.each([1, 2] as const)('level %i notice shows the line and a Move on slip', async (n) => {
    const onClick = vi.fn();
    const m = setup({
      level: n,
      finishedNotice: {
        text: `You have met every ghost of level ${n}.`,
        moveOn: { label: `Move on to level ${n + 1}`, onClick },
      },
    });
    expect(screen.getByText(`You have met every ghost of level ${n}.`)).toBeTruthy();
    const move = screen.getByRole('button', { name: `Move on to level ${n + 1}` });
    expect(move.classList.contains('slip')).toBe(true);
    expect(move.className).not.toContain('slip-primary');
    await m.user.click(move);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(m.onStartSeance).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
  });

  it('level 3 notice shows the line and no Move on slip', () => {
    setup({
      level: 3,
      finishedNotice: { text: 'You have met every ghost of level 3.' },
    });
    expect(screen.getByText('You have met every ghost of level 3.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Move on to level/ })).toBeNull();
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
  });
});

describe('StartMenu fits one screen (proof-pass Req 9)', () => {
  it('has no min-h-screen on the root and uses py-4', () => {
    setup();
    const main = document.querySelector('main')!;
    expect(main.className).not.toContain('min-h-screen');
    expect(main.className).toContain('py-4');
  });

  it('uses the smaller figure, py-2 slips and a gap-2 column', () => {
    setup();
    const svg = document.querySelector('svg.menu-figure')!;
    expect(svg.getAttribute('class')).toContain('h-14');
    expect(svg.getAttribute('class')).toContain('w-12');
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('py-2');
      expect(b.className).not.toContain('py-3');
      expect(b.className).toContain('min-h-[44px]');
    }
    expect(screen.getByRole('button', { name: BEGIN }).parentElement?.className).toContain('gap-2');
  });

  it('keeps one slip-primary and the sources hint with the notice shown', () => {
    setup({
      finishedNotice: {
        text: 'You have met every ghost of level 1.',
        moveOn: { label: 'Move on to level 2', onClick: vi.fn() },
      },
    });
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
    expect(document.getElementById('menu-sources-hint')?.textContent).toBe(CAPTION);
    expect(document.getElementById('menu-sources-hint')?.className).toContain('text-sm');
  });
});

describe('StartMenu review slip (proof-pass Req 10.2 to 10.9, 10.32, 10.33)', () => {
  const REVIEW = 'Review restless ghosts (3)';
  const renderMenu = (extra: Partial<React.ComponentProps<typeof StartMenu>> = {}) => {
    const onReviewRestless = vi.fn();
    render(
      <StartMenu
        onStartSeance={vi.fn()}
        onReviewLegend={vi.fn()}
        onReviewCangjieGuide={vi.fn()}
        onOpenGraveyard={vi.fn()}
        onOpenCredits={vi.fn()}
        level={1}
        onChooseLevel={vi.fn()}
        finishedNotice={null}
        restlessCount={3}
        onReviewRestless={onReviewRestless}
        {...extra}
      />,
    );
    return { onReviewRestless, user: userEvent.setup() };
  };

  it('shows the slip with the count and calls onReviewRestless', async () => {
    const m = renderMenu();
    await m.user.click(screen.getByRole('button', { name: REVIEW }));
    expect(m.onReviewRestless).toHaveBeenCalledTimes(1);
  });

  it('shows a 4-digit count as a decimal integer', () => {
    renderMenu({ restlessCount: 1234 });
    expect(screen.getByRole('button', { name: 'Review restless ghosts (1234)' })).toBeTruthy();
  });

  it('is absent when the count is 0 or no handler is given', () => {
    renderMenu({ restlessCount: 0 });
    expect(screen.queryByRole('button', { name: /Review restless ghosts/ })).toBeNull();
    cleanup();
    renderMenu({ restlessCount: undefined });
    expect(screen.queryByRole('button', { name: /Review restless ghosts/ })).toBeNull();
  });

  it('sits right after "Starting level" and before the Move on slip in tab order', async () => {
    const m = renderMenu({
      finishedNotice: {
        text: 'You have met every ghost of level 1.',
        moveOn: { label: 'Move on to level 2', onClick: vi.fn() },
      },
    });
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      BEGIN,
      'Starting level: 1',
      REVIEW,
      'Move on to level 2',
      LEGEND,
      GUIDE,
      GRAVEYARD,
      CREDITS,
    ]);
    const level = screen.getByRole('button', { name: 'Starting level: 1' });
    expect(level.nextElementSibling).toBe(screen.getByRole('button', { name: REVIEW }));
    await m.user.tab();
    await m.user.tab();
    await m.user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: REVIEW }));
  });

  it('is a slip, not a slip-primary, at least 44 px, and Begin stays the only slip-primary', () => {
    renderMenu();
    const slip = screen.getByRole('button', { name: REVIEW });
    expect(slip.classList.contains('slip')).toBe(true);
    expect(slip.className).not.toContain('slip-primary');
    expect(slip.className).toContain('min-h-[44px]');
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: BEGIN }).classList.contains('slip-primary')).toBe(true);
  });

  it('shows the alert text after a failed start', () => {
    renderMenu({ reviewError: true });
    expect(screen.getByRole('alert').textContent).toBe(
      'The review could not start. Check your connection and try again.',
    );
  });
});

describe('StartMenu night wind placement (night-sounds Req 8.3, 8.7, 9.4, 15.1, 15.4 to 15.7)', () => {
  function fakeEngine(): SoundEngine {
    return {
      play: vi.fn(),
      setEnabled: vi.fn(),
      setAmbience: vi.fn(),
      unlock: vi.fn(),
      suspend: vi.fn(),
      dispose: vi.fn(),
    };
  }

  function seed(extra: object = {}) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        introSeen: true,
        cangjieIntroSeen: true,
        level: 1,
        levelChosen: true,
        soundOn: true,
        ambienceOn: false,
        history: {},
        ...extra,
      }),
    );
  }

  function renderWithSound() {
    render(
      <SoundProvider createEngine={fakeEngine}>
        <StartMenu
          onStartSeance={vi.fn()}
          onReviewLegend={vi.fn()}
          onReviewCangjieGuide={vi.fn()}
          onOpenGraveyard={vi.fn()}
          onOpenCredits={vi.fn()}
          level={1}
          onChooseLevel={vi.fn()}
          finishedNotice={null}
        />
      </SoundProvider>,
    );
    return userEvent.setup();
  }

  beforeEach(() => {
    wind.calls = [];
    localStorage.clear();
    vi.stubGlobal('AudioContext', function FakeAudioContext() {});
  });
  afterEach(() => {
    cleanup();
    document.getElementById('root')?.remove();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows no Ambience_Toggle with a provider and keeps exactly one slip-primary', () => {
    seed();
    renderWithSound();
    expect(screen.queryByTestId('ambience-toggle')).toBeNull();
    expect(screen.queryByRole('button', { name: /night wind/i })).toBeNull();
    expect(document.querySelectorAll('.slip-primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: BEGIN }).classList.contains('slip-primary')).toBe(true);
  });

  it('renders no toggle outside a provider', () => {
    setup();
    expect(screen.queryByTestId('ambience-toggle')).toBeNull();
  });

  describe('in the app', () => {
    const lastWish = () => wind.calls[wind.calls.length - 1];

    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(raw) })),
      );
    });

    function mount() {
      const container = document.createElement('div');
      container.id = 'root';
      document.body.appendChild(container);
      render(<App />, { container });
    }

    it('shows the toggle on the Graveyard and on no other screen, the menu included', async () => {
      seed({ ambienceOn: true });
      mount();
      const user = userEvent.setup();
      await screen.findByRole('button', { name: BEGIN });
      expect(screen.queryByTestId('ambience-toggle')).toBeNull();

      await user.click(screen.getByRole('button', { name: GRAVEYARD }));
      await screen.findByRole('button', { name: /back/i });
      expect(screen.getAllByTestId('ambience-toggle')).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: /back/i }));
      await user.click(await screen.findByRole('button', { name: CREDITS }));
      await screen.findByRole('heading', { name: 'Sources & licences' });
      expect(screen.queryByTestId('ambience-toggle')).toBeNull();

      await user.click(screen.getByRole('button', { name: /back/i }));
      await user.click(await screen.findByRole('button', { name: GUIDE }));
      await screen.findByRole('heading', { name: /how cangjie works/i });
      expect(screen.queryByTestId('ambience-toggle')).toBeNull();
    });

    it('is absent on the intro', async () => {
      seed({ ambienceOn: true });
      mount();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: LEGEND }));
      await screen.findByRole('button', { name: /^begin the séance$/i });
      expect(screen.queryByTestId('ambience-toggle')).toBeNull();
    });

    it('wishes for wind only on the menu and the Graveyard, and keeps it when moving between them', async () => {
      seed({ ambienceOn: true });
      mount();
      const user = userEvent.setup();
      await screen.findByRole('button', { name: BEGIN });
      expect(lastWish()).toBe('ambience:true');

      const before = wind.calls.length;
      await user.click(screen.getByRole('button', { name: GRAVEYARD }));
      await screen.findByRole('button', { name: /back/i });
      expect(lastWish()).toBe('ambience:true');
      expect(wind.calls.slice(before)).not.toContain('ambience:false');

      await user.click(screen.getByRole('button', { name: /back/i }));
      await screen.findByRole('button', { name: BEGIN });
      expect(lastWish()).toBe('ambience:true');
      expect(wind.calls.slice(before)).not.toContain('ambience:false');

      await user.click(screen.getByRole('button', { name: CREDITS }));
      await screen.findByRole('heading', { name: 'Sources & licences' });
      expect(lastWish()).toBe('ambience:false');

      await user.click(screen.getByRole('button', { name: /back/i }));
      await user.click(await screen.findByRole('button', { name: LEGEND }));
      await screen.findByRole('button', { name: /^begin the séance$/i });
      expect(lastWish()).toBe('ambience:false');
    });
  });
});
