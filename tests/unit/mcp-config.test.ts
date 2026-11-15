import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Requirements 6.1, 6.2, 6.3, 6.4, 9.1, 9.3

const repoRoot = resolve(__dirname, '..', '..');
const configPath = resolve(repoRoot, '.kiro/settings/mcp.json');

interface McpServer {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  headers?: unknown;
  disabled?: unknown;
  autoApprove?: unknown;
}
interface McpConfig {
  mcpServers: Record<string, McpServer>;
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as McpConfig;
const server = config.mcpServers['cangjie-oracle'] as McpServer;

describe('.kiro/settings/mcp.json', () => {
  it('defines only the cangjie-oracle server', () => {
    expect(Object.keys(config.mcpServers)).toEqual(['cangjie-oracle']);
  });

  it('starts the server with a command and string args', () => {
    expect(typeof server.command).toBe('string');
    expect((server.command as string).length).toBeGreaterThan(0);
    expect(server.command).toBe('npx');
    expect(Array.isArray(server.args)).toBe(true);
    expect((server.args as unknown[]).every((a) => typeof a === 'string')).toBe(true);
    expect(server.args).toEqual(['--no-install', 'tsx', 'oracle/src/index.ts']);
  });

  it('is enabled', () => {
    expect(server.disabled).toBe(false);
  });

  it('has no env, url or headers', () => {
    expect(server).not.toHaveProperty('env');
    expect(server).not.toHaveProperty('url');
    expect(server).not.toHaveProperty('headers');
  });

  it('auto-approves exactly lookup, verify and decompose', () => {
    expect(server.autoApprove).toEqual(['lookup', 'verify', 'decompose']);
  });

  it('names an entry file in args that exists', () => {
    const entry = (server.args as string[]).find((a) => /\.[cm]?[jt]s$/.test(a));
    expect(entry).toBeDefined();
    expect(existsSync(resolve(repoRoot, entry as string))).toBe(true);
  });
});

describe('.gitignore', () => {
  const lines = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

  it('has no line that ignores .kiro', () => {
    const ignoring = lines.filter(
      (l) => !l.startsWith('!') && /(^|\/)\.kiro(\/|\/\*\*?|\*)?$/.test(l),
    );
    expect(ignoring).toEqual([]);
  });

  it('keeps the .kiro negation line', () => {
    expect(lines).toContain('!.kiro/');
  });
});
