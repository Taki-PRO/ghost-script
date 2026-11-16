export interface DataSourceCredit {
  readonly name: string;
  readonly version: string;
  readonly use: string;
  readonly licence: string;
  readonly url: string;
}

/** The five rows of the README "Data and licences" table, same wording (Markdown backticks removed). */
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
    name: 'Character list — HSK 3.0 writing level 1',
    version:
      'commit 4ff9e3915ce87baaecd7ebe263085573a4ea3192 (ivankra/hsk30), original standard Ministry of Education GF0025-2021 (2021)',
    use: 'the ~300 characters taught in the app',
    licence: 'MIT',
    url: 'https://github.com/ivankra/hsk30',
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
  readonly pkg: string;
  readonly version: string;
}

export const FONTS: readonly FontCredit[] = [
  {
    name: 'Cormorant Garamond',
    licence: 'SIL Open Font License 1.1',
    copyright: 'Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)',
    pkg: '@fontsource/cormorant-garamond',
    version: '5.3.0',
  },
];
