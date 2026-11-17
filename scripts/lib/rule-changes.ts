// Renders the Rule_Changes_File (data/prompt-rule-changes.csv): one row per
// level 2 or level 3 character whose prompt the Clue_Rule changed from the
// Current_Rule's. Pure; no I/O.

import type { RuleChange } from '../../app/src/data/types';

export const RULE_CHANGES_HEADER =
  'character,level,oldPinyin,oldMeaning,newPinyin,newMeaning';

/** RFC 4180 quoting, as the Review_Files: quote on comma, quote, CR or LF. */
function field(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The CSV text for the given changes, in the order given. The header is always
 * written; lines end with `\n`, including the last.
 */
export function renderRuleChangesCsv(changes: readonly RuleChange[]): string {
  const rows = changes.map((c) =>
    [c.character, String(c.level), c.oldPinyin, c.oldMeaning, c.newPinyin, c.newMeaning]
      .map(field)
      .join(','),
  );
  return [RULE_CHANGES_HEADER, ...rows].join('\n') + '\n';
}
