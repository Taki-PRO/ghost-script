import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Credits } from './Credits';
import { CODE_LICENCE, COMBINED_WORK_NOTE, DATA_SOURCES, FONTS } from '../data/credits';
import { CANGJIE_CITATIONS, LEGEND_SOURCE } from '../data/citations';
import { SOFTWARE_CREDITS } from '../data/software';

afterEach(() => cleanup());

function text(): string {
  return document.body.textContent ?? '';
}

describe('Credits', () => {
  it('shows every data source with name, version, use, licence and URL as text', () => {
    render(<Credits onBack={() => {}} />);
    const t = text();
    for (const s of DATA_SOURCES) {
      for (const v of [s.name, s.version, s.use, s.licence, s.url]) expect(t).toContain(v);
    }
  });

  it('states the combined-work note and the MIT code licence', () => {
    render(<Credits onBack={() => {}} />);
    expect(text()).toContain(COMBINED_WORK_NOTE);
    expect(text()).toContain(`licensed ${CODE_LICENCE}`);
  });

  it('shows the legend line, the citation and that the English is our own', () => {
    render(<Credits onBack={() => {}} />);
    const zh = screen.getByText(LEGEND_SOURCE.zh);
    expect(zh).toHaveAttribute('lang', 'zh');
    expect(text()).toContain(LEGEND_SOURCE.english);
    expect(text()).toContain(LEGEND_SOURCE.citation);
    expect(text()).toContain('The English rendering is our own');
  });

  it('shows both Wikipedia titles and URLs as text', () => {
    render(<Credits onBack={() => {}} />);
    for (const c of CANGJIE_CITATIONS) {
      expect(text()).toContain(c.title);
      expect(text()).toContain(c.url);
    }
  });

  it('shows the font entry and the installed-fonts sentence', () => {
    render(<Credits onBack={() => {}} />);
    for (const f of FONTS) {
      expect(text()).toContain(f.name);
      expect(text()).toContain(f.licence);
    }
    expect(text()).toContain('Chinese text uses fonts already installed on your device.');
  });

  it('shows every Software row with name, version and licence', () => {
    render(<Credits onBack={() => {}} />);
    const heading = screen.getByRole('heading', { name: 'Software' });
    const section = heading.closest('section') as HTMLElement;
    for (const p of SOFTWARE_CREDITS) {
      const row = within(section).getByRole('rowheader', { name: p.name }).closest('tr') as HTMLElement;
      expect(within(row).getByText(p.version)).toBeInTheDocument();
      expect(within(row).getByText(p.licence)).toBeInTheDocument();
    }
  });

  it('has exactly one link, to the notices file under the base URL', () => {
    const { container } = render(<Credits onBack={() => {}} />);
    const anchors = container.querySelectorAll('a');
    expect(anchors).toHaveLength(1);
    const href = anchors[0].getAttribute('href') ?? '';
    expect(href.endsWith('THIRD_PARTY_NOTICES.txt')).toBe(true);
    expect(href.startsWith(import.meta.env.BASE_URL)).toBe(true);
    expect(anchors[0]).toHaveTextContent('Full licence texts (THIRD_PARTY_NOTICES.txt)');
  });

  it('has a 44px Back to menu button that calls onBack', async () => {
    const onBack = vi.fn();
    render(<Credits onBack={onBack} />);
    const btn = screen.getByRole('button', { name: 'Back to menu' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('focus-visible:ring');
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
