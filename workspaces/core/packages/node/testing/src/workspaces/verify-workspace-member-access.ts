import { Effect } from 'effect';
import { verifyCredentialAccess } from '../credentials/verify-credential-access.ts';
import { verifySlackInstallationAccess } from '../slack/verify-slack-installation-access.ts';
import { verifySourceGrantAccess } from '../sources/verify-source-grant-access.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { verifyWorkspaceSelection } from './verify-workspace-selection.ts';

type VerifyWorkspaceMemberAccessInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** Agent access and owner-only integration authority must stay separate within the same shared workspace. */
export const verifyWorkspaceMemberAccess = Effect.fn('verifyWorkspaceMemberAccess')(function* ({
  ...input
}: VerifyWorkspaceMemberAccessInput): Effect.fn.Return<void, ScenarioFailure> {
  const { stack, guarantee, workspace, member } = input;

  yield* verifyWorkspaceSelection({
    stack,
    guarantee,
    account: member.account,
    personalWorkspaceId: member.personalWorkspaceId,
    sharedWorkspaceId: workspace.workspaceId,
  });
  yield* verifySourceGrantAccess(input);
  yield* verifyCredentialAccess(input);
  yield* verifySlackInstallationAccess(input);
});
