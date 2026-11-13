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
});
