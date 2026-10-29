import type { ToolDiagnostic } from '@earendil-works/pi-durable';
import { Array, Duration, Match, Option } from 'effect';
import { SandboxRefusal } from '../constants.ts';
import { errorDiagnostic } from '../error-diagnostic.ts';
import { failedResult } from '../failed-result.ts';
import type { HandsRefusal } from '../schemas.ts';
import type { ExecutionOutcome, HandsOutcome, OutcomeResults, ToolResult } from '../types.ts';
import { BashDiagnostic } from './constants.ts';

/** The output an execution settled with. */
type SettledOutput = Extract<ExecutionOutcome, Readonly<Record<'_tag', 'Exited' | 'TimedOut'>>>['output'];

type OutputResultInput = {
  readonly output: SettledOutput;
  /** The command's failure; none for a command that exited with code 0. */
  readonly failure: Option.Option<ToolDiagnostic>;
};

/** How a command ended, and the timeout it ran with, which a timed-out result names. */
type BashResultInput = { readonly outcome: HandsOutcome; readonly timeout: Duration.Duration };

/**
 * Why an uncertain command has no result: its machine ended without a receipt, so the command is never sent again. The
 * next one starts on a new machine.
 */
const UNCERTAIN_MESSAGE =
  "The sandbox's machine stopped before this command's outcome was recorded, so it may have partly run; unsaved changes may be lost";

/** Why a command of a workspace without a sandbox has no result. */
const NO_SANDBOX_MESSAGE = 'This workspace has no sandbox, so the command did not run';

/** Why an unavailable command has no result: no machine started for it, so it never ran. */
const UNAVAILABLE_MESSAGE = 'The sandbox could not start a machine, so the command did not run; it may be tried again';

/** Why the hands refused a command, and what the model can do about a workspace that runs every machine. */
const REFUSAL_MESSAGES: Readonly<Record<SandboxRefusal, (refusal: Pick<HandsRefusal, 'machines'>) => string>> = {
  [SandboxRefusal.NoSandbox]: () => NO_SANDBOX_MESSAGE,
  [SandboxRefusal.MachinesFull]: ({ machines }) =>
    `This workspace runs its ${machines} machines, so the command did not run; wait for one to stop, or cancel a drone`,
};

/** The result of each way a command ends, in pi's own words for an exit code and a timeout. */
const BASH_RESULTS: Readonly<OutcomeResults<HandsOutcome & Pick<BashResultInput, 'timeout'>>> = {
  Exited: ({ exitCode, output }) => {
    const diagnostic = errorDiagnostic({
      code: BashDiagnostic.ExitCode,
      message: `Command exited with code ${exitCode}`,
    });

    const failure = Option.liftPredicate(diagnostic, () => exitCode !== 0);

    return outputResult({ output, failure });
  },
  TimedOut: ({ output, timeout }) => {
    const seconds = Duration.toSeconds(timeout);

    const diagnostic = errorDiagnostic({
      code: BashDiagnostic.Timeout,
      message: `Command timed out after ${seconds} seconds`,
    });

    const failure = Option.some(diagnostic);

    return outputResult({ output, failure });
  },
  Uncertain: () => failedResult({ code: BashDiagnostic.Uncertain, message: UNCERTAIN_MESSAGE }),
  Unavailable: () => failedResult({ code: BashDiagnostic.Unavailable, message: UNAVAILABLE_MESSAGE }),
  PersistenceFailed: ({ output, reason }) => {
    const diagnostic = errorDiagnostic({
      code: BashDiagnostic.PersistenceFailed,
      message: `The command ended, but its files could not be saved: ${reason}. Its live files remain available for a new cleanup or export command. The previous saved workspace is unchanged; do not rerun this command automatically`,
    });

    const failure = Option.some(diagnostic);

    return outputResult({ output, failure });
  },
  Refused: ({ reason, machines }) => {
    const message = REFUSAL_MESSAGES[reason]({ machines });

    return failedResult({ code: BashDiagnostic.Unavailable, message });
  },
};

/** The result the model reads for how a command ended. */
export function bashResult({ outcome, timeout }: BashResultInput): ToolResult {
  return Match.valueTags({ ...outcome, timeout }, BASH_RESULTS);
}

/** The tail of a command's output, with a note when output before it was dropped, and the command's failure, if any. */
function outputResult({ output, failure }: OutputResultInput): ToolResult {
  const dropped = Option.liftPredicate(
    {
      severity: 'info',
      code: BashDiagnostic.Dropped,
      message: `The command wrote ${output.omittedBytes} bytes before the output shown, which were dropped`,
    } as const,
    () => output.omittedBytes > 0,
  );

  return {
    output: [{ type: 'text', text: output.text }],
    isError: Option.isSome(failure),
    diagnostics: Array.getSomes([dropped, failure]),
  };
}
