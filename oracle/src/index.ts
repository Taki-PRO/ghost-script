import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadDataset, OracleDataError } from './dataset';
import { createServer } from './server';

async function main(): Promise<void> {
  let dataset;
  try {
    dataset = loadDataset();
  } catch (error) {
    if (error instanceof OracleDataError) {
      process.stderr.write(`cangjie-oracle: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  await createServer(dataset).connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`cangjie-oracle: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
