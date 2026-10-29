import { startProcess } from '@mechane/program';
import type { ProcessRun } from '@mechane/program';
import { Effect } from 'effect';
import type { Duration, Scope } from 'effect';
import { InputUnreadable } from '../errors.ts';

/** A tool of the workspace to run to its end: its command and arguments, the variables it inherits, its deadline. */
type ToolOutputInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
  readonly timeout: Duration.Duration;
};

/**
 * Runs one of the workspace's tools to its end and returns how it exited and what it printed. A linter exits nonzero
 * when it finds something, so its caller decides what a status means.
 */
export const toolOutput = Effect.fn('toolOutput')(function* ({
  command,
  args,
  inherited,
  timeout,
}: ToolOutputInput): Effect.fn.Return<ProcessRun, InputUnreadable, Scope.Scope> {
  const { exited } = yield* startProcess({ command, args, environment: inherited, timeout });
  const commandLine = [command, ...args].join(' ');

  return yield* exited.pipe(Effect.mapError(({ reason }) => new InputUnreadable({ path: commandLine, reason })));
}, Effect.scoped);
