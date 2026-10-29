import { SUCCESS_STATUS } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import { CliStep } from '../constants.ts';
import { CliFailed, CliUndecoded } from '../errors.ts';
import type { CliRefusal } from '../types.ts';
import type { FinishedCliInput } from './types.ts';

/** The JSON envelope of a refused run, which reports exactly one error. */
const RefusalEnvelope = Schema.fromJsonString(
  Schema.Struct({ errors: Schema.Tuple([Schema.Struct({ code: Schema.String })]) }),
);

type RefusalEnvelope = typeof RefusalEnvelope.Type;

/** Answers with the one error's code of a run the CLI had to refuse, and fails when the run exited with success. */
export const cliRefusal = Effect.fn('cliRefusal')(function* ({
  args,
  run,
}: FinishedCliInput): Effect.fn.Return<CliRefusal, CliFailed | CliUndecoded> {
  const command = args.join(' ');
  const stderr = run.stderr.trim();

  if (Option.contains(run.status, SUCCESS_STATUS)) {
    return yield* new CliFailed({ command, step: CliStep.Refuse, status: run.status, stderr });
  }

  const { errors } = yield* Schema.decodeUnknownEffect(RefusalEnvelope)(run.stdout).pipe(
    Effect.mapError((error) => new CliUndecoded({ command, stderr, reason: error.message })),
  );

  return { code: errors[0].code, output: `${run.stdout}${run.stderr}` };
});
