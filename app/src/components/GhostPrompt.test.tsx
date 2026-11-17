import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CharacterRecord } from '../data/types';
import { GhostPrompt, maskTarget } from './GhostPrompt';
import raw from '../../public/data/characters.json';

const records = Object.values(raw as unknown as Record<string, CharacterRecord>);

function rec(ch: string): CharacterRecord {
  const r = (raw as unknown as Record<string, CharacterRecord>)[ch];
  if (!r) throw new Error(`missing record ${ch}`);
  return r;
}

afterEach(cleanup);

/** Every text and attribute value rendered under the container. */
function allRenderedStrings(container: HTMLElement): string[] {
  const out = [container.textContent ?? ''];
  for (const el of Array.from(container.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) out.push(attr.value);
  }
  return out;
}

describe('maskTarget', () => {
  it('masks every occurrence', () => {
    expect(maskTarget('a么b么c', '么')).toBe('a～b～c');
  });

  it('leaves text without the char unchanged', () => {
    expect(maskTarget('mountain; hill', '么')).toBe('mountain; hill');
  });

  it('works for astral chars', () => {
    expect(maskTarget('x\u{20000}y\u{20000}', '\u{20000}')).toBe('x～y～');
  });

  it('does not mask a different char sharing a UTF-16 unit', () => {
    // U+20000 = D840 DC00; U+20001 = D840 DC01 share the high surrogate.
    expect(maskTarget('\u{20001}', '\u{20000}')).toBe('\u{20001}');
  });
});

