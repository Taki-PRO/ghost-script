import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SealStamp } from './SealStamp';
import { theme } from '../styles/theme';
import realDataJson from '../../public/data/characters.json';

afterEach(cleanup);
const CHAR = Object.keys(realDataJson as Record<string, unknown>)[10]!;

describe('SealStamp', () => {
  it('is one image named "Seal: " plus the character, announced once', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByRole('img', { name: `Seal: ${CHAR}` });
    expect(seal.getAttribute('aria-label')!.split(CHAR)).toHaveLength(2);
    expect(seal.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    const glyph = seal.querySelector('span')!;
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.getAttribute('lang')).toBe('zh');
  });
  it('shows only the prop character, at 28 px in paperLabel, with no other Chinese text', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByTestId('seal-stamp');
    expect(seal.textContent).toBe(CHAR);
    const glyph = seal.querySelector('span')!;
    expect(glyph.style.fontSize).toBe('28px');
    expect(glyph).toHaveStyle({ color: theme.paperLabel });
    expect(seal.querySelector('rect')!.getAttribute('fill')).toBe(theme.seal);
  });
  it('ignores pointer events and takes no layout space', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByTestId('seal-stamp');
    expect(seal.style.pointerEvents).toBe('none');
    expect(seal.className).toContain('absolute');
  });
});
