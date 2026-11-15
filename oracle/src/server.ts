import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { decompose, lookup, OracleInputError, verify } from './oracle';
import type { Dataset } from './oracle';

const SERVER_VERSION = '0.1.0';

interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function run(fn: () => object): ToolResult {
  try {
    const result = fn();
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    if (error instanceof OracleInputError) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
    throw error;
  }
}

export function createServer(dataset: Dataset): McpServer {
  const server = new McpServer({ name: 'cangjie-oracle', version: SERVER_VERSION });

  server.registerTool(
    'lookup',
    {
      description:
        'Look up a character in the Ghost Script dataset: its verbatim Unihan Cangjie code, the code source, and whether it is playable in the game.',
      inputSchema: { character: z.string().describe('Exactly one CJK Unified Ideograph (U+4E00 to U+9FFF).') },
    },
    ({ character }) => run(() => lookup(dataset, character)),
  );

  server.registerTool(
    'verify',
    {
      description:
        'Check whether a Cangjie code (A-Y, 1 to 5 letters, case-insensitive) equals the dataset code for a character.',
      inputSchema: {
        character: z.string().describe('Exactly one CJK Unified Ideograph (U+4E00 to U+9FFF).'),
        code: z.string().describe('Cangjie code to check, A-Y, 1 to 5 letters.'),
      },
    },
    ({ character, code }) => run(() => verify(dataset, character, code)),
  );

  server.registerTool(
    'decompose',
    {
      description:
        'Return the Make Me a Hanzi decomposition of a character: IDS string, radical, components and whether it is atomic.',
      inputSchema: { character: z.string().describe('Exactly one CJK Unified Ideograph (U+4E00 to U+9FFF).') },
    },
    ({ character }) => run(() => decompose(dataset, character)),
  );

  return server;
}
