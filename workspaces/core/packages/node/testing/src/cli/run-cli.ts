import { Schema } from 'effect';
import { startCli } from './start-cli.ts';
import type { RunCliInput } from './types.ts';

const DISPLAYED_COMMAND_ARGUMENTS = 2;
const CliEnvelope = Schema.Struct({ result: Schema.Unknown });

export async function runCli<Output extends Schema.Codec<unknown, unknown>>(
  input: RunCliInput<Output>,
): Promise<Output['Type']> {
  const running = startCli(input);
  const finished = await running.finished;

  if (finished.status !== 0) {
    throw new Error(
      `The CLI command ${input.args.slice(0, DISPLAYED_COMMAND_ARGUMENTS).join(' ')} failed with status ${finished.status}`,
    );
  }

  const envelope = Schema.decodeUnknownSync(Schema.fromJsonString(CliEnvelope))(finished.stdout);
  const result = Schema.decodeUnknownSync(input.schema)(envelope.result);

  return result;
}
