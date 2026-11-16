export interface SoftwareCredit {
  readonly name: string;
  readonly version: string;
  readonly licence: string;
}

/**
 * Runtime packages shipped in the app, one per package in THIRD_PARTY_NOTICES.txt,
 * ascending by name. Written by hand; tests/unit/third-party-notices.test.ts keeps it in step.
 */
export const SOFTWARE_CREDITS: readonly SoftwareCredit[] = [
  { name: '@fontsource/cormorant-garamond', version: '5.3.0', licence: 'OFL-1.1' },
  { name: 'hanzi-writer', version: '3.7.3', licence: 'MIT' },
  { name: 'js-tokens', version: '4.0.0', licence: 'MIT' },
  { name: 'loose-envify', version: '1.4.0', licence: 'MIT' },
  { name: 'react', version: '18.3.1', licence: 'MIT' },
  { name: 'react-dom', version: '18.3.1', licence: 'MIT' },
  { name: 'scheduler', version: '0.23.2', licence: 'MIT' },
];
