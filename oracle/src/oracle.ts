import { isPlayableInCangjie, isValidCangjieCode } from '../../app/src/engine/cangjieRules';
import type { CharacterRecord } from '../../app/src/data/types';

export type Dataset = ReadonlyMap<string, CharacterRecord>;

export const CANGJIE_SOURCE = {
  dataset: 'unihan',
  version: '18.0.0',
  field: 'kCangjie',
  provisional: true,
} as const;
export type CangjieSource = typeof CANGJIE_SOURCE;

export type NotFound = { found: false; character: string; reason: 'not-in-dataset' };

export type LookupResult =
  | {
      found: true;
      character: string;
      cangjie: string | null;
      source: CangjieSource | null;
      playable: boolean;
    }
  | NotFound;

export type VerifyResult =
  | {
      found: true;
      character: string;
      normalisedCode: string;
      matches: boolean;
      source: CangjieSource | null;
      reason?: 'no-code-in-source';
    }
  | NotFound;

export type DecomposeResult =
  | {
      found: true;
      character: string;
      ids: string;
      atomic: boolean;
      radical: string;
      components: string[];
      source: { dataset: 'make-me-a-hanzi' };
    }
  | NotFound;

/** Invalid tool input; the server turns it into an MCP tool error. */
export class OracleInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OracleInputError';
  }
}

export function parseCharacterInput(value: unknown): string {
  const shown = typeof value === 'string' ? `"${value}"` : String(value);
  if (typeof value !== 'string' || [...value].length !== 1) {
    throw new OracleInputError(
      `character must be exactly one CJK Unified Ideograph (U+4E00 to U+9FFF), got ${shown}`,
    );
  }
  const cp = value.codePointAt(0) as number;
  if (cp < 0x4e00 || cp > 0x9fff) {
    throw new OracleInputError(
      `character must be exactly one CJK Unified Ideograph (U+4E00 to U+9FFF), got ${shown}`,
    );
  }
  return value;
}

export function parseCodeInput(value: unknown): string {
  if (typeof value !== 'string') {
    throw new OracleInputError(
      `code must be a string of 1 to 5 letters A-Y (case is ignored), got ${String(value)}`,
    );
  }
  const code = value.toUpperCase();
  if (!isValidCangjieCode(code)) {
    throw new OracleInputError(
      `code must be 1 to 5 letters A-Y (case is ignored), got "${value}"`,
    );
  }
  return code;
}

function notFound(character: string): NotFound {
  return { found: false, character, reason: 'not-in-dataset' };
}

function sourceFor(record: CharacterRecord): CangjieSource | null {
  return record.sources.cangjie === 'unihan' && record.cangjie !== null ? CANGJIE_SOURCE : null;
}

export function lookup(dataset: Dataset, character: unknown): LookupResult {
  const ch = parseCharacterInput(character);
  const record = dataset.get(ch);
  if (!record) return notFound(ch);
  const source = sourceFor(record);
  if (record.cangjie === null || source === null) {
    return { found: true, character: ch, cangjie: null, source: null, playable: false };
  }
  return {
    found: true,
    character: ch,
    cangjie: record.cangjie,
    source,
    playable: isPlayableInCangjie(record.cangjie),
  };
}

export function verify(dataset: Dataset, character: unknown, code: unknown): VerifyResult {
  const ch = parseCharacterInput(character);
  const normalisedCode = parseCodeInput(code);
  const record = dataset.get(ch);
  if (!record) return notFound(ch);
  if (record.cangjie === null) {
    return {
      found: true,
      character: ch,
      normalisedCode,
      matches: false,
      source: null,
      reason: 'no-code-in-source',
    };
  }
  return {
    found: true,
    character: ch,
    normalisedCode,
    matches: normalisedCode === record.cangjie,
    source: sourceFor(record),
  };
}

export function decompose(dataset: Dataset, character: unknown): DecomposeResult {
  const ch = parseCharacterInput(character);
  const record = dataset.get(ch);
  if (!record) return notFound(ch);
  const d = record.decomposition;
  return {
    found: true,
    character: ch,
    ids: d.decomposition,
    atomic: d.atomic,
    radical: d.radical,
    components: [...d.components],
    source: { dataset: 'make-me-a-hanzi' },
  };
}
