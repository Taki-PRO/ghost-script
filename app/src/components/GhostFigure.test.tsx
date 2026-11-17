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

  it('draws three silhouette paths with the shared GHOST_PATH (hem, body, wash)', () => {
    const { container } = render(<GhostFigure />);
    const paths = Array.from(container.querySelectorAll('path')).filter((p) => p.getAttribute('d') === GHOST_PATH);
    expect(paths).toHaveLength(3);
    expect(paths[0].getAttribute('filter')).toMatch(/-blur\)$/);
    expect(paths[1].getAttribute('fill')).toMatch(/-tone\)$/);
    expect(paths[2].getAttribute('fill')).toMatch(/-wash\)$/);
  });

  it('draws two eye paths in the theme background, and no circles', () => {
    const { container } = render(<GhostFigure />);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const eyes = container.querySelectorAll(`path[fill="${theme.background}"]`);
    expect(eyes).toHaveLength(2);
    expect(Array.from(eyes).map((e) => e.getAttribute('d'))).toEqual([...GHOST_EYE_PATHS]);
  });

  it('has a tone gradient with decreasing stop opacity and a darker wash gradient', () => {
    const { container } = render(<GhostFigure />);
    expect(container.querySelectorAll('linearGradient')).toHaveLength(1);
    expect(container.querySelectorAll('radialGradient')).toHaveLength(1);
    const ops = Array.from(container.querySelectorAll('linearGradient stop')).map((s) =>
      Number(s.getAttribute('stop-opacity')),
    );
    expect(ops).toHaveLength(3);
    expect(ops[0]).toBeGreaterThan(ops[1]);
    expect(ops[1]).toBeGreaterThan(ops[2]);
  });

  it('has two filters: displacement for the edge, gaussian blur for the hem', () => {
    const { container } = render(<GhostFigure />);
    const filters = container.querySelectorAll('filter');
    expect(filters).toHaveLength(2);
    expect(container.querySelector('feTurbulence')).not.toBeNull();
    expect(container.querySelector('feDisplacementMap')).not.toBeNull();
    expect(container.querySelector('filter feGaussianBlur')).not.toBeNull();
  });

  it('gives two instances disjoint ids and every url reference resolves', () => {
    const { container } = render(
      <>
        <GhostFigure />
        <GhostFigure />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((e) => e.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      const own = new Set(Array.from(svg.querySelectorAll('[id]')).map((e) => e.id));
      const refs = Array.from(svg.querySelectorAll('[fill], [filter]')).flatMap((e) =>
        [e.getAttribute('fill'), e.getAttribute('filter')].flatMap((v) => v?.match(/url\(#([^)]+)\)/)?.[1] ?? []),
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(own.has(r)).toBe(true);
    }
  });

  it('applies className', () => {
    const { container } = render(<GhostFigure className="x" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('x');
  });
});

describe('favicon', () => {
  const file = resolve(__dirname, '../../public/favicon.svg');
  const svg = readFileSync(file, 'utf8');

  it('has no filter or gradient and stays under 4,096 bytes', () => {
    expect(svg).not.toMatch(/<filter|filter=|feTurbulence|feDisplacementMap|feGaussianBlur|linearGradient|radialGradient/);
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
