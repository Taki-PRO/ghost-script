// Unit tests for the accuracy-reviewer custom agent files (config and prompt text only;
// live agent behaviour is shown in the demo).
//
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.3
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Rule {
  capability: string;
  match: string[];
  effect: string;
}
interface AgentConfig {
  name: string;
  prompt: string;
  tools: string[];
  permissions: { rules: Rule[] };
  resources: string[];
}

const repoPath = (rel: string): string => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const config = JSON.parse(readFileSync(repoPath('.kiro/agents/accuracy-reviewer.json'), 'utf8')) as AgentConfig;
const promptRel = config.prompt.replace(/^file:\/\/\.\//, '.kiro/agents/');
const prompt = existsSync(repoPath(promptRel)) ? readFileSync(repoPath(promptRel), 'utf8') : '';
const lower = prompt.toLowerCase();
const rules = config.permissions.rules;

describe('accuracy-reviewer agent config', () => {
  it('is named accuracy-reviewer', () => {
    expect(config.name).toBe('accuracy-reviewer');
  });

  it('has only the read tool category', () => {
    expect(config.tools).toEqual(['read']);
  });

  it.each(['fs_write', 'shell'])('denies %s', (capability) => {
    expect(rules.some((r) => r.capability === capability && r.effect === 'deny')).toBe(true);
  });

  it.each(['fs_write', 'shell'])('has no allow rule for %s', (capability) => {
    expect(rules.some((r) => r.capability === capability && r.effect === 'allow')).toBe(false);
  });

  it('lists content-accuracy.md as a resource', () => {
    expect(config.resources.some((r) => r.endsWith('content-accuracy.md'))).toBe(true);
  });

  it('points at a prompt file that exists', () => {
    expect(config.prompt.startsWith('file://')).toBe(true);
    expect(existsSync(repoPath(promptRel))).toBe(true);
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('every file:// resource exists in the repo', () => {
    for (const resource of config.resources) {
      expect(resource.startsWith('file://')).toBe(true);
      expect(existsSync(repoPath(resource.slice('file://'.length))), resource).toBe(true);
    }
  });
});

describe('accuracy-reviewer prompt text', () => {
  it.each([
    ['1970s', '1970s'],
    ['Chu Bong-Foo', 'chu bong-foo'],
    ['legendary inventor', 'legendary inventor'],
    ['QWERTY', 'qwerty'],
    ['1982', '1982'],
  ])('mentions History_Claims topic %s', (_label, needle) => {
    expect(lower).toContain(needle);
  });

  it.each(['"dead"', '"dying"'])('mentions %s', (word) => {
    expect(prompt).toContain(word);
  });

  it.each([
    'CC-CEDICT',
    'CC BY-SA 4.0',
    'Arphic Public License',
    'Make Me a Hanzi',
    'LGPL',
    'HSK 3.0',
    'MIT',
    'Unihan',
    'Unicode License V3',
  ])('names licence item %s', (needle) => {
    expect(prompt).toContain(needle);
  });

  it('covers the Answer_Leak rule', () => {
    expect(lower).toContain('answer');
  });

  it('defines the path:line output format and the No findings result', () => {
    expect(prompt).toContain('path:line');
    expect(prompt).toContain('No findings');
  });
});
