import type { CommandResult, RunFailure } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { checkWorkspaceImportScope } from './check-workspace-import-scope.ts';
import { importWorkspaceCredentials } from './import-workspace-credentials.ts';
import { importWorkspacePolicy } from './import-workspace-policy.ts';
import { importWorkspaceSlack } from './import-workspace-slack.ts';
import type { ImportWorkspaceInput } from './types.ts';

/** Policy is applied last because suspension can close the member operations used by this import. */
export const applyWorkspaceImport = Effect.fn('applyWorkspaceImport')(function* ({
  call,
  token,
  workspaceId,
  document,
  file,
}: ImportWorkspaceInput): Effect.fn.Return<CommandResult<'workspace import'>['result'], RunFailure> {
  yield* checkWorkspaceImportScope({ workspaceId, document, file });

  if (Option.isSome(document.policy)) {
    yield* call({ name: 'showWorkspacePolicy', input: { workspaceId }, credential: token });
  }

  const context = { call, token, workspaceId, document };
  const credentials = yield* importWorkspaceCredentials(context);
  const slackInstallations = yield* importWorkspaceSlack(context);
  const hasPolicy = yield* importWorkspacePolicy(context);

  const importedCredentials = credentials
    .filter((credential) => credential.isCreated)
    .map((credential) => credential.secretReference);

  const retainedCredentials = credentials
    .filter((credential) => !credential.isCreated)
    .map((credential) => credential.secretReference);

  return { workspaceId, importedCredentials, retainedCredentials, slackInstallations, hasPolicy };
});
