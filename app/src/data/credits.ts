import { PROMPT_COUNTS } from './promptCounts.generated';

export interface DataSourceCredit {
  readonly name: string;
  readonly version: string;
  readonly use: string;
  readonly licence: string;
  readonly url: string;
}

/** The rows of the README "Data and licences" table, same wording (Markdown backticks removed). */
export const DATA_SOURCES: readonly DataSourceCredit[] = [
  {
    name: 'hanzi-writer-data',
    version: 'version 2.0.1',
    use: 'stroke data (strokes, medians, radStrokes)',
    licence: 'Arphic Public License',
    url: 'https://github.com/chanind/hanzi-writer-data',
  },
  {
    name: 'Make Me a Hanzi (dictionary.txt)',
    version: 'commit bddc96d41bef78427ed0e034e9f7e31d71fd1b92',
    use: 'decomposition / radical / etymology',
    licence: 'GNU LGPL v3.0-or-later',
    url: 'https://github.com/skishore/makemeahanzi',
  },
  {
    name: 'CC-CEDICT',
    version: 'release 2026-11-06',
    use: 'pinyin + English meanings',
    licence: 'CC BY-SA 4.0',
    url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
  },
  {
    name: 'Unihan (Unihan_DictionaryLikeData.txt, field kCangjie)',
    version: 'Unicode 18.0.0',
    use: 'Cangjie codes',
    licence: 'Unicode License V3 (SPDX Unicode-3.0)',
    url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  },
  {
    name: 'Character list — HSK 3.0 writing levels 1 to 3',
    version:
      'commit 4ff9e3915ce87baaecd7ebe263085573a4ea3192 (ivankra/hsk30), original standard Ministry of Education GF0025-2021 (2021)',
    use: 'the 300, 400 and 500 characters taught in the app, in three levels',
    licence: 'MIT',
    url: 'https://github.com/ivankra/hsk30',
  },
];

export interface DataFileCredit {
  readonly path: string;
  readonly holds: string;
  readonly sources: string;
}

const LEVEL_FILE_SOURCES =
  'hanzi-writer-data (Arphic Public License); Make Me a Hanzi (dictionary.txt) (GNU LGPL v3.0-or-later); CC-CEDICT (CC BY-SA 4.0); Unihan (Unicode License V3 (SPDX Unicode-3.0)); Character list — HSK 3.0 writing levels 1 to 3 (MIT)';

/**
 * The data files the app ships and what each holds, with the sources and licences of its fields.
 * Names and licences are copied from DATA_SOURCES; no new licence claim. The rows of the README
 * "Data files shipped" table, same wording (Markdown backticks removed).
 */
export const DATA_FILES: readonly DataFileCredit[] = [
  {
    path: 'characters.json',
    holds: 'the 300 level 1 records: pinyin, meanings, strokes, decompositions, Cangjie codes',
    sources: LEVEL_FILE_SOURCES,
  },
  {
    path: 'characters-level2.json',
    holds: 'the 400 level 2 records: pinyin, meanings, strokes, decompositions, Cangjie codes',
    sources: LEVEL_FILE_SOURCES,
  },
  {
    path: 'characters-level3.json',
    holds: 'the 500 level 3 records: pinyin, meanings, strokes, decompositions, Cangjie codes',
    sources: LEVEL_FILE_SOURCES,
  },
  {
    path: 'levels.json',
    holds:
      'per level: record count, average strokes, three English example meanings, one sample character with its stroke outlines',
    sources:
      'derived from the level files (CC-CEDICT (CC BY-SA 4.0); Character list — HSK 3.0 writing levels 1 to 3 (MIT)) and the stroke outlines of three characters from hanzi-writer-data (Arphic Public License), with the terms of those sources',
  },
  {
    path: 'legend-strokes.json',
    holds: "the stroke outlines of the six characters of the intro's legend line",
    sources: 'hanzi-writer-data (Arphic Public License)',
  },
  {
    path: 'oracle/power/data/oracle-data.json',
    holds: 'a copy of the three level files with the Cangjie code and decomposition fields, for the Kiro Power',
    sources: 'Unihan (Unicode License V3 (SPDX Unicode-3.0)); Make Me a Hanzi (dictionary.txt) (GNU LGPL v3.0-or-later)',
  },
];

/** Combined-work statement, from the README "Licensing summary". */
export const COMBINED_WORK_NOTE =
  'characters.json is a combined work. It incorporates CC BY-SA 4.0 data (CC-CEDICT), LGPL-3.0-or-later data (Make Me a Hanzi dictionary.txt), Arphic Public License data (hanzi-writer-data) and Unicode License V3 data (Unihan kCangjie Cangjie codes). It carries the licence terms of each source for its fields.';

export const CODE_LICENCE = 'MIT';

export interface FontCredit {
  readonly name: string;
  readonly licence: string;
  readonly copyright: string;
  /** npm package name. Absent for a font that is not installed through npm. */
  readonly pkg?: string;
  /** Package version, or the release tag for a font that is not an npm package. */
  readonly version: string;
  /** Source URL, for a font that is not an npm package. */
  readonly url?: string;
}

export const FONTS: readonly FontCredit[] = [
  {
    name: 'Cormorant Garamond',
    licence: 'SIL Open Font License 1.1',
    copyright: 'Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)',
    pkg: '@fontsource/cormorant-garamond',
    version: '5.3.0',
  },
  {
    name: 'LXGW WenKai Regular',
    licence: 'SIL Open Font License 1.1',
    copyright:
      "Copyright 2021-2026 LXGW (https://github.com/lxgw/LxgwWenKai), with Reserved Font Name '霞鹜', '霞鶩', '落霞孤鹜', '落霞孤鶩' and 'LXGW'. Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)",
    version: 'v1.530',
    url: 'https://github.com/lxgw/LxgwWenKai',
  },
];

/** Known limitation (Requirement 16.4), also in the README "Known limitations" section. */
export const KEYBOARD_LIMITATION =
  'The Lay to rest step needs a mouse, a finger or a pen to draw each stroke, so a keyboard-only player cannot lay a ghost to rest; that player can only give up.';

/**
 * Reviewed and unreviewed clues of levels 2 and 3 (Requirement 16.5). The numbers come from
 * PROMPT_COUNTS, which the pipeline generates from the data. Shown only while `PROMPT_COUNTS.unreviewed` is above zero.
 */
export const UNREVIEWED_PROMPTS_SENTENCE = `The clues of levels 2 and 3 come from CC-CEDICT by a fixed rule. A human has reviewed ${PROMPT_COUNTS.reviewed} of the ${PROMPT_COUNTS.total} clues and has not reviewed ${PROMPT_COUNTS.unreviewed}.`;
