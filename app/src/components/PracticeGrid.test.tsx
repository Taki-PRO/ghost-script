import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PracticeGrid } from './PracticeGrid';

describe('PracticeGrid', () => {
  it('has exactly five line groups', () => {
    const { container } = render(<PracticeGrid />);
    const names = Array.from(container.querySelectorAll('[data-line]')).map((g) => g.getAttribute('data-line'));
    expect(names).toEqual(['border', 'vertical', 'horizontal', 'diagonal-down', 'diagonal-up']);
  });

  it('is hidden from assistive technology and lets pointer events through', () => {
    const { container } = render(<PracticeGrid />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
  });

  it('contains no text and draws lines at opacity 0.35 or less', () => {
    const { container } = render(<PracticeGrid />);
    expect(container.querySelector('text')).toBeNull();
    expect(container.textContent).toBe('');
    const opacity = Number(container.querySelector('g[opacity]')!.getAttribute('opacity'));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(0.35);
  });

  it('renders identical markup every time', () => {
    const a = render(<PracticeGrid />).container.innerHTML;
    const b = render(<PracticeGrid />).container.innerHTML;
    expect(a).toBe(b);
  });
});
