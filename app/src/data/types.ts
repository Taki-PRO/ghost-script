// Canonical types shared by the app, data pipeline, and Cangjie Oracle MCP server.

/** Literal union of valid source dataset identifiers. */
export type DatasetId = 'cc-cedict' | 'hanzi-writer-data' | 'make-me-a-hanzi';

/** Required fields whose absence constitutes a pipeline error. */
export type RequiredField =
  | 'pinyin'
  | 'meanings'
  | 'strokeCount'
  | 'strokeData'
  | 'decomposition';

/** Etymology variants from Make Me a Hanzi. */
export type Etymology =
  | { type: 'ideographic' | 'pictographic'; hint: string }
  | {
      type: 'pictophonetic';
      hint: string | null;
      phonetic: string | null;
      semantic: string | null;
    };

/** Verbatim stroke data from hanzi-writer-data. */
export interface StrokeData {
  strokes: string[];
  medians: number[][][];
  radStrokes: number[];
}

/**
 * Decomposition from Make Me a Hanzi — includes atomic + components fields.
 *
 * components contains leaf components from:
 *   - CJK Unified Ideographs  U+4E00–U+9FFF
 *   - CJK Extension A          U+3400–U+4DBF
 *   - CJK Radicals Supplement  U+2E80–U+2EFF
 *   - Kangxi Radicals           U+2F00–U+2FDF
 *   - CJK Strokes               U+31C0–U+31EF
 *
 * For atomic records (decomposition starts with ？ U+FF1F), components = [character].
 */
export interface Decomposition {
  /** IDS string from Make Me a Hanzi (verbatim). */
  decomposition: string;
  radical: string;
  etymology: Etymology | null;
  matches: (number[] | null)[] | null;
  /** true if decomposition starts with ？ (U+FF1F). */
  atomic: boolean;
  /** Leaf components extracted from the IDS string; [character] for atomic records. */
  components: string[];
}

/** The chosen ghost clue for a character (see Requirement 6). */
export interface Prompt {
  /** Chosen English gloss, "(bound form) " prefix stripped; non-empty. */
  meaning: string;
  /** Chosen reading rendered with tone marks, e.g. "shàng"; non-empty. */
  pinyin: string;
}

/** Maps each field to the dataset it was sourced from. */
export interface FieldSources {
  pinyin: DatasetId;        // always "cc-cedict"
  meanings: DatasetId;      // always "cc-cedict"
  strokeCount: DatasetId;   // always "hanzi-writer-data"
  strokeData: DatasetId;    // always "hanzi-writer-data"
  decomposition: DatasetId; // always "make-me-a-hanzi"
}

/** The canonical record for one character in characters.json. */
export interface CharacterRecord {
  /** Single CJK codepoint, e.g. "我". */
  character: string;
  /** Always non-empty in a built record. */
  pinyin: string[];
  /** Always non-empty in a built record. */
  meanings: string[];
  /** Integer >= 1. */
  strokeCount: number;
  strokeData: StrokeData;
  /** Always non-null; atomic=true when character is indivisible. */
  decomposition: Decomposition;
  /** Always non-null; the chosen ghost clue (see Requirement 6). */
  prompt: Prompt;
  sources: FieldSources;
}

/**
 * Reason a prompt override could not be applied, discovered during the build
 * when the override's indices are checked against the character's merged
 * CC-CEDICT data. `unknown-character` means the override named a character that
 * is not in character-list.txt.
 */
export type PromptOverrideFailure =
  | 'unknown-character'
  | 'entry-index-out-of-range'
  | 'meaning-index-out-of-range';

/**
 * Error type returned by the pipeline for a character that could not be built.
 *
 * `missingFields` lists any absent required fields (may be empty when the only
 * problem is a prompt failure). `promptFailure` is set when prompt selection
 * yielded no usable sense. `overrideError` is set when a human override for this
 * character referenced an out-of-range index (or an unknown character).
 */
export interface MissingFieldError {
  character: string;
  missingFields: RequiredField[];
  /** Set when prompt selection found no usable sense for the character. */
  promptFailure?: 'no-usable-sense';
  /** Set when a human override for this character was out of range / unknown. */
  overrideError?: PromptOverrideFailure;
}

/** Options passed to buildDataset(). */
export interface BuildOptions {
  /** Path to character-list.txt. */
  characterListPath: string;
  /** Path to hanzi-writer-data directory. */
  hanziWriterDataDir: string;
  /** Path to dictionary.txt (Make Me a Hanzi). */
  makeMeAHanziPath: string;
  /** Path to cedict_ts.u8 (CC-CEDICT). */
  ccCedictPath: string;
  /** Path to prompt-overrides.csv (optional; absent file means no overrides). */
  promptOverridesPath?: string;
  /** Path to write prompt-review.csv on success (optional). */
  promptReviewPath?: string;
}

/** Return type of buildDataset(). */
export type BuildResult =
  | { ok: true; output: string; promptReviewCsv: string } // serialised JSON + review CSV
  | { ok: false; errors: MissingFieldError[] };
