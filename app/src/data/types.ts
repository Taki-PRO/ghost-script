// Canonical types shared by the app, data pipeline, and Cangjie Oracle MCP server.

/** Literal union of valid source dataset identifiers. */
export type DatasetId = 'cc-cedict' | 'hanzi-writer-data' | 'make-me-a-hanzi' | 'unihan';

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
  /** "unihan" when a code is present, "missing" when cangjie is null. */
  cangjie: DatasetId | 'missing';
}

/** How much of a character the Summon step can ink as its Cangjie keys are typed. */
export type SummonInkClass = 'transparent' | 'partial' | 'opaque';

/**
 * Derived field: computed by the pipeline from `decomposition`, `cangjie` and the
 * Cangjie key table. It adds no dataset and no licence.
 *
 * `transparent` and `partial` characters store `keyStrokes`: entry i lists the
 * stroke indexes that the code's key number i inks. `opaque` characters store the
 * class only.
 */
export type SummonInk =
  | { class: 'opaque' }
  | { class: 'transparent' | 'partial'; keyStrokes: number[][] };

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
  /** Verbatim Unihan kCangjie code, or null when Unihan has none. Never derived. */
  cangjie: string | null;
  /** Derived from `decomposition`, `cangjie` and the key table; see SummonInk. */
  summonInk: SummonInk;
  sources: FieldSources;
  /** Present on level 2 and 3 records only. Absent means reviewed (level 1 baseline). */
  promptReview?: PromptReview;
}

/** A writing level of the game (HSK 3.0 writing levels 1 to 3). */
export type Level = 1 | 2 | 3;

/** Whether a human has reviewed the record's ghost clue. */
export type PromptReview = 'reviewed' | 'unreviewed';

/** One entry of the Level_Manifest (app/public/data/levels.json). */
export interface LevelInfo {
  level: Level;
  /** File name of the Level_Dataset, e.g. "characters-level2.json". */
  file: string;
  /** Number of records in the level. */
  count: number;
  /** Mean stroke count of the level's records, rounded to one decimal. */
  averageStrokes: number;
  /** English example meanings, never a character. */
  exampleMeanings: string[];
}

/** The Level_Manifest: one LevelInfo per level, in level order. */
export interface LevelManifest {
  levels: LevelInfo[];
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
  promptFailure?: 'no-usable-sense' | 'chinese-in-meaning';
  /** Set with `chinese-in-meaning`: the level whose displayed meaning has a Han character. */
  level?: Level;
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
  /** Level being built. Absent or 1: no promptReview field is written. */
  level?: Level;
  /** Path to prompt-approvals.csv (optional; absent file means no approvals). */
  promptApprovalsPath?: string;
  /**
   * Path to hsk30-chars.csv (optional). Levels 2 and 3 use the Clue_Rule only
   * when it is given; otherwise, and always at level 1, the Current_Rule runs.
   */
  hskCharsPath?: string;
  /** Path to the Unihan_DictionaryLikeData.txt file. */
  unihanPath: string;
  /** Expected SHA-256 (hex) of the Unihan file. */
  unihanSha256: string;
}

/** A character whose Unihan kCangjie value could not be used. */
export interface CangjieError {
  character: string;
  values: string[];
  reason: 'invalid-format' | 'multiple-values';
}

/** Return type of buildDataset(). */
/** One level 2 or 3 prompt that the Clue_Rule changed from the Current_Rule's. */
export interface RuleChange {
  character: string;
  level: 2 | 3;
  oldPinyin: string;
  oldMeaning: string;
  newPinyin: string;
  newMeaning: string;
}

export type BuildResult =
  | {
      ok: true;
      output: string; // serialised JSON
      promptReviewCsv: string;
      /** Level 2 and 3 prompt changes in list order; empty for level 1. */
      ruleChanges: RuleChange[];
      /** Characters whose cangjie is null. */
      cangjieMissing: string[];
      /** Characters for which isPlayableInCangjie is false. */
      notPlayable: string[];
      /** Number of records in each Summon_Ink class. */
      summonInkCounts: Record<SummonInkClass, number>;
    }
  | { ok: false; errors: MissingFieldError[]; cangjieErrors: CangjieError[] };
