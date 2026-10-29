import { InvocationKind } from '@mechane/cli-kernel';
import { helpLines, PROGRAM } from '@mechane/commands';
import type { ExitStatus } from '@mechane/commands';
import { Effect, Option } from 'effect';
import { failureReport } from '../failures/failure-report.ts';
import { loadInvocation } from '../settings/load-invocation.ts';
import { printLines } from './print-lines.ts';
import { reportFailure } from './report-failure.ts';
import { runCommand } from './run-command.ts';

/** What begins the diagnostic of a command line that does not decode, which names no command to label it. */
const USAGE_LABEL = 'read the command line';

/**
 * Decodes the invocation, carries it out, and answers the exit status its outcome calls for. It prints the help or the
 * release, runs a command, or reports the usage error of a command line that does not decode.
 */
export const invoke = Effect.fn('invoke')(function* (): Effect.fn.Return<ExitStatus> {
  const invocation = yield* loadInvocation().pipe(
    Effect.catchTags({ UsageInvalid: (failure) => Effect.succeed({ kind: InvocationKind.Usage, failure }) }),
  );

  switch (invocation.kind) {
    case InvocationKind.Help:
      return printLines({ lines: helpLines() });
    case InvocationKind.Version:
      return printLines({ lines: [`${PROGRAM} ${invocation.release}`] });
    case InvocationKind.Command:
      return yield* runCommand({ invocation });
    case InvocationKind.Usage:
      return reportFailure({
        output: invocation.failure.output,
        command: Option.none(),
        report: failureReport({ failure: invocation.failure, label: USAGE_LABEL }),
      });
  }
});
