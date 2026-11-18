import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { GrassTuft } from './GrassTuft';
import { TUFT_SHAPES } from '../engine/grassPattern';
import { theme } from '../styles/theme';

afterEach(cleanup);

function tuft(shape = 0, scale?: number): SVGSVGElement {
  const { container } = render(<GrassTuft shape={shape} scale={scale} />);
  return container.querySelector('svg')!;
}

describe('GrassTuft', () => {
  it('is hidden from assistive technology and not focusable', () => {
    const svg = tuft();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.classList.contains('pointer-events-none')).toBe(true);
  });

  it('has no title, desc, text or lang', () => {
    const svg = tuft(2);
    expect(svg.querySelector('title')).toBeNull();
    expect(svg.querySelector('desc')).toBeNull();
    expect(svg.querySelector('text')).toBeNull();
    expect(svg.textContent).toBe('');
    expect(svg.querySelector('[lang]')).toBeNull();
    expect(svg.hasAttribute('lang')).toBe(false);
  });

  it('draws one path of the chosen shape, filled with the grass token and not stroked', () => {
    const svg = tuft(3);
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute('d')).toBe(TUFT_SHAPES[3]);
    expect(paths[0]!.getAttribute('fill')).toBe(theme.grass);
    expect(paths[0]!.getAttribute('stroke')).toBeNull();
    expect(svg.querySelectorAll('[fill]')).toHaveLength(1);
  });

  it('sizes the box by scale from the 24 x 9 viewBox', () => {
    const svg = tuft(0, 1.5);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 9');
    expect(svg.getAttribute('width')).toBe('36');
    expect(svg.getAttribute('height')).toBe('13.5');
  });

  it('carries no animation or transition', () => {
    const svg = tuft(1);
    for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
      const style = el.getAttribute('style') ?? '';
      expect(style).not.toMatch(/animation|transition/i);
      expect(el.tagName.toLowerCase()).not.toMatch(/^animate/);
    }
    expect(svg.getAttribute('class') ?? '').not.toMatch(/animate|transition/);
  });
});
