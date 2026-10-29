import { Deferred, Effect, Option } from 'effect';
import type { ChildProcessByStdio } from 'node:child_process';
import { constants } from 'node:os';
import type { Readable } from 'node:stream';
import { killGroup } from './kill-group.ts';
import { outputTail } from './output-tail.ts';
import type { BashRun } from './types.ts';

/** The exit status a shell reports for a process a signal ended: this base plus the signal's number. */
const SIGNAL_EXIT_BASE = 128;

type SpawnedBashInput = {
  /** A bash that started, with no standard input and its output on two pipes. */
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
};

/** A started bash's run: its exit and its pipes' close as they come, the kill of its group, and its output's tail. */
export function spawnedBash({ child }: SpawnedBashInput): BashRun {
  const exited = Deferred.makeUnsafe<number>();
  const closed = Deferred.makeUnsafe<void>();
  const tail = outputTail();
  // A process that started has its id, which is also its group's.
  const groupId = Option.getOrThrow(Option.fromNullishOr(child.pid));
  const settleExit: () => void = () => Deferred.doneUnsafe(exited, Effect.succeed(shellExitCode({ child })));

  child.stdout.on('data', (chunk: Buffer) => tail.push({ chunk }));
  child.stderr.on('data', (chunk: Buffer) => tail.push({ chunk }));
  child.on('exit', settleExit);
  child.on('close', () => Deferred.doneUnsafe(closed, Effect.void));

  return { exited, closed, kill: killGroup({ groupId }), output: tail.output };
}

/** The exit code a shell reports for the exited process: its own, or 128 plus the number of the ending signal. */
function shellExitCode({ child }: SpawnedBashInput): number {
  const code = Option.fromNullishOr(child.exitCode);

  if (Option.isSome(code)) {
    return code.value;
  }

  // A process that exited without its own code was ended by a signal.
  return SIGNAL_EXIT_BASE + constants.signals[Option.getOrThrow(Option.fromNullishOr(child.signalCode))];
}
