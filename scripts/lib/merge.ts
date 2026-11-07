// Pure merge function: assembles a canonical CharacterRecord from the three
// per-character parsed entries (hanzi-writer-data, Make Me a Hanzi, CC-CEDICT).
//
// This function never throws. When any required field is absent it returns a
// failure result listing every missing field (stable order). Missing-field
// handling for the pipeline as a whole lives in build-data.ts, which collects
// these failures across all characters (fail-slow).

import type {
  CharacterRecord,
  FieldSources,
  Prompt,
  RequiredField,
} from '../../app/src/data/types';
import type { HanziWriterEntry } from './parse-hanzi-writer-data';
import type { MakeMeAHanziEntry } from './parse-make-me-a-hanzi';
import type { CcCedictEntry } from './parse-cc-cedict';

export type MergeResult =
  | { ok: true; record: CharacterRecord }
  | { ok: false; missingFields: RequiredField[] };

/**
 * Assembles a CharacterRecord from the three parsed entries for a character.
 *
 * Pure: depends only on its arguments, never reads I/O, never throws.
 *
 * Required-field rules:
 *   - pinyin:       cc-cedict present AND ccCedict.pinyin non-empty
 *   - meanings:     cc-cedict present AND ccCedict.meanings non-empty
 *   - strokeCount:  hanzi-writer present AND hanziWriter.strokes non-empty
 *   - strokeData:   hanzi-writer present AND hanziWriter.strokes non-empty
 *   - decomposition: make-me-a-hanzi present
 *
 * The `prompt` is resolved by the build (prompt selection is not a merge
 * concern); merge simply places the already-chosen Prompt into the record so
 * that merge stays pure and prompt-selection failures are handled fail-slow in
 * the build.
 *
 * @returns { ok: true, record } when every required field is present;
 *          otherwise { ok: false, missingFields } listing every absent field
 *          in the stable order
 *          pinyin, meanings, strokeCount, strokeData, decomposition.
 */
export function mergeCharacter(
  char: string,
  hanziWriter: HanziWriterEntry | undefined,
  makeMeAHanzi: MakeMeAHanziEntry | undefined,
  ccCedict: CcCedictEntry | undefined,
  prompt: Prompt,
): MergeResult {
  const missingFields: RequiredField[] = [];

  const hasPinyin = ccCedict !== undefined && ccCedict.pinyin.length > 0;
  const hasMeanings = ccCedict !== undefined && ccCedict.meanings.length > 0;
  const hasStrokes =
    hanziWriter !== undefined && hanziWriter.strokes.length > 0;
  const hasDecomposition = makeMeAHanzi !== undefined;

  // Stable order: pinyin, meanings, strokeCount, strokeData, decomposition.
  if (!hasPinyin) {
    missingFields.push('pinyin');
  }
  if (!hasMeanings) {
    missingFields.push('meanings');
  }
  if (!hasStrokes) {
    missingFields.push('strokeCount');
    missingFields.push('strokeData');
  }
  if (!hasDecomposition) {
    missingFields.push('decomposition');
  }

  if (missingFields.length > 0) {
    return { ok: false, missingFields };
  }

  // All required fields are present; the narrowing above guarantees the three
  // entries are defined here, but TypeScript cannot track that across the
  // boolean flags, so we assert non-undefined locally.
  const cc = ccCedict as CcCedictEntry;
  const hw = hanziWriter as HanziWriterEntry;
  const mm = makeMeAHanzi as MakeMeAHanziEntry;

  const sources: FieldSources = {
    pinyin: 'cc-cedict',
    meanings: 'cc-cedict',
    strokeCount: 'hanzi-writer-data',
    strokeData: 'hanzi-writer-data',
    decomposition: 'make-me-a-hanzi',
  };

  const record: CharacterRecord = {
    character: char,
    pinyin: cc.pinyin,
    meanings: cc.meanings,
    strokeCount: hw.strokes.length,
    strokeData: {
      strokes: hw.strokes,
      medians: hw.medians,
      radStrokes: hw.radStrokes,
    },
    decomposition: {
      decomposition: mm.decomposition,
      radical: mm.radical,
      etymology: mm.etymology,
      matches: mm.matches,
      atomic: mm.atomic,
      components: mm.components,
    },
    prompt,
    sources,
  };

  return { ok: true, record };
}