describe('GhostPrompt', () => {
  it('shows cleaned meaning and stored pinyin for 山', () => {
    const r = rec('山');
    render(<GhostPrompt record={r} />);
    expect(screen.getByText('mountain; hill')).toBeTruthy();
    expect(document.body.textContent).not.toContain('CL:');
    const pinyin = screen.getByText(r.prompt.pinyin);
    expect(pinyin.textContent).toBe(r.prompt.pinyin);
    expect(pinyin.getAttribute('lang')).toBe('zh-Latn-pinyin');
  });

  it('drops the "(e.g. ...)" clause for 号', () => {
    const { container } = render(<GhostPrompt record={rec('号')} />);
    expect(container.textContent).not.toContain('e.g.');
    expect(container.textContent).toContain('number designation');
  });

  it('has Meaning and Pronunciation labels and an accessible region', () => {
    render(<GhostPrompt record={rec('山')} />);
    expect(screen.getByText('Meaning')).toBeTruthy();
    expect(screen.getByText('Pronunciation')).toBeTruthy();
    expect(screen.getByRole('region', { name: "Ghost's clue" })).toBeTruthy();
  });

  it('masks the target in 么 and 第 meanings', () => {
    const a = render(<GhostPrompt record={rec('么')} />);
    expect(a.container.textContent).toContain('～');
    expect(a.container.textContent).not.toContain('么');
    expect(a.container.textContent).toContain('什～');
    cleanup();
    const b = render(<GhostPrompt record={rec('第')} />);
    expect(b.container.textContent).toContain('～六');
    expect(b.container.textContent).not.toContain('第');
  });

  it('never reveals the target character for any of the real records (Req 5.1)', () => {
    expect(records.length).toBeGreaterThanOrEqual(300);
    const offenders: string[] = [];
    for (const r of records) {
      const { container } = render(<GhostPrompt record={r} />);
      if (allRenderedStrings(container).some((s) => s.includes(r.character))) {
        offenders.push(r.character);
      }
      cleanup();
    }
    expect(offenders).toEqual([]);
  });

  it('does not mutate the input record', () => {
    const r = rec('么');
    const before = JSON.parse(JSON.stringify(r)) as CharacterRecord;
    render(<GhostPrompt record={r} />);
    expect(r).toEqual(before);
  });

  it('has data-ghost-state per outcome (haunting when none)', () => {
    const expected = [
      [undefined, 'haunting'],
      [null, 'haunting'],
      ['clean', 'faded'],
      ['struggled', 'flickering'],
      ['gave-up', 'drifted'],
    ] as const;
    for (const [outcome, state] of expected) {
      const { container } = render(<GhostPrompt record={rec('山')} outcome={outcome} />);
      expect(container.querySelector('section')?.getAttribute('data-ghost-state')).toBe(state);
      cleanup();
    }
  });

  it('draws an aria-hidden figure with no <text> element', () => {
    const { container } = render(<GhostPrompt record={rec('山')} />);
    const fig = container.querySelector('svg.ghost-figure');
    expect(fig?.getAttribute('aria-hidden')).toBe('true');
    expect(fig?.querySelector('text')).toBeNull();
  });

  it('keeps the target out of innerHTML in every state', () => {
    for (const r of [rec('么'), rec('第'), rec('山')]) {
      for (const outcome of [null, 'clean', 'struggled', 'gave-up'] as const) {
        const { container } = render(<GhostPrompt record={r} outcome={outcome} />);
        expect(container.innerHTML).not.toContain(r.character);
        cleanup();
      }
    }
  });

  it('renders the compact card with the F4 classes and sr-only labels', () => {
    const r = rec('山');
    const { container } = render(<GhostPrompt record={r} compact />);
    const section = container.querySelector('section');
    expect(section?.className).toBe(
      'ghost-card flex items-center gap-3 rounded-lg bg-surface p-2 text-left',
    );
    expect(section?.getAttribute('data-ghost-state')).toBe('haunting');
    expect(container.querySelector('svg.ghost-figure')?.getAttribute('class')).toContain(
      'h-10 w-9 shrink-0 text-ghost',
    );
    expect(container.querySelector('div.min-w-0')).toBeTruthy();
    expect(screen.getByText('Meaning').className).toContain('sr-only');
    expect(screen.getByText('Pronunciation').className).toContain('sr-only');
    expect(screen.getByText('mountain; hill').className).toBe('text-xl text-ink');
    const pinyin = screen.getByText(r.prompt.pinyin);
    expect(pinyin.getAttribute('lang')).toBe('zh-Latn-pinyin');
    expect(pinyin.className).toBe('text-lg text-ghost');
  });

  it('keeps data-ghost-state per outcome in compact mode', () => {
    const { container } = render(
      <GhostPrompt record={rec('山')} outcome="struggled" compact />,
    );
    expect(container.querySelector('section')?.getAttribute('data-ghost-state')).toBe(
      'flickering',
    );
  });

  it('never reveals the target in compact mode, text or attributes', () => {
    for (const r of [rec('么'), rec('第'), rec('山')]) {
      const { container } = render(<GhostPrompt record={r} compact />);
      expect(allRenderedStrings(container).some((s) => s.includes(r.character))).toBe(false);
      cleanup();
    }
  });

  it('leaves the clue text without an opacity style in every state', () => {
    for (const outcome of [null, 'clean', 'struggled', 'gave-up'] as const) {
      const { container } = render(<GhostPrompt record={rec('山')} outcome={outcome} />);
      const text = container.querySelectorAll('p');
      expect(text.length).toBe(4);
      for (const p of Array.from(text)) {
        expect(p.getAttribute('style') ?? '').not.toContain('opacity');
        expect(p.className).not.toMatch(/opacity/);
      }
      cleanup();
    }
  });

  it('renders data-ghost-flinch, default 0, in both sizes', () => {
    for (const compact of [false, true]) {
      const { container, rerender } = render(<GhostPrompt record={rec('山')} compact={compact} />);
      const section = () => container.querySelector('section');
      expect(section()?.getAttribute('data-ghost-flinch')).toBe('0');
      rerender(<GhostPrompt record={rec('山')} compact={compact} flinch={3} />);
      expect(section()?.getAttribute('data-ghost-flinch')).toBe('3');
      cleanup();
    }
  });

  it('restarts the figure on each flinch and never changes the state', () => {
    const { container, rerender } = render(
      <GhostPrompt record={rec('山')} outcome="struggled" flinch={0} />,
    );
    const before = container.querySelector('svg.ghost-figure');
    rerender(<GhostPrompt record={rec('山')} outcome="struggled" flinch={1} />);
    expect(container.querySelector('svg.ghost-figure')).not.toBe(before);
    expect(container.querySelector('section')?.getAttribute('data-ghost-state')).toBe(
      'flickering',
    );
  });

  it('keeps the target out of text and attributes while flinching', () => {
    for (const compact of [false, true]) {
      const r = rec('么');
      const { container } = render(<GhostPrompt record={r} compact={compact} flinch={2} />);
      expect(allRenderedStrings(container).some((x) => x.includes(r.character))).toBe(false);
      cleanup();
    }
  });
});
