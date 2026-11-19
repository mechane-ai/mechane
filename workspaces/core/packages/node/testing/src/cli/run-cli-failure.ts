import { readFailureCode } from './read-failure-code.ts';
import { startCli } from './start-cli.ts';
import type { CliInput, CliResult } from './types.ts';

export type CliRefusal = CliResult & { readonly code: string };

export async function runCliFailure(input: CliInput): Promise<CliRefusal> {
  const running = startCli(input);
  const finished = await running.finished;

  if (finished.status === 0) {
    throw new Error('The CLI accepted an operation that should have been refused');
  }

  return { ...finished, code: readFailureCode(finished.stdout) };
}
