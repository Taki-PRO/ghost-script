import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GHOST_EYE_PATHS, GHOST_PATH, GhostFigure } from './GhostFigure';
import { theme } from '../styles/theme';

describe('GhostFigure', () => {
  it('is hidden from assistive technology and unfocusable', () => {
    const { container } = render(<GhostFigure />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('contains no text element and takes no character props', () => {
    const { container } = render(<GhostFigure />);
    expect(container.querySelector('text')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('draws one body path with the shared GHOST_PATH', () => {
    const { container } = render(<GhostFigure />);
    const body = container.querySelectorAll('path[fill="currentColor"]');
    expect(body).toHaveLength(1);
    expect(body[0].getAttribute('d')).toBe(GHOST_PATH);
  });

  it('draws two eye paths in the theme background, and no circles', () => {
    const { container } = render(<GhostFigure />);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const eyes = container.querySelectorAll(`path[fill="${theme.background}"]`);
    expect(eyes).toHaveLength(2);
    expect(Array.from(eyes).map((e) => e.getAttribute('d'))).toEqual([...GHOST_EYE_PATHS]);
  });

  it('has one filter with feTurbulence and feDisplacementMap, applied to the body', () => {
    const { container } = render(<GhostFigure />);
    const filters = container.querySelectorAll('filter');
    expect(filters).toHaveLength(1);
    expect(filters[0].querySelector('feTurbulence')).not.toBeNull();
    expect(filters[0].querySelector('feDisplacementMap')).not.toBeNull();
    const body = container.querySelector('path[fill="currentColor"]');
    expect(body?.getAttribute('filter')).toBe(`url(#${filters[0].id})`);
  });

  it('gives each instance a unique filter id', () => {
    const { container } = render(
      <>
        <GhostFigure />
        <GhostFigure />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('filter')).map((f) => f.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe('');
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('applies className', () => {
    const { container } = render(<GhostFigure className="x" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('x');
  });
});

describe('favicon', () => {
  const file = resolve(__dirname, '../../public/favicon.svg');
  const svg = readFileSync(file, 'utf8');

  it('has no filter and stays under 4,096 bytes', () => {
    expect(svg).not.toMatch(/<filter|filter=|feTurbulence|feDisplacementMap/);
    expect(statSize(file)).toBeLessThanOrEqual(4096);
  });

  it('uses GHOST_PATH and the eye paths verbatim', () => {
    const ds = Array.from(svg.matchAll(/\sd="([^"]+)"/g)).map((m) => m[1]);
    expect(ds[0]).toBe(GHOST_PATH);
    expect(ds.slice(1)).toEqual([...GHOST_EYE_PATHS]);
  });
});

function statSize(path: string): number {
  return Buffer.byteLength(readFileSync(path));
}
