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
      expect(text()).toContain(f.copyright);
    }
    expect(text()).toContain(
      'Chinese characters are drawn with LXGW WenKai (subset to the characters in this game). Any other Chinese text uses fonts already installed on the device.',
    );
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

  it('names the heading and the landmark "Sources & licences" and never says Credits', () => {
    render(<Credits onBack={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Sources & licences' })).toBeInTheDocument();
    expect(text()).not.toMatch(/\bcredits\b/i);
  });

  it('has one Back to menu button, in the same sticky header as the h1', () => {
    render(<Credits onBack={() => {}} />);
    const buttons = screen.getAllByRole('button', { name: 'Back to menu' });
    expect(buttons).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1 });
    const header = h1.closest('header') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header).toContainElement(buttons[0]);
    const classes = header.className.split(/\s+/);
    expect(classes).toContain('sticky');
    expect(classes).toContain('sticky-below-moon');
    expect(classes).not.toContain('top-0');
    expect(classes).toContain('bg-night-top');
  });

  describe('narrow and wide layouts (Requirement 24)', () => {
    const WRAP = '[overflow-wrap:anywhere]';
    const SOURCE_LABELS = ['Name', 'Version or commit', 'Use', 'Licence', 'URL'];
    const SOFTWARE_LABELS = ['Name', 'Version', 'Licence'];

    function parts(container: HTMLElement, id: 'credits-sources' | 'credits-software') {
      const table = container.querySelector(`table[aria-labelledby="${id}"]`) as HTMLElement;
      const list = container.querySelector(`ul[aria-labelledby="${id}"]`) as HTMLElement;
      return { table, list };
    }

    function cardFor(list: HTMLElement, name: string): HTMLElement {
      const card = Array.from(list.querySelectorAll('li')).find(
        (li) => li.querySelector('dd')?.textContent === name,
      );
      expect(card, `card for ${name}`).toBeDefined();
      return card as HTMLElement;
    }

    function expectCard(card: HTMLElement, labels: string[], values: string[]) {
      const dl = card.querySelector('dl');
      expect(dl).not.toBeNull();
      expect(Array.from(card.querySelectorAll('dt')).map((e) => e.textContent)).toEqual(labels);
      expect(Array.from(card.querySelectorAll('dd')).map((e) => e.textContent)).toEqual(values);
    }

    it('renders both layouts: tables hidden below sm, card lists hidden from sm', () => {
      const { container } = render(<Credits onBack={() => {}} />);
      for (const id of ['credits-sources', 'credits-software'] as const) {
        const { table, list } = parts(container, id);
        expect(table).not.toBeNull();
        expect(list).not.toBeNull();
        const t = table.className.split(/\s+/);
        expect(t).toContain('hidden');
        expect(t).toContain('sm:table');
        expect(list.className.split(/\s+/)).toContain('sm:hidden');
        expect(table).toHaveAccessibleName(id === 'credits-sources' ? 'Data sources' : 'Software');
        expect(list).toHaveAccessibleName(id === 'credits-sources' ? 'Data sources' : 'Software');
      }
    });

    it('shows every data source as a table row and as a card with five labelled values', () => {
      const { container } = render(<Credits onBack={() => {}} />);
      const { table, list } = parts(container, 'credits-sources');
      expect(list.querySelectorAll(':scope > li')).toHaveLength(DATA_SOURCES.length);
      for (const s of DATA_SOURCES) {
        const values = [s.name, s.version, s.use, s.licence, s.url];
        const row = within(table).getByRole('rowheader', { name: s.name }).closest('tr') as HTMLElement;
        const cells = Array.from(row.querySelectorAll('th,td')).map((c) => c.textContent);
        expect(cells).toEqual(values);
        expectCard(cardFor(list, s.name), SOURCE_LABELS, values);
      }
    });

    it('shows every software package as a table row and as a card with three labelled values', () => {
      const { container } = render(<Credits onBack={() => {}} />);
      const { table, list } = parts(container, 'credits-software');
      expect(list.querySelectorAll(':scope > li')).toHaveLength(SOFTWARE_CREDITS.length);
      for (const p of SOFTWARE_CREDITS) {
        const values = [p.name, p.version, p.licence];
        const row = within(table).getByRole('rowheader', { name: p.name }).closest('tr') as HTMLElement;
        const cells = Array.from(row.querySelectorAll('th,td')).map((c) => c.textContent);
        expect(cells).toEqual(values);
        expectCard(cardFor(list, p.name), SOFTWARE_LABELS, values);
      }
    });

    it('uses the table column labels as the card labels', () => {
      const { container } = render(<Credits onBack={() => {}} />);
      for (const id of ['credits-sources', 'credits-software'] as const) {
        const { table, list } = parts(container, id);
        const headers = Array.from(table.querySelectorAll('thead th')).map((h) => h.textContent);
        expect(headers).toEqual(id === 'credits-sources' ? SOURCE_LABELS : SOFTWARE_LABELS);
        for (const dl of list.querySelectorAll('dl')) {
          expect(Array.from(dl.querySelectorAll('dt')).map((e) => e.textContent)).toEqual(headers);
        }
      }
    });

    it('lets every table cell, card value, the legend citation and each Cangjie citation wrap anywhere', () => {
      const { container } = render(<Credits onBack={() => {}} />);
      const cells = container.querySelectorAll('tbody th, tbody td');
      expect(cells).toHaveLength(DATA_SOURCES.length * 5 + SOFTWARE_CREDITS.length * 3);
      for (const c of cells) expect(c.className).toContain(WRAP);
      const dds = container.querySelectorAll('dd');
      expect(dds).toHaveLength(DATA_SOURCES.length * 5 + SOFTWARE_CREDITS.length * 3);
      for (const d of dds) expect(d.className).toContain(WRAP);

      const legend = screen.getByText(LEGEND_SOURCE.citation, { exact: false });
      expect(legend.className).toContain(WRAP);
      for (const c of CANGJIE_CITATIONS) {
        const li = screen.getByText(c.url, { exact: false }).closest('li') as HTMLElement;
        expect(li.className).toContain(WRAP);
      }
    });
  });

  it('lets every Fonts list item wrap anywhere, so a long copyright line fits 320 px (Requirement 28)', () => {
    const { container } = render(<Credits onBack={() => {}} />);
    const items = container.querySelectorAll('section[aria-labelledby="credits-fonts"] ul > li');
    expect(items).toHaveLength(FONTS.length);
    for (const li of items) expect(li.className).toContain('[overflow-wrap:anywhere]');
  });

  it('has a 44px Back to menu button that calls onBack', async () => {
    const onBack = vi.fn();
    render(<Credits onBack={onBack} />);
    const btn = screen.getByRole('button', { name: 'Back to menu' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className.split(/\s+/)).toContain('slip');
    expect(btn.className).toContain('focus-visible:ring');
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
