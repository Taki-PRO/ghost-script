import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../..');

interface HookFile {
  version: string;
  hooks: Array<{
    name: string;
    trigger: string;
    matcher: string;
    action: { type: string; command: string };
    timeout: number;
  }>;
}

const hookFile = JSON.parse(
  readFileSync(resolve(repoRoot, '.kiro/hooks/data-check-on-save.json'), 'utf8'),
) as HookFile;
const hook = hookFile.hooks[0];
const matcher = new RegExp(hook.matcher);

const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('data check hook file', () => {
  it('has version v1 and exactly one hook', () => {
    expect(hookFile.version).toBe('v1');
    expect(hookFile.hooks).toHaveLength(1);
  });

  it('fires on file save with a command action', () => {
    expect(hook.trigger).toBe('PostFileSave');
    expect(hook.action.type).toBe('command');
    expect(hook.action.command).toBe('npm run check:data --silent');
  });

  it('allows 300 seconds', () => {
    expect(hook.timeout).toBe(300);
  });
});

describe('data check hook matcher', () => {
  const accepted = [
    'data/character-list.txt',
    'data/prompt-overrides.csv',
    'data/character-list-level2.txt',
    'data/character-list-level3.txt',
    'data/prompt-overrides-level2.csv',
    'data/prompt-overrides-level3.csv',
    'data/prompt-approvals.csv',
    'data/raw/SOURCES.md',
    'data/raw/unihan/Unihan_DictionaryLikeData.txt',
  ];
  const rejected = [
    'app/public/data/characters.json',
    'data/prompt-review.csv',
    'app/src/App.tsx',
    'data/prompt-rule-changes.csv',
    'data/prompt-review-level2.csv',
    'app/public/data/characters-level2.json',
    'data/character-list-level4.txt',
    'data/prompt-overrides-level1.csv',
  ];

  for (const path of accepted) {
    it(`accepts ${path} (relative)`, () => {
      expect(matcher.test(path)).toBe(true);
    });
    it(`accepts ${path} (absolute)`, () => {
      expect(matcher.test(`${repoRoot}/${path}`)).toBe(true);
    });
  }

  for (const path of rejected) {
    it(`rejects ${path} (relative)`, () => {
      expect(matcher.test(path)).toBe(false);
    });
    it(`rejects ${path} (absolute)`, () => {
      expect(matcher.test(`${repoRoot}/${path}`)).toBe(false);
    });
  }
});

describe('root package.json scripts used by the hook', () => {
  it('defines check:data and test:data', () => {
    expect(typeof rootPackage.scripts['check:data']).toBe('string');
    expect(typeof rootPackage.scripts['test:data']).toBe('string');
  });
});
