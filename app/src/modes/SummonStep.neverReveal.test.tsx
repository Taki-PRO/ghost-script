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
function findLeaks(target: string): string[] {
  const leaks: string[] = [];
  if (document.title.includes(target)) leaks.push('document.title');
  for (const el of Array.from(document.querySelectorAll('*'))) {
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

function mount(record: CharacterRecord) {
  render(
    <>
      <GhostPrompt record={record} />
      <SummonStep record={record} dataset={dataset} config={DEFAULT_CONFIG} onDone={vi.fn()} />
    </>,
  );
}

describe('SummonStep + GhostPrompt never reveal the target before the code is complete', () => {
  afterEach(cleanup);

  it('covers every playable record', () => {
    expect(playable.length).toBeGreaterThan(0);
  });

  it.each(playable.map((r) => [r.character, r] as const))('%s', (_char, record) => {
    mount(record);
    expect(findLeaks(record.character)).toEqual([]);

    const wrong = LETTERS.find((l) => l !== record.cangjie![0]!)!;
    for (let i = 0; i < DEFAULT_CONFIG.strokeHintAfterConsecutiveMisses; i++) {
      fireEvent.keyDown(window, { key: wrong });
    }
    expect(screen.getByRole('status').textContent).toContain('Hint: press');
    expect(findLeaks(record.character)).toEqual([]);
  });
});
