import { COMMANDS } from '@mechane/commands';
import { Record, Schema } from 'effect';
import { readFailureCode } from './read-failure-code.ts';
import { startCli } from './start-cli.ts';
import type { RunCliInput } from './types.ts';

const CliEnvelope = Schema.Struct({ result: Schema.Unknown });
const commandNames = Record.keys(COMMANDS);

export async function runCli<Output extends Schema.Codec<unknown, unknown>>(
  input: RunCliInput<Output>,
): Promise<Output['Type']> {
  const running = startCli(input);
  const finished = await running.finished;

  if (finished.status !== 0) {
    const command = commandNames.find((name) => name.split(' ').every((word, index) => input.args[index] === word));
    const code = readFailureCode(finished.stdout);

    throw new Error(`CLI ${command ?? 'command'} failed with status ${finished.status} (${code})`);
  }

  const envelope = Schema.decodeUnknownSync(Schema.fromJsonString(CliEnvelope))(finished.stdout);
  const result = Schema.decodeUnknownSync(input.schema)(envelope.result);

  return result;
}
