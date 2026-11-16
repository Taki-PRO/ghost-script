import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GhostFigure } from './GhostFigure';
import { theme } from '../styles/theme';

describe('GhostFigure', () => {
  it('is hidden from assistive technology and unfocusable', () => {
    const { container } = render(<GhostFigure />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('contains no text element', () => {
    const { container } = render(<GhostFigure />);
    expect(container.querySelector('text')).toBeNull();
  });

  it('draws the eyes with the theme background', () => {
    const { container } = render(<GhostFigure />);
    const eyes = container.querySelectorAll('circle');
    expect(eyes).toHaveLength(2);
    eyes.forEach((e) => expect(e.getAttribute('fill')).toBe(theme.background));
  });

  it('renders identical markup in two renders and applies className', () => {
    const a = render(<GhostFigure className="x" />).container.innerHTML;
    const b = render(<GhostFigure className="x" />).container.innerHTML;
    expect(a).toBe(b);
    expect(a).toContain('class="x"');
  });
});
