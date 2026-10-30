import { EventType, UnansweredReason } from '@mechane/protocol';
import type { WorkspacePolicy } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { RefusalCode } from '../constants.ts';
import { LOG_START } from '../mechs/constants.ts';
import { heldMech } from '../mechs/held-mech.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';
import { changeWorkspacePolicy } from './change-workspace-policy.ts';
import type { QueuedWorkspace } from './types.ts';

type VerifyWorkspacePolicyBudgetInput = StackInput & {
  readonly administrator: Account;
  readonly subject: QueuedWorkspace;
  readonly original: WorkspacePolicy;
};

type RejoinMechInput = StackInput & { readonly mech: QueuedWorkspace['mech'] };

/** The same live agent must observe a zero budget after suspension is lifted. */
export const verifyWorkspacePolicyBudget = Effect.fn('verifyWorkspacePolicyBudget')(function* ({
  stack,
  administrator,
  subject,
  original,
}: VerifyWorkspacePolicyBudgetInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const { mech, workspaceId } = subject;
  const dailyAllowanceMicros = Micros.make(0);

  yield* changeWorkspacePolicy({
    stack,
    administrator,
    workspaceId,
    changes: { isSuspended: false, dailyAllowanceMicros },
  });

  const resumed = yield* rejoinMech({ stack, mech });
  const { ended, requests } = yield* resumed.turn({ text: 'The new zero budget must refuse this request' });
  const isRefused = ended.type === EventType.TurnUnanswered && ended.reason === UnansweredReason.AllowanceExhausted;

  const refusal = yield* refusedCli({
    stack,
    environment: mech.account.environment,
    args: ['workspace', 'policy', 'show', workspaceId],
  });

  yield* changeWorkspacePolicy({ stack, administrator, workspaceId, changes: original });
  yield* check({
    name: 'workspace budgets and operator authority change without restarting the agent',
    conditions: [isRefused, requests.length === 0, refusal.code === RefusalCode.AdministratorRequired],
    detail: `zero-budget refusal ${isRefused}; model requests ${requests.length}; owner authority ${refusal.code}`,
  });
});

const rejoinMech = Effect.fn('rejoinMech')(function* ({
  stack,
  mech,
}: RejoinMechInput): Effect.fn.Return<TalkingMech, ScenarioFailure, Scope.Scope> {
  const target = { stack, account: mech.account, mechId: mech.id };
  const resumed = yield* heldMech({ ...target, after: LOG_START });

  // The fixture queued two turns before suspension; their endings must precede the new budget probe.
  yield* resumed.follower.awaitTurnEnd();
  yield* resumed.follower.awaitTurnEnd();

  return resumed;
});
