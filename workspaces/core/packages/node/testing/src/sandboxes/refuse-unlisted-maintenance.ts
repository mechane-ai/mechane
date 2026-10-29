import { SandboxReport } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Effect, Option } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure } from '../types.ts';

type RefuseUnlistedMaintenanceInput = { readonly stack: Stack; readonly mech: TalkingMech };

/** Operator admission applies before maintenance can allocate a guest, just as it does for bash. */
export const refuseUnlistedMaintenance = Effect.fn('refuseUnlistedMaintenance')(function* ({
  stack,
  mech,
}: RefuseUnlistedMaintenanceInput): Effect.fn.Return<void, ScenarioFailure> {
  const args = ['sandbox', 'upgrade', mech.id];
  const refusal = yield* refusedCli({ stack, args, environment: mech.account.environment });
  const report = yield* mech.command({ words: ['sandbox', 'show'], ids: [], result: SandboxReport });

  const isEmpty = Option.isNone(report.sandboxId);

  yield* check({
    name: 'sandbox maintenance obeys operator admission before allocating a machine',
    conditions: [refusal.code === RefusalCode.SandboxDisabled, isEmpty],
    detail: `maintenance answered ${refusal.code}; sandbox ${report.status}`,
  });
});
