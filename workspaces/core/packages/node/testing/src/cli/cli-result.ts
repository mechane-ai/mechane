import { decodeCliResult } from '@mechane/program';
import { Effect, Option } from 'effect';
import type { Schema } from 'effect';
import { CliStep } from '../constants.ts';
import { CliFailed, CliUndecoded } from '../errors.ts';
import type { CliRun } from '../types.ts';
import type { FinishedCliInput } from './types.ts';

/** A finished CLI run, the schema that decodes its result, and the status it must exit with. */
type CliResultInput<S> = FinishedCliInput & { readonly result: S; readonly status: number };

/** Decodes the envelope result of a run that exited with `status`; any other carries what the CLI wrote to stderr. */
export const cliResult = Effect.fn('cliResult')(function* <S extends Schema.Codec<unknown, unknown>>({
  args,
  run,
  result,
  status,
}: CliResultInput<S>): Effect.fn.Return<CliRun<S['Type']>, CliFailed | CliUndecoded> {
  const command = args.join(' ');
  const stderr = run.stderr.trim();

  if (!Option.contains(run.status, status)) {
    return yield* new CliFailed({ command, step: CliStep.Exit, status: run.status, stderr });
  }

  const decoded = yield* decodeCliResult({ stdout: run.stdout, result }).pipe(
    Effect.mapError((error) => new CliUndecoded({ command, stderr, reason: error.message })),
  );

  return { result: decoded, output: `${run.stdout}${run.stderr}` };
});
