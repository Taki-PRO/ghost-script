import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import { GhostPrompt } from '../components/GhostPrompt';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { DEFAULT_CONFIG } from '../engine/config';
import { SummonStep } from './SummonStep';

// hanzi-writer is mocked: no instance should render anything before the code is complete.
vi.mock('hanzi-writer', () => {
  const create = () => ({
    animateCharacter: vi.fn(() => new Promise<void>(() => undefined)),
    animateStroke: vi.fn(() => Promise.resolve()),
    cancelQuiz: vi.fn(),
    quiz: vi.fn(() => Promise.resolve()),
    showCharacter: vi.fn(() => Promise.resolve()),
    hideCharacter: vi.fn(() => Promise.resolve()),
  });
  return { default: { create } };
});

const data = realDataJson as unknown as Record<string, CharacterRecord>;
const dataset: CharacterDataset = new Map(Object.entries(data));
const playable = Object.values(data).filter((r) => isPlayableInCangjie(r.cangjie));

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');

/** Every place the character could leak: text, all attributes, document.title. */
/** Zero-opacity stroke paths are allowed (they show nothing) and are not checked. */
function isZeroOpacityPath(el: Element): boolean {
  if (el.tagName.toLowerCase() !== 'path') return false;
  const style = (el as SVGElement).style?.opacity ?? '';
  return el.getAttribute('opacity') === '0' || (style !== '' && Number(style) === 0);
}

function findLeaks(target: string): string[] {
  const leaks: string[] = [];
  if (document.title.includes(target)) leaks.push('document.title');
  for (const el of Array.from(document.querySelectorAll('*'))) {
    if (isZeroOpacityPath(el)) continue;
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes(target) || attr.name.includes(target)) {
        leaks.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`);
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent ?? '').includes(target)) leaks.push(`text: "${n.textContent}"`);
  }
  return leaks;
}

interface Variant {
  name: string;
  firstMeeting: boolean;
  withLines: boolean;
}

const VARIANTS: readonly Variant[] = [
  { name: 'returning', firstMeeting: false, withLines: false },
  { name: 'first meeting', firstMeeting: true, withLines: false },
  { name: 'first meeting with walkthrough lines', firstMeeting: true, withLines: true },
  { name: 'returning with walkthrough lines', firstMeeting: false, withLines: true },
];

function mount(record: CharacterRecord, v: Variant = VARIANTS[0]!) {
  const lines = v.withLines
    ? record.cangjie!.split('').map((_, i) => `Walkthrough line ${i + 1}`)
    : undefined;
  render(
    <>
      <GhostPrompt record={record} />
      <SummonStep
        record={record}
        dataset={dataset}
        config={DEFAULT_CONFIG}
        onDone={vi.fn()}
        firstMeeting={v.firstMeeting}
        walkthroughLines={lines}
      />
    </>,
  );
}

describe('SummonStep + GhostPrompt never reveal the target before the code is complete', () => {
  afterEach(cleanup);

  it('covers every playable record', () => {
    expect(playable.length).toBeGreaterThan(0);
  });

  describe.each(VARIANTS)('$name', (variant) => {
    it.each(playable.map((r) => [r.character, r] as const))('%s', (_char, record) => {
      mount(record, variant);
      expect(findLeaks(record.character)).toEqual([]);

      const wrong = LETTERS.find((l) => l !== record.cangjie![0]!)!;
      for (let i = 0; i < DEFAULT_CONFIG.strokeHintAfterConsecutiveMisses; i++) {
        fireEvent.keyDown(window, { key: wrong });
      }
      expect(screen.getByRole('status').textContent).toContain('Hint: press');
      expect(findLeaks(record.character)).toEqual([]);
    });

    it.each(playable.map((r) => [r.character, r] as const))(
      '%s stays hidden after each correct key before the last',
      (_char, record) => {
        mount(record, variant);
        const code = record.cangjie!.toUpperCase();
        for (let i = 0; i < code.length - 1; i++) {
          fireEvent.keyDown(window, { key: code[i] });
          expect(findLeaks(record.character)).toEqual([]);
        }
        if (record.summonInk.class === 'opaque') {
          expect(screen.getByTestId('opaque-note').textContent).not.toContain(record.character);
        }
      },
    );
  });
});
