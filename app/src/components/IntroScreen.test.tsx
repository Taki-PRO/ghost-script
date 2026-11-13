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
  it('renders the premise: Cangjie, wailing ghosts, forgotten characters are ghosts laid to rest by writing', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/Cangjie/);
    expect(text).toMatch(/invented\s+writing/i);
    expect(text).toMatch(/ghosts\s+(wept|wailed)/i);
    expect(text).toMatch(/night/i);
    expect(text).toMatch(/forgotten[\s\S]*are ghosts/i);
    expect(text).toMatch(/lay[\s\S]*to\s+rest[\s\S]*writing/i);
  });

  it('attributes the line to the Huainanzi and renders the original Chinese in a zh element', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} />);
    expect(screen.getByText(/Huainanzi/)).toBeInTheDocument();
    const zh = screen.getByText('天雨粟，鬼夜哭');
    expect(zh.closest('[lang]')?.getAttribute('lang')).toMatch(/^zh/);
    expect(container.querySelector('[lang^="zh"]')?.textContent).toBe('天雨粟，鬼夜哭');
  });

  it('makes no other historical claims: no years and no percentages', () => {
    const { container } = render(<IntroScreen onBegin={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b1[0-9]{3}\b|\b20[0-9]{2}\b/);
    expect(text).not.toMatch(/%/);
  });

  it('has a level-1 heading', () => {
    render(<IntroScreen onBegin={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('has exactly one button, labelled "Begin the Séance"', () => {
    render(<IntroScreen onBegin={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Begin the Séance' })).toBeInTheDocument();
  });

  it('calls onBegin once when clicked', async () => {
    const onBegin = vi.fn();
    const user = userEvent.setup();
    render(<IntroScreen onBegin={onBegin} />);
    await user.click(screen.getByRole('button', { name: 'Begin the Séance' }));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('is keyboard operable: Tab focuses the button, Enter and Space each activate it', async () => {
    const onBegin = vi.fn();
    const user = userEvent.setup();
    render(<IntroScreen onBegin={onBegin} />);
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
    render(<IntroScreen onBegin={onBegin} />);
    vi.advanceTimersByTime(60_000);
    expect(onBegin).not.toHaveBeenCalled();
  });
});
