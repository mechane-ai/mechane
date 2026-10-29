import { MembershipRole } from '@mechane/protocol';
import { Effect } from 'effect';
import { refusedCli } from '../cli/refused-cli.ts';
import type { CliRefusal, ScenarioFailure } from '../types.ts';
import type { WorkspaceAuthorityInput } from './types.ts';

type WorkspacePrivilegeRefusals = {
  readonly cannotCreate: CliRefusal;
  readonly cannotPromote: CliRefusal;
  readonly lastOwner: CliRefusal;
  readonly personal: CliRefusal;
};

/** New workspace allocation and protected membership changes require their own authority. */
export const refuseWorkspacePrivileges = Effect.fn('refuseWorkspacePrivileges')(function* ({
  stack,
  workspace,
  member,
}: WorkspaceAuthorityInput): Effect.fn.Return<WorkspacePrivilegeRefusals, ScenarioFailure> {
  const memberCommand = { stack, environment: member.account.environment };
  const workspaceArgs = ['--workspace', workspace.workspaceId, 'workspace', 'member'];
  const createArgs = ['workspace', 'create', '--name', 'Unbudgeted'];
  const cannotCreate = yield* refusedCli({ ...memberCommand, args: createArgs });
  const promoteArgs = [...workspaceArgs, 'set', member.principalId, '--role', MembershipRole.Owner];
  const cannotPromote = yield* refusedCli({ ...memberCommand, args: promoteArgs });
  const demoteArgs = [...workspaceArgs, 'set', workspace.ownerPrincipalId, '--role', MembershipRole.Member];
  const lastOwner = yield* refusedCli({ stack, args: demoteArgs, environment: workspace.owner.environment });
  const personalArgs = ['--workspace', member.personalWorkspaceId, 'workspace', 'member', 'remove', member.principalId];
  const personal = yield* refusedCli({ ...memberCommand, args: personalArgs });

  return { cannotCreate, cannotPromote, lastOwner, personal };
});
