import { SourceReport, SourceStatus } from '@mechane/protocol';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import { SOURCE_GRANT_CONFIGURATION } from './constants.ts';

const DISABLED_SOURCE_ID = '00000000-0000-4000-8000-000000000001';

const DISABLED_SOURCE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

type RefuseDisabledSourceInput = StackInput & { readonly mech: TalkingMech };

/** Denied machine admission preserves the pinned preparation record so an enabled workspace can retry it. */
export const refuseDisabledSource = Effect.fn('refuseDisabledSource')(function* ({
  stack,
  mech,
}: RefuseDisabledSourceInput): Effect.fn.Return<void, ScenarioFailure> {
  const command = { stack, environment: mech.account.environment };
  const grantArgs = ['source', 'grant', mech.id, '--configuration', SOURCE_GRANT_CONFIGURATION];

  yield* runCli({ ...command, args: grantArgs, result: SourceReport });

  const selection = [mech.id, '--source-id', DISABLED_SOURCE_ID];
  const checkout = ['source', 'checkout', ...selection, '--commit', DISABLED_SOURCE_COMMIT];
  const refusal = yield* refusedCli({ ...command, args: checkout });
  const saved = yield* runCli({ ...command, args: ['source', 'show', ...selection], result: SourceReport });

  const isPreparing =
    SourceReport.guards.Progress(saved.result) && saved.result.source.status === SourceStatus.Preparing;

  yield* check({
    name: 'disabled source checkout retains a retryable preparation record',
    conditions: [refusal.code === RefusalCode.InvalidRequest, isPreparing],
    detail: `checkout ${refusal.code}; preparation retained ${isPreparing}`,
  });
});
