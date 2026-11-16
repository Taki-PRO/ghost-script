import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartMenu } from './StartMenu';

const BEGIN = 'Begin a Nightly Séance';
const LEGEND = 'Read the legend again';
const GUIDE = 'How Cangjie works';
const GRAVEYARD = 'Graveyard';
const CREDITS = 'Credits';

function setup() {
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
    />,
  );
  return {
    onStartSeance,
    onReviewLegend,
    onReviewCangjieGuide,
    onOpenGraveyard,
    onOpenCredits,
    user: userEvent.setup(),
  };
}

afterEach(() => cleanup());

describe('StartMenu (Req 1.5, 3.6, 7.1, 7.2, 9.4)', () => {
  it('renders a heading and exactly five named buttons in order', () => {
    setup();
    expect(screen.getByRole('heading')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      BEGIN,
      LEGEND,
      GUIDE,
      GRAVEYARD,
      CREDITS,
    ]);
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

  it('Credits calls only onOpenCredits', async () => {
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
