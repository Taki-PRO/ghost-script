import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartMenu } from './StartMenu';

const BEGIN = 'Begin a Nightly Séance';
const LEGEND = 'Read the legend again';

function setup() {
  const onStartSeance = vi.fn();
  const onReviewLegend = vi.fn();
  render(<StartMenu onStartSeance={onStartSeance} onReviewLegend={onReviewLegend} />);
  return { onStartSeance, onReviewLegend, user: userEvent.setup() };
}

afterEach(() => cleanup());

describe('StartMenu (Req 1.5, 3.6)', () => {
  it('renders a heading and exactly two named buttons', () => {
    setup();
    expect(screen.getByRole('heading')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByRole('button', { name: BEGIN })).toBeTruthy();
    expect(screen.getByRole('button', { name: LEGEND })).toBeTruthy();
  });

  it('Begin calls only onStartSeance', async () => {
    const { onStartSeance, onReviewLegend, user } = setup();
    await user.click(screen.getByRole('button', { name: BEGIN }));
    expect(onStartSeance).toHaveBeenCalledTimes(1);
    expect(onReviewLegend).not.toHaveBeenCalled();
  });

  it('Read the legend again calls only onReviewLegend', async () => {
    const { onStartSeance, onReviewLegend, user } = setup();
    await user.click(screen.getByRole('button', { name: LEGEND }));
    expect(onReviewLegend).toHaveBeenCalledTimes(1);
    expect(onStartSeance).not.toHaveBeenCalled();
  });

  it('is keyboard operable in order, Enter fires the right callback', async () => {
    const { onStartSeance, onReviewLegend, user } = setup();
    const begin = screen.getByRole('button', { name: BEGIN });
    const legend = screen.getByRole('button', { name: LEGEND });

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
  });

  it('both buttons are type="button"', () => {
    setup();
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('type')).toBe('button');
    }
  });
});
