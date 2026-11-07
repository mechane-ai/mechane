import { Schema } from 'effect';
import { startCli } from './start-cli.ts';
import type { CliInput, CliResult } from './types.ts';

const CliFailure = Schema.Struct({ errors: Schema.NonEmptyArray(Schema.Struct({ code: Schema.String })) });
export type CliRefusal = CliResult & { readonly code: string };

export async function runCliFailure(input: CliInput): Promise<CliRefusal> {
  const running = startCli(input);
  const finished = await running.finished;

  if (finished.status === 0) {
    throw new Error('The CLI accepted an operation that should have been refused');
  }

  const envelope = Schema.decodeUnknownSync(Schema.fromJsonString(CliFailure))(finished.stdout);

  return { ...finished, code: envelope.errors[0].code };
}
