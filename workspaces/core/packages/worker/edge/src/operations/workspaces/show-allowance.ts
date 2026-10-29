import { callDirectory, callWorkspace } from '@mechane/bindings';
import type { Allowance, catalog, ObjectUnavailable } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import { CommittedToday } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/**
 * Reads the workspace's allowance, which the directory keeps, beside what the current UTC day's dispatches have
 * committed of it, which the workspace's ledger keeps.
 */
export const showAllowance = Effect.fn('showAllowance')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showAllowance>): Effect.fn.Return<Allowance, ObjectUnavailable> {
  const { workspaceId } = input;

  const dailyAllowanceMicros = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.dailyAllowanceMicros({ workspaceId }),
    answer: Micros,
  });

  const committed = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.committedToday(),
    answer: CommittedToday,
  });

  return { ...committed, dailyAllowanceMicros };
});
