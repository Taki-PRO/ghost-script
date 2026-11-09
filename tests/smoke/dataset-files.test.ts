// Smoke tests: confirm the raw dataset assets and their licence files are
// present on disk, so the data pipeline can run fully offline and every
// source licence is visible in the repo.
//
// These tests assert on-disk reality only — no parsing, no fast-check. Paths
// are resolved relative to the repo root, derived from this file's location
// (tests/smoke/ is two directories below the root).
//
// _Requirements: 2.1, 2.2, 2.3_
import { existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// This file lives in tests/smoke/, so the repo root is two directories up.
const repoRootUrl = new URL('../../', import.meta.url);

/** Resolve a repo-relative path to an absolute filesystem path. */
function fromRoot(relative: string): string {
  return fileURLToPath(new URL(relative, repoRootUrl));
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

describe('raw dataset assets and licences are present on disk', () => {
  describe('hanzi-writer-data (stroke data, Arphic Public License)', () => {
    const dir = fromRoot('data/raw/hanzi-writer-data');

    it('has its directory', () => {
      expect(isDirectory(dir), `expected directory to exist: ${dir}`).toBe(true);
    });

    it('has its LICENSE file', () => {
      const licence = fromRoot('data/raw/hanzi-writer-data/LICENSE');
      expect(isFile(licence), `expected licence file to exist: ${licence}`).toBe(true);
    });

    it('contains at least one <char>.json stroke-data file', () => {
      const jsonFiles = readdirSync(dir).filter((name) => name.endsWith('.json'));
      expect(
        jsonFiles.length,
        `expected at least one .json stroke-data file in ${dir}`,
      ).toBeGreaterThan(0);
    });
  });

  describe('Make Me a Hanzi (decompositions, GNU LGPL v3.0 or later)', () => {
    it('has dictionary.txt', () => {
      const dict = fromRoot('data/raw/make-me-a-hanzi/dictionary.txt');
      expect(isFile(dict), `expected dictionary to exist: ${dict}`).toBe(true);
    });

    it('has its LICENSE file', () => {
      const licence = fromRoot('data/raw/make-me-a-hanzi/LICENSE');
      expect(isFile(licence), `expected licence file to exist: ${licence}`).toBe(true);
    });
  });

  describe('CC-CEDICT (pinyin, meanings, CC BY-SA 4.0)', () => {
    it('has cedict_ts.u8', () => {
      const cedict = fromRoot('data/raw/cc-cedict/cedict_ts.u8');
      expect(isFile(cedict), `expected CC-CEDICT file to exist: ${cedict}`).toBe(true);
    });

    it('has its LICENSE file', () => {
      const licence = fromRoot('data/raw/cc-cedict/LICENSE');
      expect(isFile(licence), `expected licence file to exist: ${licence}`).toBe(true);
    });
  });

  describe('pipeline output location', () => {
    it('app/public/data/ directory exists', () => {
      const outDir = fromRoot('app/public/data');
      expect(isDirectory(outDir), `expected output directory to exist: ${outDir}`).toBe(true);
    });
  });

  describe('provenance record', () => {
    it('data/raw/SOURCES.md exists', () => {
      const sources = fromRoot('data/raw/SOURCES.md');
      expect(isFile(sources), `expected provenance record to exist: ${sources}`).toBe(true);
    });
  });
});
