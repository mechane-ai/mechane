import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { GateRunsInput } from './types.ts';

/** How many times the gated command has run, one line of the runs file each. */
export const gateRuns = Effect.fn('gateRuns')(function* ({
  runsFile,
}: GateRunsInput): Effect.fn.Return<number, FileStepFailed> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(runsFile, 'utf8'),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path: runsFile, reason: String(cause) }),
  });

  return text.split('\n').filter((line) => line !== '').length;
});
