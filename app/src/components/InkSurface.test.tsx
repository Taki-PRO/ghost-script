import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { InkSurface } from './InkSurface';

afterEach(cleanup);

describe('InkSurface', () => {
  it('renders the paper, the grid and the hanzi-writer container', () => {
    const ref = createRef<HTMLDivElement>();
    render(<InkSurface size="240px" containerRef={ref} role="img" ariaLabel="Writing area" />);
    const surface = screen.getByTestId('ink-surface');
    expect(surface.className).toContain('ink-paper');
    expect(surface.querySelector('[data-testid="practice-grid"]')).not.toBeNull();
    expect(ref.current).toBe(screen.getByRole('img', { name: 'Writing area' }));
  });

  it('keeps a fixed size and touch-action none', () => {
    const ref = createRef<HTMLDivElement>();
    render(<InkSurface size="min(60vw, 240px)" containerRef={ref} />);
    const surface = screen.getByTestId('ink-surface');
    expect(surface.style.width).toBe('min(60vw, 240px)');
    expect(surface.style.aspectRatio).toBe('1 / 1');
    expect(surface.style.touchAction).toBe('none');
    expect(screen.getByTestId('ink-container').style.touchAction).toBe('none');
  });

  it('never uses display none, also when hidden, and keeps the same size', () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(<InkSurface size="240px" containerRef={ref} />);
    const before = screen.getByTestId('ink-surface').style.width;
    rerender(<InkSurface size="240px" containerRef={ref} hidden />);
    const container = screen.getByTestId('ink-container');
    expect(container.style.display).not.toBe('none');
    expect(container.style.visibility).toBe('hidden');
    expect(screen.getByTestId('ink-surface').style.display).not.toBe('none');
    expect(screen.getByTestId('ink-surface').style.width).toBe(before);
  });
});
