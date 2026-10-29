import { MembershipRole, WorkspaceMember, WorkspaceMemberList, WorkspaceMemberRemoval } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect, Redacted } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import { runCli } from '../cli/run-cli.ts';
import type { ScenarioFailure } from '../types.ts';
import type { WorkspaceAuthorityInput } from './types.ts';

type TransferredWorkspace = {
  readonly removed: string;
  readonly missing: string;
  readonly remaining: WorkspaceMemberList;
};

/** A removed owner keeps its login but loses workspace access immediately. */
export const transferWorkspaceOwnership = Effect.fn('transferWorkspaceOwnership')(function* ({
  stack,
  workspace,
  member,
}: WorkspaceAuthorityInput): Effect.fn.Return<TransferredWorkspace, ScenarioFailure> {
  const { workspaceId, owner, ownerPrincipalId } = workspace;
  const workspaceArgs = ['--workspace', workspaceId, 'workspace', 'member'];
  const promoteArgs = [...workspaceArgs, 'set', member.principalId, '--role', MembershipRole.Owner];

  yield* runCli({ stack, args: promoteArgs, environment: owner.environment, result: WorkspaceMember });

  const removal = { stack, environment: member.account.environment, result: WorkspaceMemberRemoval };

  yield* runCli({ ...removal, args: [...workspaceArgs, 'remove', ownerPrincipalId] });

  const saved = yield* savedLoginToken({ account: owner });
  const credential = Redacted.make(saved.token);
  const removed = yield* refusedOperation({ stack, name: 'listWorkspaceMembers', input: { workspaceId }, credential });
  const missingWorkspaceId = WorkspaceId.make(crypto.randomUUID());
  const missingInput = { workspaceId: missingWorkspaceId };
  const missing = yield* refusedOperation({ stack, name: 'listWorkspaceMembers', input: missingInput, credential });
  const args = ['--workspace', workspaceId, 'workspace', 'members'];

  const remaining = yield* runCli({
    stack,
    args,
    environment: member.account.environment,
    result: WorkspaceMemberList,
  });

  return { removed, missing, remaining: remaining.result };
});
