/**
 * Prints the first ten ghosts of level 2 and level 3 in the app's learning
 * order (harder-ghosts, task 12.3). Read-only. Started with `npm run report:ghosts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterRecord } from '../app/src/data/types';
import { formatFirstGhosts } from './lib/report-first-ghosts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const blocks = ([2, 3] as const).map((level) => {
  const file = join(root, 'app', 'public', 'data', `characters-level${level}.json`);
  const records = JSON.parse(readFileSync(file, 'utf8')) as Record<string, CharacterRecord>;
  return formatFirstGhosts(level, records);
});
console.log(blocks.join('\n\n'));
