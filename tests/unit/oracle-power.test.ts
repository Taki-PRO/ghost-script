import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Requirements 7.1, 7.2, 7.3, 7.4, 9.1, 9.3

const repoRoot = resolve(__dirname, '..', '..');
const powerDir = resolve(repoRoot, 'oracle/power');
const pluginText = readFileSync(resolve(powerDir, 'plugin.json'), 'utf8');
const mcpText = readFileSync(resolve(powerDir, 'mcp.json'), 'utf8');
const skillText = readFileSync(resolve(powerDir, 'skills/cangjie-oracle/SKILL.md'), 'utf8');

interface Plugin {
  $schema?: unknown;
  name?: unknown;
  version?: unknown;
  description?: unknown;
  author?: { name?: unknown };
  keywords?: unknown;
  license?: unknown;
}
interface McpServer {
  type?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
}
interface McpFile {
  $schema?: unknown;
  mcpServers: Record<string, McpServer>;
}

const plugin = JSON.parse(pluginText) as Plugin;
const mcp = JSON.parse(mcpText) as McpFile;
const workspaceMcp = JSON.parse(
  readFileSync(resolve(repoRoot, '.kiro/settings/mcp.json'), 'utf8'),
) as McpFile;

function frontMatter(text: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) throw new Error('SKILL.md has no front matter');
  const fields: Record<string, string> = {};
  for (const line of (match[1] as string).split(/\r?\n/)) {
    const m = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1] as string] = m[2] as string;
  }
  return fields;
}

describe('oracle/power/plugin.json', () => {
  it('has the required fields', () => {
    expect(plugin.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(plugin.name).toBe('cangjie-oracle');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof plugin.description).toBe('string');
    expect((plugin.description as string).length).toBeGreaterThan(0);
    expect(plugin.author?.name).toBe('Ghost Script');
    expect(plugin.license).toBe('MIT');
  });

  it('has non-empty string keywords', () => {
    expect(Array.isArray(plugin.keywords)).toBe(true);
    const keywords = plugin.keywords as unknown[];
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    expect(keywords).toContain('cangjie');
  });
});

describe('oracle/power/mcp.json', () => {
  const server = mcp.mcpServers['cangjie-oracle'] as McpServer;

  it('defines one stdio server named cangjie-oracle', () => {
    expect(mcp.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
    expect(Object.keys(mcp.mcpServers)).toEqual(['cangjie-oracle']);
    expect(server.type).toBe('stdio');
  });

  it('has no env or url', () => {
    expect(server).not.toHaveProperty('env');
    expect(server).not.toHaveProperty('url');
  });

  it('uses the same command and args as the workspace MCP config', () => {
    const workspace = workspaceMcp.mcpServers['cangjie-oracle'] as McpServer;
    expect(server.command).toBe(workspace.command);
    expect(server.args).toEqual(workspace.args);
  });
});

describe('oracle/power/skills/cangjie-oracle/SKILL.md', () => {
  it('has name and description in the front matter', () => {
    const fm = frontMatter(skillText);
    expect(fm.name).toBe('cangjie-oracle');
    expect((fm.description ?? '').length).toBeGreaterThan(0);
  });

  it('mentions all three tools', () => {
    for (const tool of ['lookup', 'verify', 'decompose']) {
      expect(skillText).toContain(`\`${tool}`);
    }
  });

  it('tells the agent to say "not in the dataset"', () => {
    expect(skillText).toContain('not in the dataset');
  });
});

describe('personal names', () => {
  it('appear in none of the three Power files', () => {
    for (const text of [pluginText, mcpText, skillText]) {
      expect(text).not.toMatch(new RegExp(['Tak', 'shil'].join(''), 'i'));
    }
  });
});
