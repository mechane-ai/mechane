import { callWorkspace, callWorkspacePolicy } from '@mechane/bindings';
import type { Allowance, catalog, ObjectUnavailable } from '@mechane/protocol';
import { CommittedToday } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Reads the workspace's current policy beside what the UTC day's dispatches have committed in its ledger. */
export const showAllowance = Effect.fn('showAllowance')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showAllowance>): Effect.fn.Return<Allowance, ObjectUnavailable> {
  const { workspaceId } = input;

  const { dailyAllowanceMicros } = yield* callWorkspacePolicy({ settings, workspaceId });

  const committed = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.committedToday(),
    answer: CommittedToday,
  });

  return { ...committed, dailyAllowanceMicros };
});
