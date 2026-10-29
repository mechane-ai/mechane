import { MembershipRole, WorkspaceList, WorkspaceMember } from '@mechane/protocol';
import { PrincipalId, WorkspaceId } from '@mechane/records';
import { Array, Effect } from 'effect';
import { freshAccount } from '../accounts/fresh-account.ts';
import { approvedCli } from '../approvals/approved-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { SignedIn } from '../schemas.ts';
import type { ScenarioFailure, SharedWorkspaceFixture, StackInput, WorkspaceMemberFixture } from '../types.ts';

type RegisterWorkspaceMemberInput = StackInput & { readonly workspace: SharedWorkspaceFixture };

/** The member signs in after the shared workspace exists, so its default must still be personal. */
export const registerWorkspaceMember = Effect.fn('registerWorkspaceMember')(function* ({
  stack,
  workspace,
}: RegisterWorkspaceMemberInput): Effect.fn.Return<WorkspaceMemberFixture, ScenarioFailure> {
  const account = yield* freshAccount({ stack });
  const login = yield* approvedCli({ stack, args: ['auth', 'login'], account, result: SignedIn });
  const principalId = PrincipalId.make(login.result.principal.id);
  const words = ['--workspace', workspace.workspaceId, 'workspace', 'member', 'set', principalId];
  const args = [...words, '--role', MembershipRole.Member];

  yield* runCli({ stack, args, environment: workspace.owner.environment, result: WorkspaceMember });

  const listing = { stack, args: ['workspace', 'list'], environment: account.environment, result: WorkspaceList };
  const listed = yield* runCli(listing);
  const personal = Array.headNonEmpty(listed.result.workspaces);
  const personalWorkspaceId = WorkspaceId.make(personal.id);

  return { account, principalId, personalWorkspaceId };
});
