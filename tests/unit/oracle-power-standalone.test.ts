import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPlayableInCangjie } from '../../app/src/engine/cangjieRules';

// Power_Standalone_Test. Requirements 10.1, 10.2, 10.5, 10.11, 10.12, 9.1

const repoRoot = resolve(__dirname, '..', '..');
const powerDir = resolve(repoRoot, 'oracle/power');
const dataDir = resolve(repoRoot, 'app/public/data');

interface DatasetRecord {
  character: string;
  cangjie: string | null;
  decomposition: { decomposition: string; atomic: boolean; radical: string; components: string[] };
}
type DatasetFile = Record<string, DatasetRecord>;

function readDataset(file: string): DatasetFile {
  return JSON.parse(readFileSync(resolve(dataDir, file), 'utf8')) as DatasetFile;
}

interface McpFile {
  mcpServers: Record<string, { command?: string; args?: string[]; cwd?: string }>;
}

const datasets = {
  1: readDataset('characters.json'),
  2: readDataset('characters-level2.json'),
  3: readDataset('characters-level3.json'),
};

// The first record with a Cangjie code in each file, in file order.
function firstCoded(level: 1 | 2 | 3): DatasetRecord {
  const record = Object.values(datasets[level]).find((r) => r.cangjie !== null);
  if (!record) throw new Error(`no coded record in level ${level}`);
  return record;
}

const MING = '明';
const samples: { label: string; record: DatasetRecord }[] = [
  { label: '明', record: datasets[1][MING] },
  { label: 'level 1', record: firstCoded(1) },
  { label: 'level 2', record: firstCoded(2) },
  { label: 'level 3', record: firstCoded(3) },
];

type ToolReply = { isError?: boolean; structuredContent?: Record<string, unknown> };

let tempRoot = '';
let copyDir = '';
let client: Client | undefined;
let transport: StdioClientTransport | undefined;

async function call(name: string, args: Record<string, string>): Promise<ToolReply> {
  return (await (client as Client).callTool({ name, arguments: args })) as ToolReply;
}

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), 'oracle-power-standalone-'));
  copyDir = join(tempRoot, 'power');
  cpSync(powerDir, copyDir, { recursive: true });

  const mcp = JSON.parse(readFileSync(resolve(powerDir, 'mcp.json'), 'utf8')) as McpFile;
  const server = mcp.mcpServers['cangjie-oracle'];
  const args = (server.args ?? []).map((a) => a.replace('${PLUGIN_ROOT}', copyDir));
  const cwd = (server.cwd ?? '').replace('${PLUGIN_ROOT}', copyDir);

  const env = getDefaultEnvironment();
  delete env.NODE_PATH;
  transport = new StdioClientTransport({ command: process.execPath, args, cwd, env, stderr: 'pipe' });
  client = new Client({ name: 'power-standalone-test', version: '0.0.0' });
  await client.connect(transport);
}, 30_000);

afterAll(async () => {
  try {
    await client?.close();
  } catch {
    // the process is killed below anyway
  }
  try {
    await transport?.close();
  } catch {
    // ignore
  }
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
}, 30_000);

describe('Power_Standalone_Test', () => {
  it('runs from a copy outside the repository with no node_modules above it', () => {
    expect(copyDir.startsWith(repoRoot + sep)).toBe(false);
    expect(process.env.NODE_PATH ?? '').toBe('');
    for (let dir = dirname(copyDir); ; dir = dirname(dir)) {
      expect(existsSync(join(dir, 'node_modules'))).toBe(false);
      if (dirname(dir) === dir) break;
    }
    expect(existsSync(join(copyDir, 'node_modules'))).toBe(false);
    expect(existsSync(join(copyDir, 'server.mjs'))).toBe(true);
  });

  it('mcp.json launches plain node on server.mjs in the plugin root', () => {
    const mcp = JSON.parse(readFileSync(resolve(powerDir, 'mcp.json'), 'utf8')) as McpFile;
    const server = mcp.mcpServers['cangjie-oracle'];
    expect(server.command).toBe('node');
    expect(server.args).toEqual(['${PLUGIN_ROOT}/server.mjs']);
    expect(server.cwd).toBe('${PLUGIN_ROOT}');
  });

  it('stores AB for 明 in the app dataset', () => {
    expect(datasets[1][MING].cangjie).toBe('AB');
  });

  it('lists exactly lookup, verify and decompose', async () => {
    const { tools } = await (client as Client).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['decompose', 'lookup', 'verify']);
  }, 30_000);

  for (const { label, record } of samples) {
    describe(`${label} (${record?.character})`, () => {
      it('lookup returns the stored code and playability', async () => {
        const code = record.cangjie as string;
        const r = await call('lookup', { character: record.character });
        expect(r.isError).toBeFalsy();
        expect(r.structuredContent).toMatchObject({
          found: true,
          character: record.character,
          cangjie: code,
          playable: isPlayableInCangjie(code),
          source: { dataset: 'unihan', field: 'kCangjie' },
        });
      }, 30_000);

      it('verify accepts the stored code', async () => {
        const r = await call('verify', { character: record.character, code: record.cangjie as string });
        expect(r.isError).toBeFalsy();
        expect(r.structuredContent).toMatchObject({
          found: true,
          character: record.character,
          matches: true,
          normalisedCode: record.cangjie,
        });
      }, 30_000);

      it('decompose returns the stored decomposition', async () => {
        const d = record.decomposition;
        const r = await call('decompose', { character: record.character });
        expect(r.isError).toBeFalsy();
        expect(r.structuredContent).toMatchObject({
          found: true,
          character: record.character,
          ids: d.decomposition,
          atomic: d.atomic,
          radical: d.radical,
          components: d.components,
        });
      }, 30_000);
    });
  }

  it('verify rejects a valid wrong code for 明', async () => {
    const stored = datasets[1][MING].cangjie as string;
    const wrong = 'A';
    expect(wrong).not.toBe(stored);
    const r = await call('verify', { character: MING, code: wrong });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ found: true, matches: false, normalisedCode: wrong });
  }, 30_000);

  it('verify returns a tool error for codes that are not valid input', async () => {
    expect((await call('verify', { character: MING, code: 'hqz' })).isError).toBe(true);
    expect((await call('verify', { character: MING, code: 'abcdef' })).isError).toBe(true);
  }, 30_000);

  it('reports found: false for a valid character outside the dataset', async () => {
    const outside = [...'龘鬱龍魑魅魍魎'].find(
      (c) => !datasets[1][c] && !datasets[2][c] && !datasets[3][c],
    ) as string;
    expect(outside).toBeDefined();
    const r = await call('lookup', { character: outside });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ found: false, character: outside });
  }, 30_000);
});
