// Parser for the `Examples` column of the HSK 3.0 character CSV
// (`data/raw/hsk30/hsk30-chars.csv`). Pure: takes the file text.
//
// Header: `Hanzi,Level,WritingLevel,Traditional,Freq,Examples`. Every data line
// has exactly six comma-separated fields and the file has no quoted field, so
// a line is split on its first five commas and the rest is the Examples cell.
// Only rows with a non-empty `WritingLevel` are kept.

/**
 * Map each character that has a writing level to the words of its Examples
 * cell (split on whitespace, in source order). Rows without a writing level,
 * the header, blank lines and lines with fewer than six fields are skipped.
 */
export function parseHskExamples(csvText: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const lines = csvText.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trim().length === 0) {
      continue;
    }
    const fields: string[] = [];
    let start = 0;
    for (let n = 0; n < 5; n++) {
      const comma = line.indexOf(',', start);
      if (comma === -1) {
        break;
      }
      fields.push(line.slice(start, comma));
      start = comma + 1;
    }
    if (fields.length < 5) {
      continue;
    }
    fields.push(line.slice(start));
    const hanzi = fields[0].trim();
    const writingLevel = fields[2].trim();
    if (hanzi.length === 0 || writingLevel.length === 0) {
      continue;
    }
    result.set(hanzi, fields[5].split(/\s+/).filter((w) => w.length > 0));
  }
  return result;
}
