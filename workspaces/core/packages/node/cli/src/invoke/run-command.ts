import { REQUEST_TIMEOUT, RunOutcome } from '@mechane/cli-kernel';
import type { CommandInvocation, ResultRecord, RunFailure } from '@mechane/cli-kernel';
import { call } from '@mechane/client';
import type { CallRequest, ClientFailure } from '@mechane/client';
import { ExitStatus } from '@mechane/commands';
import type { CommandName } from '@mechane/commands';
import type { catalog, OperationName, OperationOutput } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { failureReport } from '../failures/failure-report.ts';
import { writeCommandResult } from '../output/write-command-result.ts';
import { RUNS } from '../runs/runs.ts';
import { operationLabel } from './operation-label.ts';
import { reportFailure } from './report-failure.ts';

type RunCommandInput<N extends CommandName> = { readonly invocation: CommandInvocation<N> };

/** The exit status of a run that ended in each way. */
const RUN_OUTCOME_STATUS: Readonly<Record<RunOutcome, ExitStatus>> = {
  [RunOutcome.Completed]: ExitStatus.Ok,
  [RunOutcome.Incomplete]: ExitStatus.Failed,
};

/**
 * Runs the invoked command, which writes its results through the output module, and answers its outcome's exit status.
 * A failed run writes its failure and answers the failure's status. The settings decoded the input with the command's
 * own schema, so the command and its input agree.
 */
export const runCommand = Effect.fn('runCommand')(
  function* <N extends CommandName>({ invocation }: RunCommandInput<N>): Effect.fn.Return<ExitStatus, RunFailure> {
    const { command, origin, input, credentials, program } = invocation;

    const operationCall = Effect.fn('operationCall')(function* <M extends OperationName>({
      name,
      input: operationInput,
      credential,
    }: CallRequest<M>): Effect.fn.Return<OperationOutput<(typeof catalog)[M]>, ClientFailure> {
      return yield* call({
        name,
        input: operationInput,
        credential,
        origin,
        timeout: REQUEST_TIMEOUT,
        userAgent: program.userAgent,
      });
    });

    const write: (record: ResultRecord<N>) => void = ({ result }) => writeCommandResult({ invocation, result });
    const outcome = yield* RUNS[command]({ call: operationCall, origin, input, credentials, program, write });

    return RUN_OUTCOME_STATUS[outcome];
  },
  (run, { invocation }) =>
    Effect.catch(run, (failure) =>
      Effect.succeed(
        reportFailure({
          output: invocation.output,
          command: Option.some(invocation.command),
          report: failureReport({ failure, label: operationLabel({ invocation }) }),
        }),
      ),
    ),
);
