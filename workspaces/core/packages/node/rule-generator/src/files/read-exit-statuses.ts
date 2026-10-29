import { wireStruct } from '@mechane/records';
import type { ExitStatus } from '@mechane/rules';
import { Effect, Schema } from 'effect';
import { GenerateStep } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

/** The CLI's command reference, relative to the workspace, whose exit statuses a contract's block states. */
const COMMAND_REFERENCE = 'packages/node/cli/reference.json';

/** The part of the CLI's command reference the generator reads: each exit status by its name, in the CLI's order. */
const CommandReference = wireStruct({
  fields: { exitStatuses: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.Int })) },
});

/** The CLI's exit statuses as its command reference publishes them, which the output channels contract states. */
export const readExitStatuses = Effect.fn('readExitStatuses')(function* (): Effect.fn.Return<
  ReadonlyArray<ExitStatus>,
  GenerateFailed
> {
  const text = yield* readInput({ path: COMMAND_REFERENCE });

  const { exitStatuses } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(CommandReference))(text).pipe(
    Effect.mapError(
      (error) => new GenerateFailed({ step: GenerateStep.Read, path: COMMAND_REFERENCE, reason: error.message }),
    ),
  );

  return exitStatuses;
});
