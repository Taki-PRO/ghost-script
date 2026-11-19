import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Credits } from './Credits';
import {
  CODE_LICENCE,
  COMBINED_WORK_NOTE,
  DATA_FILES,
  DATA_SOURCES,
  FONTS,
  KEYBOARD_LIMITATION,
  UNREVIEWED_PROMPTS_SENTENCE,
} from '../data/credits';
import { PROMPT_COUNTS } from '../data/promptCounts.generated';
import { CANGJIE_CITATIONS, LEGEND_SOURCE } from '../data/citations';
import { SOFTWARE_CREDITS } from '../data/software';

afterEach(() => cleanup());

function text(): string {
  return document.body.textContent ?? '';
}

describe('Credits', () => {
  it('shows every data source with name, version, use, licence and URL as text', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    const t = text();
    for (const s of DATA_SOURCES) {
      for (const v of [s.name, s.version, s.use, s.licence, s.url]) expect(t).toContain(v);
    }
  });

  it('states the combined-work note and the MIT code licence', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    expect(text()).toContain(COMBINED_WORK_NOTE);
    expect(text()).toContain(`licensed ${CODE_LICENCE}`);
  });

  it('names the three level datasets and the Power data file in the Licensing paragraph', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    const note = COMBINED_WORK_NOTE;
    for (const f of [
      'characters.json',
      'characters-level2.json',
      'characters-level3.json',
      'oracle/power/data/oracle-data.json',
    ]) {
      expect(note).toContain(f);
      expect(text()).toContain(f);
    }
    expect(note).toContain('are each a combined work');
    const levelSentence = note.slice(note.indexOf('The level datasets incorporate'), note.indexOf('The Power file'));
    expect(levelSentence).toContain('MIT data (HSK 3.0 character list)');
    expect(text()).toContain('MIT data (HSK 3.0 character list)');
  });

  it('shows the character-list row for three levels, the keyboard limitation and the prompt sentence', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    const row = DATA_SOURCES.find((s) => s.name.startsWith('Character list'));
    expect(row?.name).toBe('Character list — HSK 3.0 writing levels 1 to 3');
    expect(row?.use).toBe('the 300, 400 and 500 characters taught in the app, in three levels');
    expect(text()).toContain(KEYBOARD_LIMITATION);
    expect(screen.getByRole('heading', { name: 'Known limitations' })).toBeInTheDocument();
    expect(PROMPT_COUNTS.unreviewed).toBeGreaterThan(0);
    expect(text()).toContain(UNREVIEWED_PROMPTS_SENTENCE);
    expect(UNREVIEWED_PROMPTS_SENTENCE).toContain(
      `reviewed ${PROMPT_COUNTS.reviewed} of the ${PROMPT_COUNTS.total} clues and has not reviewed ${PROMPT_COUNTS.unreviewed}`,
    );
  });

  it('shows the legend line, the citation and that the English is our own', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    const zh = screen.getByText(LEGEND_SOURCE.zh);
    expect(zh).toHaveAttribute('lang', 'zh');
    expect(text()).toContain(LEGEND_SOURCE.english);
    expect(text()).toContain(LEGEND_SOURCE.citation);
    expect(text()).toContain('The English rendering is our own');
  });

  it('shows both Wikipedia titles and URLs as text', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    for (const c of CANGJIE_CITATIONS) {
      expect(text()).toContain(c.title);
      expect(text()).toContain(c.url);
    }
  });

  it('shows the font entry and the installed-fonts sentence', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
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
    render(<Credits onBack={() => {}} backTo="menu" />);
    const heading = screen.getByRole('heading', { name: 'Software' });
    const section = heading.closest('section') as HTMLElement;
    for (const p of SOFTWARE_CREDITS) {
      const row = within(section).getByRole('rowheader', { name: p.name }).closest('tr') as HTMLElement;
      expect(within(row).getByText(p.version)).toBeInTheDocument();
      expect(within(row).getByText(p.licence)).toBeInTheDocument();
    }
  });

  it('has exactly one link, to the notices file under the base URL', () => {
    const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
    const anchors = container.querySelectorAll('a');
    expect(anchors).toHaveLength(1);
    const href = anchors[0].getAttribute('href') ?? '';
    expect(href.endsWith('THIRD_PARTY_NOTICES.txt')).toBe(true);
    expect(href.startsWith(import.meta.env.BASE_URL)).toBe(true);
    expect(anchors[0]).toHaveTextContent('Full licence texts (THIRD_PARTY_NOTICES.txt)');
  });

  it('names the heading and the landmark "Sources & licences" and never says Credits', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Sources & licences' })).toBeInTheDocument();
    expect(text()).not.toMatch(/\bcredits\b/i);
  });

  it('has one Back to menu button, in the same sticky header as the h1', () => {
    render(<Credits onBack={() => {}} backTo="menu" />);
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
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
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
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
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
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
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
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
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
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
      const cells = container.querySelectorAll('tbody th, tbody td');
      expect(cells).toHaveLength(DATA_SOURCES.length * 5 + DATA_FILES.length * 3 + SOFTWARE_CREDITS.length * 3);
      for (const c of cells) expect(c.className).toContain(WRAP);
      const dds = container.querySelectorAll('dd');
      expect(dds).toHaveLength(DATA_SOURCES.length * 5 + DATA_FILES.length * 3 + SOFTWARE_CREDITS.length * 3);
      for (const d of dds) expect(d.className).toContain(WRAP);

      const legend = screen.getByText(LEGEND_SOURCE.citation, { exact: false });
      expect(legend.className).toContain(WRAP);
      for (const c of CANGJIE_CITATIONS) {
        const li = screen.getByText(c.url, { exact: false }).closest('li') as HTMLElement;
        expect(li.className).toContain(WRAP);
      }
    });
  });

  describe('Data files section (proof-pass Requirement 7)', () => {
    const repoRoot = resolve(__dirname, '../../..');
    const jsonIn = (dir: string): string[] =>
      readdirSync(resolve(repoRoot, dir)).filter((n) => n.endsWith('.json'));

    it('names every .json file in app/public/data on the screen', () => {
      render(<Credits onBack={() => {}} backTo="menu" />);
      const names = jsonIn('app/public/data');
      expect(names.length).toBeGreaterThan(0);
      for (const n of names) expect(text(), `${n} missing from the screen`).toContain(n);
    });

    it('names every .json file in oracle/power/data on the screen', () => {
      render(<Credits onBack={() => {}} backTo="menu" />);
      const names = jsonIn('oracle/power/data');
      expect(names.length).toBeGreaterThan(0);
      for (const n of names) expect(text(), `${n} missing from the screen`).toContain(n);
    });

    it('shows each file as a table row with what it holds and its sources and licences', () => {
      const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
      const table = container.querySelector('table[aria-labelledby="credits-files"]') as HTMLElement;
      expect(screen.getByRole('heading', { name: 'Data files' })).toBeInTheDocument();
      for (const f of DATA_FILES) {
        const row = within(table).getByRole('rowheader', { name: f.path }).closest('tr') as HTMLElement;
        expect(Array.from(row.querySelectorAll('th,td')).map((c) => c.textContent)).toEqual([
          f.path,
          f.holds,
          f.sources,
        ]);
      }
    });

    it('names the Arphic Public License for the stroke outlines held by levels.json', () => {
      const levels = DATA_FILES.find((f) => f.path === 'levels.json');
      expect(levels?.sources).toContain('hanzi-writer-data (Arphic Public License)');
      expect(levels?.holds).toContain('stroke outlines');
    });

    it('uses only licence names that DATA_SOURCES already states, and no Han glyph', () => {
      const known = new Set(DATA_SOURCES.map((s) => s.licence));
      for (const f of DATA_FILES) {
        expect(f.path + f.holds + f.sources).not.toMatch(/\p{Script=Han}/u);
        for (const l of ['Arphic Public License', 'GNU LGPL v3.0-or-later', 'CC BY-SA 4.0', 'MIT']) {
          if (f.sources.includes(l)) expect(Array.from(known).some((k) => k.startsWith(l))).toBe(true);
        }
      }
    });
  });

  it('lets every Fonts list item wrap anywhere, so a long copyright line fits 320 px (Requirement 28)', () => {
    const { container } = render(<Credits onBack={() => {}} backTo="menu" />);
    const items = container.querySelectorAll('section[aria-labelledby="credits-fonts"] ul > li');
    expect(items).toHaveLength(FONTS.length);
    for (const li of items) expect(li.className).toContain('[overflow-wrap:anywhere]');
  });

  it('has a 44px Back to menu button that calls onBack', async () => {
    const onBack = vi.fn();
    render(<Credits onBack={onBack} backTo="menu" />);
    const btn = screen.getByRole('button', { name: 'Back to menu' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className.split(/\s+/)).toContain('slip');
    expect(btn.className).toContain('focus-visible:ring');
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('Credits back label', () => {
  it('says "Back to menu" or "Back to the intro" by origin', () => {
    const { rerender } = render(<Credits onBack={() => {}} backTo="menu" />);
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument();
    rerender(<Credits onBack={() => {}} backTo="intro" />);
    expect(screen.getByRole('button', { name: 'Back to the intro' })).toBeInTheDocument();
  });
});
