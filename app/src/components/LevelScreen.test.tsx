import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { LevelScreen, type LevelScreenProps } from './LevelScreen';
import type { LevelManifest } from '../data/types';

const manifest: LevelManifest = {
  levels: [
    { level: 1, file: 'characters.json', count: 300, averageStrokes: 6.6, exampleMeanings: ['eight', 'father', 'white'] },
    { level: 2, file: 'characters-level2.json', count: 400, averageStrokes: 8.4, exampleMeanings: ['river', 'tea', 'rice'] },
    { level: 3, file: 'characters-level3.json', count: 500, averageStrokes: 10.2, exampleMeanings: ['bridge', 'quiet', 'harvest'] },
  ],
};

afterEach(() => cleanup());

function setup(over: Partial<LevelScreenProps> = {}) {
  const props: LevelScreenProps = {
    manifest,
    manifestFailed: false,
    currentLevel: null,
    status: { kind: 'idle' },
    onChoose: vi.fn(),
    ...over,
  };
  const utils = render(<LevelScreen {...props} />);
  return { props, ...utils };
}

describe('LevelScreen', () => {
  it('shows a heading, one sentence and three choices in order', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(names).toHaveLength(3);
    expect(names[0]).toMatch(/^Level 1/);
    expect(names[1]).toMatch(/^Level 2/);
    expect(names[2]).toMatch(/^Level 3/);
  });

  it('builds each line from the manifest, rounding the stroke average', () => {
    setup();
    const [one, two, three] = screen.getAllByRole('button');
    expect(one.textContent).toContain(
      '300 characters, about 7 strokes each. For example: "eight", "father" and "white".',
    );
    expect(two.textContent).toContain('400 characters, about 8 strokes each.');
    expect(three.textContent).toContain('500 characters, about 10 strokes each.');
  });

  it('renders no Chinese character in text or attributes', () => {
    const { container } = setup({ onBack: () => {}, currentLevel: 2 });
    const cjk = /[\u2E80-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FFFF}]/u;
    expect(cjk.test(container.innerHTML)).toBe(false);
    expect(cjk.test(document.title)).toBe(false);
  });

  it('calls onChoose with the level', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Level 2/ }));
    expect(props.onChoose).toHaveBeenCalledWith(2);
  });

  it('shows a loading status and disables the three choices', () => {
    setup({ status: { kind: 'loading', level: 2 } });
    expect(screen.getByRole('status').textContent).toBe('Loading level 2…');
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the failure alert and keeps the choices enabled', () => {
    setup({ status: { kind: 'failed', level: 3 } });
    expect(screen.getByRole('alert').textContent).toBe(
      'Level 3 could not be loaded. Check your connection and try again.',
    );
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(false);
  });

  it('on manifest failure shows names only and the alert', () => {
    setup({ manifest: null, manifestFailed: true });
    expect(screen.getByRole('alert').textContent).toBe('The level descriptions could not be loaded.');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Level 1', 'Level 2', 'Level 3']);
  });

  it('shows no back slip and no current cue on first run', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
    expect(screen.queryByText('Current level')).toBeNull();
  });

  it('from the menu shows the back slip and marks the current level', () => {
    const onBack = vi.fn();
    setup({ onBack, currentLevel: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    const current = screen.getByRole('button', { name: /^Level 2/ });
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(within(current).getByText('Current level')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Level 1/ }).getAttribute('aria-current')).toBeNull();
  });

  it('has no Primary_Action and every button is a paper slip at least 44 px high', () => {
    const { container } = setup({ onBack: () => {} });
    expect(container.querySelector('.slip-primary')).toBeNull();
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('slip');
      expect(b.className).toContain('min-h-[44px]');
    }
  });
});
