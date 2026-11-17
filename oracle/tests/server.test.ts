import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { OracleDataError, loadDataset } from '../src/dataset';
import { decompose, lookup, verify, type Dataset } from '../src/oracle';
import { createServer } from '../src/server';

function rec(character: string, cangjie: string | null, components: string[]): CharacterRecord {
  return {
    character,
    pinyin: ['x1'],
    meanings: ['m'],
    strokeCount: 1,
    strokeData: { strokes: [], medians: [], radStrokes: [] },
    decomposition: {
      decomposition: '⿰扌戈',
      radical: '戈',
      etymology: null,
      matches: null,
      atomic: false,
      components,
    },
    prompt: { meaning: 'm', pinyin: 'x' },
    cangjie,
    summonInk: { class: 'opaque' },
    sources: { cangjie: cangjie === null ? 'missing' : 'unihan' },
  } as unknown as CharacterRecord;
}

const dataset: Dataset = new Map([
  ['我', rec('我', 'HQI', ['扌', '戈'])],
  ['好', rec('好', null, ['女', '子'])],
]);

describe('Cangjie Oracle server', () => {
  let client: Client;

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer(dataset);
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists exactly the three tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['decompose', 'lookup', 'verify']);
  });

  it('lookup returns the same JSON as the pure function', async () => {
    const res = await client.callTool({ name: 'lookup', arguments: { character: '我' } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(lookup(dataset, '我'));
    expect(res.structuredContent).toEqual(lookup(dataset, '我'));
    expect(res.isError).toBeFalsy();
  });

  it('verify returns the same JSON as the pure function', async () => {
    const res = await client.callTool({ name: 'verify', arguments: { character: '我', code: 'hqi' } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(verify(dataset, '我', 'hqi'));
  });

  it('decompose returns the same JSON as the pure function', async () => {
    const res = await client.callTool({ name: 'decompose', arguments: { character: '好' } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(decompose(dataset, '好'));
  });

  it('returns a not-found result (not an error) for a character outside the dataset', async () => {
    const res = await client.callTool({ name: 'lookup', arguments: { character: '龍' } });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ found: false, character: '龍', reason: 'not-in-dataset' });
  });

  it('gives isError for an invalid character argument', async () => {
    const res = await client.callTool({ name: 'lookup', arguments: { character: 'ab' } });
    expect(res.isError).toBe(true);
  });

  it('gives isError for an invalid code argument', async () => {
    const res = await client.callTool({ name: 'verify', arguments: { character: '我', code: 'ZZZ' } });
    expect(res.isError).toBe(true);
  });
});

describe('loadDataset errors', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
  });
  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'oracle-test-'));
    dirs.push(dir);
    return dir;
  }

  it('throws OracleDataError naming the path for a missing file', () => {
    const path = join(tempDir(), 'missing.json');
    expect(() => loadDataset(path)).toThrow(OracleDataError);
    expect(() => loadDataset(path)).toThrow(path);
  });

  it('throws OracleDataError naming the path for invalid JSON', () => {
    const path = join(tempDir(), 'bad.json');
    writeFileSync(path, '{not json');
    expect(() => loadDataset(path)).toThrow(OracleDataError);
    expect(() => loadDataset(path)).toThrow(path);
  });
  it('throws OracleDataError naming the character when it appears in two files', () => {
    const dir = tempDir();
    const a = join(dir, 'a.json');
    const b = join(dir, 'b.json');
    const record = {
      character: '我',
      cangjie: 'HQI',
      sources: {},
      decomposition: { decomposition: '⿱', atomic: false, radical: '戈', components: [] },
    };
    writeFileSync(a, JSON.stringify({ 我: record }));
    writeFileSync(b, JSON.stringify({ 我: record }));
    expect(() => loadDataset([a, b])).toThrow(OracleDataError);
    expect(() => loadDataset([a, b])).toThrow('我');
  });
  it('fails when one file of a list is missing', () => {
    const dir = tempDir();
    const a = join(dir, 'a.json');
    writeFileSync(a, '{}');
    const missing = join(dir, 'level2.json');
    expect(() => loadDataset([a, missing])).toThrow(missing);
  });
});
