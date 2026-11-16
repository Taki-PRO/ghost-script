export interface Citation {
  readonly title: string;
  readonly url: string;
}

/** English Wikipedia articles that source every Cangjie claim in the app (content-accuracy.md). */
export const CANGJIE_CITATIONS: readonly Citation[] = [
  { title: 'Cangjie input method', url: 'https://en.wikipedia.org/wiki/Cangjie_input_method' },
  { title: 'Chu Bong-Foo', url: 'https://en.wikipedia.org/wiki/Chu_Bong-Foo' },
];

export interface LegendSource {
  readonly zh: string;
  readonly english: string;
  readonly citation: string;
}

/** The approved legend line (content-accuracy.md, "Approved legend line"). The English rendering is our own. */
export const LEGEND_SOURCE: LegendSource = {
  zh: '天雨粟，鬼夜哭',
  english: 'Heaven rained grain and ghosts wept at night.',
  citation:
    'D. C. Lau et al., A Concordance to the Huainanzi (Commercial Press, Hong Kong, 1992), 8/62/27–28, as quoted in Michael Puett, "Sages, Creation, and the End of History in the Huainanzi" (https://scholar.harvard.edu/sites/scholar.harvard.edu/files/puett/files/puett_sages_in_the_huainanzi_2.pdf).',
};
