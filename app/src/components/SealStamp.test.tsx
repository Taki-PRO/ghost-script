import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SealStamp } from './SealStamp';
import { SEAL_GLYPH_PX, SEAL_INSET_PX, SEAL_SIZE_PX } from '../engine/sealLayout';
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
  it('shows only the prop character, at the glyph size in paperLabel, with no other Chinese text', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByTestId('seal-stamp');
    expect(seal.textContent).toBe(CHAR);
    const glyph = seal.querySelector('span')!;
    expect(glyph.style.fontSize).toBe(`${SEAL_GLYPH_PX}px`);
    expect(glyph).toHaveStyle({ color: theme.paperLabel });
    expect(seal.querySelector('rect')!.getAttribute('fill')).toBe(theme.seal);
  });
  it('is sized and placed from the layout constants', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByTestId('seal-stamp');
    expect(seal.style.width).toBe(`${SEAL_SIZE_PX}px`);
    expect(seal.style.height).toBe(`${SEAL_SIZE_PX}px`);
    expect(seal.style.bottom).toBe(`${SEAL_INSET_PX}px`);
    expect(seal.style.right).toBe(`${SEAL_INSET_PX}px`);
  });
  it('ignores pointer events and takes no layout space', () => {
    render(<SealStamp character={CHAR} />);
    const seal = screen.getByTestId('seal-stamp');
    expect(seal.style.pointerEvents).toBe('none');
    expect(seal.className).toContain('absolute');
  });
  it('with placement "flow" and a size, sits in the flow at that size with a 0.75 glyph', () => {
    render(<SealStamp character={CHAR} placement="flow" size={40} />);
    const seal = screen.getByRole('img', { name: `Seal: ${CHAR}` });
    expect(seal.className).toContain('relative');
    expect(seal.className).not.toContain('absolute');
    expect(seal.style.width).toBe('40px');
    expect(seal.style.height).toBe('40px');
    expect(seal.style.bottom).toBe('');
    expect(seal.style.right).toBe('');
    expect(seal.style.pointerEvents).toBe('none');
    expect(seal.querySelector('span')!.style.fontSize).toBe('30px');
    expect(seal.textContent).toBe(CHAR);
  });
  it('with explicit defaults renders the same markup as with no props', () => {
    const a = render(<SealStamp character={CHAR} />);
    const plain = a.container.innerHTML.replace(/seal-rough-\w+/g, 'F');
    cleanup();
    const b = render(<SealStamp character={CHAR} placement="corner" size={SEAL_SIZE_PX} />);
    expect(b.container.innerHTML.replace(/seal-rough-\w+/g, 'F')).toBe(plain);
  });
});
