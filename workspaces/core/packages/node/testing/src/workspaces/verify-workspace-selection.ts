import { Mech, MechList } from '@mechane/protocol';
import type { MechSummary, Workspace } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import type { Account, ScenarioFailure } from '../types.ts';

type VerifyWorkspaceSelectionInput = {
  readonly stack: Stack;
  readonly account: Account;
  readonly personalWorkspaceId: Workspace['id'];
  readonly sharedWorkspaceId: Workspace['id'];
  readonly guarantee: string;
};

const WORKSPACE_REFUSAL = 'WorkspaceSelectionRefused';

/** CLI selection isolates personal and shared resources and refuses inaccessible workspace IDs. */
export const verifyWorkspaceSelection = Effect.fn('verifyWorkspaceSelection')(function* ({
  guarantee,
  ...input
}: VerifyWorkspaceSelectionInput): Effect.fn.Return<void, ScenarioFailure> {
  const { stack, account, personalWorkspaceId, sharedWorkspaceId } = input;
  const creation = { stack, environment: account.environment, result: Mech };
  const personalArgs = ['mech', 'create', '--name', 'personal-workspace-selection'];
  const personal = yield* runCli({ ...creation, args: personalArgs });
  const sharedArgs = ['mech', 'create', '--name', 'shared-workspace-selection', '--workspace', sharedWorkspaceId];
  const shared = yield* runCli({ ...creation, args: sharedArgs });
  const environment = { ...account.environment, MECHANE_WORKSPACE_ID: sharedWorkspaceId };
  const listing = { stack, environment, result: MechList };
  const sharedList = yield* runCli({ ...listing, args: ['mech', 'list'] });
  const personalList = yield* runCli({ ...listing, args: ['mech', 'list', '--workspace', personalWorkspaceId] });
  const missingWorkspaceId = WorkspaceId.make(crypto.randomUUID());
  const args = ['mech', 'create', '--name', 'refused-workspace-selection', '--workspace', missingWorkspaceId];
  const refusal = yield* refusedCli({ stack, args, environment: account.environment });
  const readId: (mech: MechSummary) => MechSummary['id'] = ({ id }) => id;
  const personalIds = personalList.result.mechs.map(readId);
  const sharedIds = sharedList.result.mechs.map(readId);

  const conditions = [
    personalIds.includes(personal.result.id) && !personalIds.includes(shared.result.id),
    sharedIds.includes(shared.result.id) && !sharedIds.includes(personal.result.id),
    refusal.code === WORKSPACE_REFUSAL,
  ];

  const detail = `personal mechs ${personalIds.join(', ')}; shared mechs ${sharedIds.join(', ')}; refusal ${refusal.code}`;

  yield* check({ name: guarantee, conditions, detail });
});
