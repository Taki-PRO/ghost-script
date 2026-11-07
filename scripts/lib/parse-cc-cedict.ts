// Parser for the CC-CEDICT dictionary file (cedict_ts.u8).
//
// A CC-CEDICT data line has the structure:
//
//   Traditional Simplified [pin1 yin1] /meaning1/meaning2/
//
// Lines starting with `#` are comments and are skipped. This parser keys the
// resulting Map by the SIMPLIFIED field exactly as it appears in the source.
// For each key, all matching entries are collected in file order; pinyin and
// meanings are deduplicated while preserving first-occurrence order.

/** A single source entry (one source line) for a simplified string. */
export interface CcCedictSense {
  /** Numbered pinyin for this entry, e.g. "liao3". */
  reading: string;
  /** This entry's glosses, in source order. */
  meanings: string[];
}

/** Parsed CC-CEDICT data for a single simplified string. */
export interface CcCedictEntry {
  /** Distinct pinyin strings in first-occurrence order. */
  pinyin: string[];
  /** Distinct meaning strings in first-occurrence order. */
  meanings: string[];
  /** Per-entry senses in source order (reading + its glosses); no dedup. */
  entries: CcCedictSense[];
}

// Matches a single CC-CEDICT data line, capturing:
//   1. traditional field (non-greedy up to the first space before Simplified)
//   2. simplified field
//   3. the pinyin contents between the surrounding square brackets
//   4. the meaning block between the surrounding slashes
//
// The traditional and simplified fields are whitespace-delimited and may not
// contain spaces themselves, so `\S+` is safe for both.
const DATA_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/;

/**
 * Parse the full text of a CC-CEDICT file into a Map keyed by the simplified
 * string. Comment lines (`#`-prefixed) and blank lines are skipped. Lines that
 * do not match the expected data-line shape are ignored.
 */
export function parseCcCedict(rawText: string): Map<string, CcCedictEntry> {
  const result = new Map<string, CcCedictEntry>();

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const match = DATA_LINE.exec(line);
    if (match === null) {
      continue;
    }

    const simplified = match[2];
    const pinyin = match[3].trim();
    // Meanings are the `/`-delimited segments between the surrounding slashes.
    // Empty segments (from doubled slashes or trailing slashes) are dropped.
    const meanings = match[4]
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    let entry = result.get(simplified);
    if (entry === undefined) {
      entry = { pinyin: [], meanings: [], entries: [] };
      result.set(simplified, entry);
    }

    if (pinyin.length > 0 && !entry.pinyin.includes(pinyin)) {
      entry.pinyin.push(pinyin);
    }
    for (const meaning of meanings) {
      if (!entry.meanings.includes(meaning)) {
        entry.meanings.push(meaning);
      }
    }

    // Additionally retain this source line as a distinct sense, in file order
    // with no cross-entry dedup.
    entry.entries.push({ reading: pinyin, meanings });
  }

  return result;
}
