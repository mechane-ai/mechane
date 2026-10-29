import { Duration, Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import { freshFolder } from '../fresh-folder.ts';
import type { StackInput } from '../types.ts';
import { GATE_POLL_INTERVAL } from './constants.ts';
import { firstRun } from './first-run.ts';
import { gateRuns } from './gate-runs.ts';
import type { CommandGate } from './types.ts';

/** The files of the command gate's folder: one line per run of the gated command, and the file that opens the gate. */
const GateFile = { Prefix: 'gate-', Runs: 'runs', Open: 'open' } as const;

/**
 * A gate in a fresh folder of the stack's state folder, with an empty runs file. Host machines run as the stack's user,
 * so the gated bash reaches the folder by its path. The bash appends a line to the runs file at each run, and waits
 * until the open file exists.
 */
export const commandGate = Effect.fn('commandGate')(function* ({
  stack,
}: StackInput): Effect.fn.Return<CommandGate, FileStepFailed> {
  const folder = yield* freshFolder({ stack, prefix: GateFile.Prefix });
  const runsFile = join(folder, GateFile.Runs);
  const openFile = join(folder, GateFile.Open);
  const pollSeconds = Duration.toSeconds(GATE_POLL_INTERVAL);

  yield* Effect.tryPromise({
    try: () => writeFile(runsFile, ''),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: runsFile, reason: String(cause) }),
  });

  return {
    bash: `echo run >> ${runsFile} && until [ -e ${openFile} ]; do sleep ${pollSeconds}; done`,
    awaitRun: firstRun({ runsFile }),
    open: Effect.tryPromise({
      try: () => writeFile(openFile, ''),
      catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: openFile, reason: String(cause) }),
    }),
    runs: gateRuns({ runsFile }),
  };
});
